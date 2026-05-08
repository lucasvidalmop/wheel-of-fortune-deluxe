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
  v_payment jsonb;
  v_payment_id uuid;
  v_opening_id uuid;
  v_scratch_prizes jsonb;
  v_scratch_prize jsonb := NULL;
  v_scratch_index integer := NULL;
  v_resolved_prize jsonb;
  v_resolved_label text;
BEGIN
  SELECT * INTO v_user FROM public.wheel_users
  WHERE owner_id = p_owner_id AND btrim(account_id) = btrim(p_account_id)
  ORDER BY updated_at DESC NULLS LAST LIMIT 1
  FOR UPDATE;

  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado');
  END IF;

  IF COALESCE(v_user.blacklisted, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conta bloqueada');
  END IF;

  SELECT * INTO v_case FROM public.luckybox_cases
  WHERE id = p_case_id AND owner_id = p_owner_id AND is_active = true
  FOR UPDATE;

  IF v_case.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Caixa indisponível');
  END IF;

  IF COALESCE(v_user.tokens_balance, 0) < v_case.price_tokens THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tokens insuficientes');
  END IF;

  v_prizes := COALESCE(v_case.prizes, '[]'::jsonb);
  IF jsonb_typeof(v_prizes) <> 'array' OR jsonb_array_length(v_prizes) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Caixa sem prêmios configurados');
  END IF;

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
    v_prize_index := (v_pool->>v_i)::integer;

    v_pool := (
      SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
      FROM jsonb_array_elements(v_pool) WITH ORDINALITY arr(value, idx)
      WHERE idx <> (v_i + 1)
    );
    UPDATE public.luckybox_cases SET prize_pool = v_pool, updated_at = now() WHERE id = v_case.id;
  ELSE
    FOR v_i IN 0..(jsonb_array_length(v_prizes) - 1) LOOP
      v_total_weight := v_total_weight + GREATEST(COALESCE(NULLIF(v_prizes->v_i->>'weight', '')::numeric, 1), 0);
    END LOOP;
    IF v_total_weight <= 0 THEN
      v_total_weight := jsonb_array_length(v_prizes);
    END IF;
    v_pick := random() * v_total_weight;
    v_prize_index := 0;
    FOR v_i IN 0..(jsonb_array_length(v_prizes) - 1) LOOP
      v_acc := v_acc + GREATEST(COALESCE(NULLIF(v_prizes->v_i->>'weight', '')::numeric, 1), 0);
      IF v_pick <= v_acc THEN
        v_prize_index := v_i;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  v_prize := v_prizes->v_prize_index;

  -- Mystery scratch card: pick a sub-prize using its own weights
  IF COALESCE((v_prize->>'scratch')::boolean, false) THEN
    v_scratch_prizes := COALESCE(v_prize->'scratchPrizes', '[]'::jsonb);
    IF jsonb_typeof(v_scratch_prizes) = 'array' AND jsonb_array_length(v_scratch_prizes) > 0 THEN
      v_total_weight := 0;
      v_acc := 0;
      FOR v_i IN 0..(jsonb_array_length(v_scratch_prizes) - 1) LOOP
        v_total_weight := v_total_weight + GREATEST(COALESCE(NULLIF(v_scratch_prizes->v_i->>'weight', '')::numeric, 1), 0);
      END LOOP;
      IF v_total_weight <= 0 THEN
        v_total_weight := jsonb_array_length(v_scratch_prizes);
      END IF;
      v_pick := random() * v_total_weight;
      v_scratch_index := 0;
      FOR v_i IN 0..(jsonb_array_length(v_scratch_prizes) - 1) LOOP
        v_acc := v_acc + GREATEST(COALESCE(NULLIF(v_scratch_prizes->v_i->>'weight', '')::numeric, 1), 0);
        IF v_pick <= v_acc THEN
          v_scratch_index := v_i;
          EXIT;
        END IF;
      END LOOP;
      v_scratch_prize := v_scratch_prizes->v_scratch_index;
    END IF;
  END IF;

  v_resolved_prize := COALESCE(v_scratch_prize, v_prize);
  v_resolved_label := COALESCE(v_resolved_prize->>'label', 'Prêmio');
  v_amount := COALESCE(NULLIF(v_resolved_prize->>'amount', '')::numeric, 0);

  UPDATE public.wheel_users
  SET tokens_balance = GREATEST(COALESCE(tokens_balance, 0) - v_case.price_tokens, 0),
      updated_at = now()
  WHERE id = v_user.id;

  IF v_amount > 0 THEN
    v_payment := public.create_prize_payment(
      p_owner_id := p_owner_id,
      p_account_id := v_user.account_id,
      p_user_name := COALESCE(v_user.name, ''),
      p_user_email := COALESCE(v_user.email, ''),
      p_prize := v_resolved_label,
      p_amount := v_amount,
      p_spin_result_id := NULL
    );
    v_payment_id := (v_payment->>'id')::uuid;
  END IF;

  INSERT INTO public.luckybox_openings (
    owner_id, wheel_user_id, case_id, case_name, account_id,
    user_email, user_name, price_tokens, prize_label, prize_amount,
    prize_image, prize_index, prize_payment_id
  ) VALUES (
    p_owner_id, v_user.id, v_case.id, v_case.name, v_user.account_id,
    v_user.email, COALESCE(v_user.name, ''), v_case.price_tokens,
    v_resolved_label, v_amount,
    COALESCE(v_resolved_prize->>'image', ''), v_prize_index, v_payment_id
  ) RETURNING id INTO v_opening_id;

  RETURN jsonb_build_object(
    'success', true,
    'opening_id', v_opening_id,
    'prize_index', v_prize_index,
    'prize', v_prize,
    'scratch_index', v_scratch_index,
    'scratch_prize', v_scratch_prize,
    'tokens_balance', GREATEST(COALESCE(v_user.tokens_balance, 0) - v_case.price_tokens, 0),
    'payment_id', v_payment_id,
    'auto_paid', COALESCE((v_payment->>'auto_payment')::boolean, false)
  );
END;
$function$;