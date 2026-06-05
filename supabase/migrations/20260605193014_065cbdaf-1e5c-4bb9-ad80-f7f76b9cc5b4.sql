
CREATE OR REPLACE FUNCTION public.claim_luckybox_case(
  p_owner_id uuid,
  p_email text,
  p_account_id text,
  p_case_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user public.wheel_users%ROWTYPE;
  v_case public.luckybox_cases%ROWTYPE;
  v_email text := lower(btrim(p_email));
  v_account text := btrim(p_account_id);
  v_qty integer;
  v_grants jsonb;
  v_case_key text;
  v_current integer;
  v_new_count integer;
  v_last_claim timestamptz;
  v_interval interval;
  v_recurrence text;
  v_next_at timestamptz;
  v_opens_at timestamptz;
  v_closes_at timestamptz;
  v_window_len interval;
  v_cycles integer;
BEGIN
  IF v_email = '' OR v_account = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dados inválidos');
  END IF;

  SELECT * INTO v_case FROM public.luckybox_cases
  WHERE id = p_case_id AND owner_id = p_owner_id AND is_active = true
  FOR UPDATE;
  IF v_case.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Caixa indisponível');
  END IF;

  IF NOT COALESCE(v_case.claim_enabled, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Resgate desativado para esta caixa');
  END IF;

  v_recurrence := COALESCE(v_case.claim_recurrence, 'none');
  v_interval := CASE v_recurrence
    WHEN 'daily' THEN interval '1 day'
    WHEN 'weekly' THEN interval '7 days'
    WHEN 'monthly' THEN interval '30 days'
    ELSE NULL
  END;

  v_opens_at := v_case.claim_opens_at;
  v_closes_at := v_case.claim_closes_at;

  -- With recurrence, shift the configured window forward by full cycles
  -- so that it covers (or is ahead of) "now".
  IF v_interval IS NOT NULL AND v_opens_at IS NOT NULL AND now() > v_opens_at THEN
    IF v_closes_at IS NOT NULL AND v_closes_at > v_opens_at THEN
      v_window_len := v_closes_at - v_opens_at;
    ELSE
      v_window_len := v_interval;
    END IF;
    v_cycles := floor(extract(epoch from (now() - v_opens_at)) / extract(epoch from v_interval))::int;
    v_opens_at := v_opens_at + (v_cycles * v_interval);
    IF v_closes_at IS NOT NULL THEN
      v_closes_at := v_opens_at + v_window_len;
    END IF;
  END IF;

  IF v_opens_at IS NOT NULL AND now() < v_opens_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'Resgate ainda não liberado', 'opens_at', v_opens_at);
  END IF;
  IF v_closes_at IS NOT NULL AND now() > v_closes_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'Resgate encerrado');
  END IF;

  SELECT * INTO v_user FROM public.wheel_users
  WHERE owner_id = p_owner_id
    AND (lower(btrim(email)) = v_email OR btrim(account_id) = v_account)
  ORDER BY updated_at DESC NULLS LAST LIMIT 1
  FOR UPDATE;
  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado');
  END IF;
  IF COALESCE(v_user.blacklisted, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conta bloqueada');
  END IF;

  -- Última claim deste usuário nesta caixa
  SELECT MAX(created_at) INTO v_last_claim
  FROM public.luckybox_case_claims
  WHERE case_id = v_case.id
    AND (lower(user_email) = v_email OR account_id = v_account);

  IF v_last_claim IS NOT NULL THEN
    IF v_recurrence = 'none' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Você já resgatou esta caixa');
    END IF;
    IF v_interval IS NOT NULL AND v_last_claim + v_interval > now() THEN
      v_next_at := v_last_claim + v_interval;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Aguarde para resgatar novamente',
        'next_available_at', v_next_at
      );
    END IF;
  END IF;

  v_qty := GREATEST(1, COALESCE(v_case.claim_quantity, 1));
  v_grants := COALESCE(v_user.case_grants, '{}'::jsonb);
  v_case_key := v_case.id::text;
  v_current := COALESCE((v_grants ->> v_case_key)::int, 0);
  v_new_count := v_current + v_qty;
  v_grants := v_grants || jsonb_build_object(v_case_key, v_new_count);

  UPDATE public.wheel_users
  SET case_grants = v_grants, updated_at = now()
  WHERE id = v_user.id;

  INSERT INTO public.luckybox_case_claims (owner_id, case_id, wheel_user_id, user_email, account_id, quantity)
  VALUES (p_owner_id, v_case.id, v_user.id, v_email, v_account, v_qty);

  RETURN jsonb_build_object(
    'success', true,
    'quantity', v_qty,
    'case_grants', v_grants,
    'last_claim_at', now()
  );
END;
$$;
