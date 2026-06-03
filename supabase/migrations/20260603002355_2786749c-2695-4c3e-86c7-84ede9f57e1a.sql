ALTER TABLE public.luckybox_grants
  ADD COLUMN IF NOT EXISTS one_per_day boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.redeem_luckybox_grant(
  p_owner_id uuid,
  p_account_id text,
  p_email text,
  p_code text,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_region text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_device text DEFAULT NULL,
  p_os text DEFAULT NULL,
  p_browser text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_grant public.luckybox_grants%ROWTYPE;
  v_user public.wheel_users%ROWTYPE;
  v_grants jsonb;
  v_current integer;
  v_case_key text;
  v_queue jsonb;
  v_existing jsonb;
  v_forced jsonb;
  v_dup_count integer;
  v_day_start timestamptz;
BEGIN
  SELECT * INTO v_grant FROM public.luckybox_grants
  WHERE upper(btrim(code)) = upper(btrim(p_code))
    AND owner_id = p_owner_id
  FOR UPDATE;

  IF v_grant.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código inválido');
  END IF;
  IF v_grant.status = 'redeemed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código já utilizado');
  END IF;
  IF v_grant.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código cancelado');
  END IF;

  SELECT * INTO v_user FROM public.wheel_users
  WHERE owner_id = p_owner_id
    AND btrim(account_id) = btrim(p_account_id)
    AND lower(btrim(email)) = lower(btrim(p_email))
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conta não encontrada para este código');
  END IF;
  IF v_grant.wheel_user_id IS NOT NULL AND v_grant.wheel_user_id <> v_user.id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este código não é seu');
  END IF;

  IF v_grant.one_per_user = true AND v_grant.batch_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_dup_count FROM public.luckybox_grants
    WHERE batch_id = v_grant.batch_id
      AND status = 'redeemed'
      AND id <> v_grant.id
      AND (
        wheel_user_id = v_user.id
        OR lower(btrim(recipient_email)) = lower(btrim(p_email))
        OR btrim(recipient_account_id) = btrim(p_account_id)
      );
    IF v_dup_count > 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Você já resgatou um código deste lote');
    END IF;
  END IF;

  IF v_grant.one_per_day = true AND v_grant.batch_id IS NOT NULL THEN
    -- Day boundary based on America/Sao_Paulo (resets at 00h Brasília)
    v_day_start := date_trunc('day', (now() AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo';
    SELECT COUNT(*) INTO v_dup_count FROM public.luckybox_grants
    WHERE batch_id = v_grant.batch_id
      AND status = 'redeemed'
      AND id <> v_grant.id
      AND redeemed_at >= v_day_start
      AND (
        wheel_user_id = v_user.id
        OR lower(btrim(recipient_email)) = lower(btrim(p_email))
        OR btrim(recipient_account_id) = btrim(p_account_id)
      );
    IF v_dup_count > 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Você já resgatou um código deste lote hoje. Tente novamente após 00h.');
    END IF;
  END IF;

  v_grants := COALESCE(v_user.case_grants, '{}'::jsonb);
  v_case_key := v_grant.case_id::text;
  v_current := COALESCE((v_grants->>v_case_key)::integer, 0);
  v_grants := jsonb_set(v_grants, ARRAY[v_case_key], to_jsonb(v_current + GREATEST(v_grant.quantity, 1)), true);

  v_queue := COALESCE(v_user.forced_prize_queue, '{}'::jsonb);
  v_forced := COALESCE(v_grant.forced_prizes, '[]'::jsonb);
  IF jsonb_typeof(v_forced) = 'array' AND jsonb_array_length(v_forced) > 0 THEN
    v_existing := COALESCE(v_queue->v_case_key, '[]'::jsonb);
    v_existing := v_existing || v_forced;
    v_queue := jsonb_set(v_queue, ARRAY[v_case_key], v_existing, true);
  END IF;

  UPDATE public.wheel_users
  SET case_grants = v_grants, forced_prize_queue = v_queue, updated_at = now()
  WHERE id = v_user.id;

  UPDATE public.luckybox_grants
  SET status = 'redeemed', redeemed_at = now(),
      wheel_user_id = COALESCE(wheel_user_id, v_user.id),
      recipient_email = CASE WHEN COALESCE(recipient_email,'') = '' THEN p_email ELSE recipient_email END,
      recipient_account_id = CASE WHEN COALESCE(recipient_account_id,'') = '' THEN p_account_id ELSE recipient_account_id END,
      redeemed_ip = COALESCE(p_ip, redeemed_ip),
      redeemed_user_agent = COALESCE(p_user_agent, redeemed_user_agent),
      redeemed_city = COALESCE(p_city, redeemed_city),
      redeemed_region = COALESCE(p_region, redeemed_region),
      redeemed_country = COALESCE(p_country, redeemed_country),
      redeemed_device = COALESCE(p_device, redeemed_device),
      redeemed_os = COALESCE(p_os, redeemed_os),
      redeemed_browser = COALESCE(p_browser, redeemed_browser),
      updated_at = now()
  WHERE id = v_grant.id;

  RETURN jsonb_build_object(
    'success', true, 'case_id', v_grant.case_id, 'case_name', v_grant.case_name,
    'quantity', v_grant.quantity, 'case_grants', v_grants
  );
END;
$function$;