
CREATE OR REPLACE FUNCTION public.open_luckybox_case_pool(p_owner_id uuid, p_account_id text, p_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user public.wheel_users%ROWTYPE;
  v_case public.luckybox_cases%ROWTYPE;
  v_pool jsonb;
  v_quantity integer;
  v_items jsonb;
  v_grants jsonb;
  v_case_key text;
  v_grant_count integer;
  v_used_grant boolean := false;
  v_new_tokens integer;
  v_drawn jsonb := '[]'::jsonb;
  v_total_weight numeric;
  v_pick numeric;
  v_acc numeric;
  v_n integer;
  v_i integer;
  v_chosen_id uuid;
  v_chosen_case public.luckybox_cases%ROWTYPE;
BEGIN
  SELECT * INTO v_user FROM public.wheel_users
  WHERE owner_id = p_owner_id AND btrim(account_id) = btrim(p_account_id)
  ORDER BY updated_at DESC NULLS LAST LIMIT 1
  FOR UPDATE;
  IF v_user.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado'); END IF;
  IF COALESCE(v_user.blacklisted, false) THEN RETURN jsonb_build_object('success', false, 'error', 'Conta bloqueada'); END IF;

  SELECT * INTO v_case FROM public.luckybox_cases WHERE id = p_case_id AND owner_id = p_owner_id AND is_active = true FOR UPDATE;
  IF v_case.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Caixa indisponível'); END IF;
  IF v_case.mode <> 'case_pool' THEN RETURN jsonb_build_object('success', false, 'error', 'Modo inválido'); END IF;

  v_pool := COALESCE(v_case.prize_pool, '{}'::jsonb);
  v_quantity := GREATEST(COALESCE(NULLIF(v_pool->>'quantity', '')::integer, 1), 1);
  v_quantity := LEAST(v_quantity, 10);
  v_items := COALESCE(v_pool->'items', '[]'::jsonb);
  IF jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pool de caixas vazio');
  END IF;

  v_grants := COALESCE(v_user.case_grants, '{}'::jsonb);
  v_case_key := v_case.id::text;
  v_grant_count := COALESCE((v_grants->>v_case_key)::integer, 0);
  IF v_grant_count > 0 THEN
    v_used_grant := true;
    IF v_grant_count - 1 <= 0 THEN
      v_grants := v_grants - v_case_key;
    ELSE
      v_grants := jsonb_set(v_grants, ARRAY[v_case_key], to_jsonb(v_grant_count - 1));
    END IF;
  ELSIF COALESCE(v_user.tokens_balance, 0) < v_case.price_tokens THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tokens insuficientes');
  END IF;

  v_total_weight := 0;
  FOR v_i IN 0..(jsonb_array_length(v_items) - 1) LOOP
    v_total_weight := v_total_weight + GREATEST(COALESCE(NULLIF(v_items->v_i->>'weight','')::numeric, 0), 0);
  END LOOP;
  IF v_total_weight <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Pesos inválidos'); END IF;

  FOR v_n IN 1..v_quantity LOOP
    v_pick := random() * v_total_weight;
    v_acc := 0;
    v_chosen_id := NULL;
    FOR v_i IN 0..(jsonb_array_length(v_items) - 1) LOOP
      v_acc := v_acc + GREATEST(COALESCE(NULLIF(v_items->v_i->>'weight','')::numeric, 0), 0);
      IF v_pick <= v_acc THEN
        v_chosen_id := NULLIF(v_items->v_i->>'case_id','')::uuid;
        EXIT;
      END IF;
    END LOOP;
    IF v_chosen_id IS NULL THEN
      v_chosen_id := NULLIF(v_items->0->>'case_id','')::uuid;
    END IF;
    SELECT * INTO v_chosen_case FROM public.luckybox_cases WHERE id = v_chosen_id AND owner_id = p_owner_id;
    IF v_chosen_case.id IS NOT NULL THEN
      v_grants := jsonb_set(
        v_grants,
        ARRAY[v_chosen_case.id::text],
        to_jsonb(COALESCE((v_grants->>v_chosen_case.id::text)::integer, 0) + 1)
      );
      v_drawn := v_drawn || jsonb_build_array(jsonb_build_object(
        'case_id', v_chosen_case.id,
        'name', v_chosen_case.name,
        'image_url', v_chosen_case.image_url,
        'rarity', v_chosen_case.rarity,
        'price_tokens', v_chosen_case.price_tokens
      ));
    END IF;
  END LOOP;

  IF v_used_grant THEN
    UPDATE public.wheel_users
      SET case_grants = v_grants, updated_at = now()
      WHERE id = v_user.id
      RETURNING tokens_balance INTO v_new_tokens;
  ELSE
    UPDATE public.wheel_users
      SET tokens_balance = GREATEST(COALESCE(tokens_balance, 0) - v_case.price_tokens, 0),
          case_grants = v_grants,
          updated_at = now()
      WHERE id = v_user.id
      RETURNING tokens_balance INTO v_new_tokens;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'drawn', v_drawn,
    'tokens_balance', v_new_tokens,
    'case_grants', v_grants,
    'used_grant', v_used_grant
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.open_luckybox_case_pool(uuid, text, uuid) TO anon, authenticated, service_role;
