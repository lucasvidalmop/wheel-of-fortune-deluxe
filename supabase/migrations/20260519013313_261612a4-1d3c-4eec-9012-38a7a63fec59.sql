
ALTER TABLE public.luckybox_cases
  ADD COLUMN IF NOT EXISTS prize_type text NOT NULL DEFAULT 'pix';

CREATE OR REPLACE FUNCTION public.open_luckybox_case(p_owner_id uuid, p_account_id text, p_case_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user public.wheel_users%ROWTYPE;
  v_case public.luckybox_cases%ROWTYPE;
  v_prizes jsonb;
  v_prize jsonb;
  v_prize_index integer;
  v_total_weight numeric := 0;
  v_pick numeric;
  v_acc numeric := 0;
  v_i integer;
  v_pool jsonb;
  v_amount numeric := 0;
  v_payment_id uuid;
  v_opening_id uuid;
  v_scratch_prizes jsonb;
  v_scratch_prize jsonb := NULL;
  v_scratch_index integer := NULL;
  v_resolved_prize jsonb;
  v_resolved_label text;
  v_grants jsonb;
  v_case_key text;
  v_grant_count integer;
  v_used_grant boolean := false;
  v_new_tokens integer;
  v_queue jsonb;
  v_forced_list jsonb;
  v_forced_entry jsonb;
  v_forced_used boolean := false;
  v_is_tokens_prize boolean := false;
  v_token_delta integer := 0;
BEGIN
  SELECT * INTO v_user FROM public.wheel_users
  WHERE owner_id = p_owner_id AND btrim(account_id) = btrim(p_account_id)
  ORDER BY updated_at DESC NULLS LAST LIMIT 1
  FOR UPDATE;
  IF v_user.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado'); END IF;
  IF COALESCE(v_user.blacklisted, false) THEN RETURN jsonb_build_object('success', false, 'error', 'Conta bloqueada'); END IF;

  SELECT * INTO v_case FROM public.luckybox_cases
  WHERE id = p_case_id AND owner_id = p_owner_id AND is_active = true
  FOR UPDATE;
  IF v_case.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Caixa indisponível'); END IF;

  v_is_tokens_prize := COALESCE(v_case.prize_type, 'pix') = 'tokens';

  v_grants := COALESCE(v_user.case_grants, '{}'::jsonb);
  v_case_key := v_case.id::text;
  v_grant_count := COALESCE((v_grants->>v_case_key)::integer, 0);

  IF v_grant_count > 0 THEN
    v_used_grant := true;
  ELSIF COALESCE(v_user.tokens_balance, 0) < v_case.price_tokens THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tokens insuficientes');
  END IF;

  v_prizes := COALESCE(v_case.prizes, '[]'::jsonb);
  IF jsonb_typeof(v_prizes) <> 'array' OR jsonb_array_length(v_prizes) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Caixa sem prêmios configurados');
  END IF;

  v_queue := COALESCE(v_user.forced_prize_queue, '{}'::jsonb);
  IF v_used_grant THEN
    v_forced_list := COALESCE(v_queue->v_case_key, '[]'::jsonb);
    IF jsonb_typeof(v_forced_list) = 'array' AND jsonb_array_length(v_forced_list) > 0 THEN
      v_forced_entry := v_forced_list->0;
      v_prize_index := COALESCE(NULLIF(v_forced_entry->>'prize_index','')::integer, -1);
      IF v_prize_index >= 0 AND v_prize_index < jsonb_array_length(v_prizes) THEN
        v_forced_used := true;
        v_forced_list := v_forced_list - 0;
        IF jsonb_array_length(v_forced_list) = 0 THEN
          v_queue := v_queue - v_case_key;
        ELSE
          v_queue := jsonb_set(v_queue, ARRAY[v_case_key], v_forced_list);
        END IF;
      END IF;
    END IF;
  END IF;

  IF NOT v_forced_used THEN
    IF v_case.mode = 'pool' THEN
      v_pool := COALESCE(v_case.prize_pool, 'null'::jsonb);
      IF v_pool IS NULL OR v_pool = 'null'::jsonb OR jsonb_array_length(v_pool) = 0 THEN
        v_pool := '[]'::jsonb;
        FOR v_i IN 0..(jsonb_array_length(v_prizes) - 1) LOOP
          DECLARE v_count integer;
          BEGIN
            v_count := GREATEST(COALESCE(NULLIF(v_prizes->v_i->>'count', '')::integer, 0), 0);
            IF v_count > 0 THEN
              FOR v_acc IN 1..v_count LOOP
                v_pool := v_pool || jsonb_build_array(v_i);
              END LOOP;
            END IF;
          END;
        END LOOP;
      END IF;
      IF jsonb_array_length(v_pool) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Estoque da caixa esgotado');
      END IF;
      v_i := floor(random() * jsonb_array_length(v_pool))::integer;
      v_prize_index := (v_pool->v_i)::integer;
      v_pool := (v_pool - v_i);
      UPDATE public.luckybox_cases SET prize_pool = v_pool, updated_at = now() WHERE id = v_case.id;
    ELSE
      FOR v_i IN 0..(jsonb_array_length(v_prizes) - 1) LOOP
        v_total_weight := v_total_weight + GREATEST(COALESCE(NULLIF(v_prizes->v_i->>'weight','')::numeric, 1), 0);
      END LOOP;
      IF v_total_weight <= 0 THEN v_total_weight := jsonb_array_length(v_prizes); END IF;
      v_pick := random() * v_total_weight;
      v_acc := 0;
      v_prize_index := 0;
      FOR v_i IN 0..(jsonb_array_length(v_prizes) - 1) LOOP
        v_acc := v_acc + GREATEST(COALESCE(NULLIF(v_prizes->v_i->>'weight','')::numeric, 1), 0);
        IF v_pick <= v_acc THEN v_prize_index := v_i; EXIT; END IF;
      END LOOP;
    END IF;
  END IF;

  v_prize := v_prizes->v_prize_index;
  v_resolved_prize := v_prize;
  v_resolved_label := COALESCE(v_prize->>'label', '');

  IF COALESCE((v_prize->>'scratch')::boolean, false) THEN
    v_scratch_prizes := COALESCE(v_prize->'scratchPrizes', '[]'::jsonb);
    IF jsonb_typeof(v_scratch_prizes) = 'array' AND jsonb_array_length(v_scratch_prizes) > 0 THEN
      IF v_forced_used AND v_forced_entry ? 'scratch_index' THEN
        v_scratch_index := COALESCE(NULLIF(v_forced_entry->>'scratch_index','')::integer, -1);
        IF v_scratch_index < 0 OR v_scratch_index >= jsonb_array_length(v_scratch_prizes) THEN
          v_scratch_index := NULL;
        END IF;
      END IF;
      IF v_scratch_index IS NULL THEN
        v_total_weight := 0;
        FOR v_i IN 0..(jsonb_array_length(v_scratch_prizes) - 1) LOOP
          v_total_weight := v_total_weight + GREATEST(COALESCE(NULLIF(v_scratch_prizes->v_i->>'weight','')::numeric, 1), 0);
        END LOOP;
        IF v_total_weight <= 0 THEN v_total_weight := jsonb_array_length(v_scratch_prizes); END IF;
        v_pick := random() * v_total_weight;
        v_acc := 0;
        v_scratch_index := 0;
        FOR v_i IN 0..(jsonb_array_length(v_scratch_prizes) - 1) LOOP
          v_acc := v_acc + GREATEST(COALESCE(NULLIF(v_scratch_prizes->v_i->>'weight','')::numeric, 1), 0);
          IF v_pick <= v_acc THEN v_scratch_index := v_i; EXIT; END IF;
        END LOOP;
      END IF;
      v_scratch_prize := v_scratch_prizes->v_scratch_index;
      v_resolved_prize := v_scratch_prize;
      v_resolved_label := COALESCE(v_scratch_prize->>'label', v_resolved_label);
    END IF;
  END IF;

  v_amount := COALESCE(NULLIF(v_resolved_prize->>'amount','')::numeric, 0);

  -- Apply token deltas (cost + possibly prize credit) in a single update
  v_token_delta := 0;
  IF NOT v_used_grant THEN
    v_token_delta := v_token_delta - COALESCE(v_case.price_tokens, 0);
  END IF;
  IF v_is_tokens_prize AND v_amount > 0 THEN
    v_token_delta := v_token_delta + v_amount::integer;
  END IF;

  IF v_used_grant THEN
    v_grants := jsonb_set(v_grants, ARRAY[v_case_key], to_jsonb(v_grant_count - 1), true);
    IF (v_grants->>v_case_key)::integer <= 0 THEN v_grants := v_grants - v_case_key; END IF;
    UPDATE public.wheel_users
    SET case_grants = v_grants,
        forced_prize_queue = v_queue,
        tokens_balance = COALESCE(tokens_balance,0) + v_token_delta,
        updated_at = now()
    WHERE id = v_user.id RETURNING tokens_balance INTO v_new_tokens;
  ELSE
    UPDATE public.wheel_users
    SET tokens_balance = COALESCE(tokens_balance,0) + v_token_delta,
        updated_at = now()
    WHERE id = v_user.id RETURNING tokens_balance INTO v_new_tokens;
  END IF;

  -- Only create a PIX payment when this case pays in PIX (not tokens)
  IF v_amount > 0 AND NOT v_is_tokens_prize THEN
    INSERT INTO public.prize_payments (
      owner_id, wheel_user_id, prize, amount, status, user_name, user_email, account_id,
      pix_key, pix_key_type, auto_payment
    ) VALUES (
      p_owner_id, v_user.id, v_resolved_label, v_amount, 'pending',
      COALESCE(v_user.name, ''), COALESCE(v_user.email, ''), COALESCE(v_user.account_id, ''),
      COALESCE(v_user.pix_key, ''), COALESCE(v_user.pix_key_type, ''), COALESCE(v_user.auto_payment, false)
    ) RETURNING id INTO v_payment_id;
  END IF;

  INSERT INTO public.luckybox_openings (
    owner_id, wheel_user_id, case_id, case_name, account_id, user_email, user_name,
    price_tokens, prize_label, prize_amount, prize_image, prize_index, prize_payment_id
  ) VALUES (
    p_owner_id, v_user.id, v_case.id, COALESCE(v_case.name, ''),
    COALESCE(v_user.account_id, ''), COALESCE(v_user.email, ''), COALESCE(v_user.name, ''),
    CASE WHEN v_used_grant THEN 0 ELSE v_case.price_tokens END,
    v_resolved_label, v_amount, COALESCE(v_resolved_prize->>'image', ''), v_prize_index, v_payment_id
  ) RETURNING id INTO v_opening_id;

  RETURN jsonb_build_object(
    'success', true, 'prize', v_prize, 'prize_index', v_prize_index,
    'scratch_prize', v_scratch_prize, 'tokens_balance', v_new_tokens,
    'opening_id', v_opening_id, 'payment_id', v_payment_id,
    'used_grant', v_used_grant, 'case_grants', v_grants,
    'prize_type', COALESCE(v_case.prize_type, 'pix')
  );
END;
$function$;
