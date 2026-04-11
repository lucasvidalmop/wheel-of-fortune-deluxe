
-- Update create_prize_payment (version with p_force_auto) to check auto payment cooldown
CREATE OR REPLACE FUNCTION public.create_prize_payment(p_owner_id uuid, p_account_id text DEFAULT ''::text, p_user_name text DEFAULT ''::text, p_user_email text DEFAULT ''::text, p_prize text DEFAULT ''::text, p_amount numeric DEFAULT 0, p_spin_result_id uuid DEFAULT NULL::uuid, p_force_auto boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_status text;
  v_wu_id uuid;
  v_pix_key text;
  v_pix_key_type text;
  v_auto_payment boolean;
  v_cooldown_minutes integer;
  v_wc_config jsonb;
  v_last_auto_at timestamptz;
  v_cooldown_blocked boolean := false;
BEGIN
  SELECT wu.id, wu.pix_key, wu.pix_key_type, wu.auto_payment
  INTO v_wu_id, v_pix_key, v_pix_key_type, v_auto_payment
  FROM public.wheel_users wu
  WHERE wu.account_id = p_account_id
    AND wu.owner_id = p_owner_id
  LIMIT 1;

  -- Check auto payment cooldown from wheel_configs
  IF COALESCE(v_auto_payment, false) OR p_force_auto THEN
    SELECT wc.config INTO v_wc_config FROM public.wheel_configs wc WHERE wc.user_id = p_owner_id LIMIT 1;
    v_cooldown_minutes := COALESCE((v_wc_config->>'autoPaymentCooldownMinutes')::integer, 0);

    IF v_cooldown_minutes > 0 THEN
      SELECT MAX(pp.created_at) INTO v_last_auto_at
      FROM public.prize_payments pp
      WHERE pp.account_id = p_account_id
        AND pp.owner_id = p_owner_id
        AND pp.auto_payment = true
        AND pp.status IN ('auto_pending', 'paid');

      IF v_last_auto_at IS NOT NULL AND v_last_auto_at + (v_cooldown_minutes || ' minutes')::interval > now() THEN
        v_cooldown_blocked := true;
      END IF;
    END IF;
  END IF;

  IF (COALESCE(v_auto_payment, false) OR p_force_auto) AND NOT v_cooldown_blocked THEN
    v_status := 'auto_pending';
    v_auto_payment := true;
  ELSE
    v_status := 'pending';
    IF v_cooldown_blocked THEN
      v_auto_payment := false;
    END IF;
  END IF;

  INSERT INTO public.prize_payments (
    owner_id, wheel_user_id, spin_result_id, account_id,
    user_name, user_email, prize, amount,
    pix_key, pix_key_type, auto_payment, status
  ) VALUES (
    p_owner_id, v_wu_id, p_spin_result_id, p_account_id,
    p_user_name, p_user_email, p_prize, p_amount,
    COALESCE(v_pix_key, ''), COALESCE(v_pix_key_type, ''),
    COALESCE(v_auto_payment, false), v_status
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'auto_payment', COALESCE(v_auto_payment, false),
    'cooldown_blocked', v_cooldown_blocked
  );
END;
$function$;

-- Also update the simpler overload without p_force_auto
CREATE OR REPLACE FUNCTION public.create_prize_payment(p_owner_id uuid, p_account_id text DEFAULT ''::text, p_user_name text DEFAULT ''::text, p_user_email text DEFAULT ''::text, p_prize text DEFAULT ''::text, p_amount numeric DEFAULT 0, p_spin_result_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_status text;
  v_wu_id uuid;
  v_pix_key text;
  v_pix_key_type text;
  v_auto_payment boolean;
  v_cooldown_minutes integer;
  v_wc_config jsonb;
  v_last_auto_at timestamptz;
  v_cooldown_blocked boolean := false;
BEGIN
  SELECT wu.id, wu.pix_key, wu.pix_key_type, wu.auto_payment
  INTO v_wu_id, v_pix_key, v_pix_key_type, v_auto_payment
  FROM public.wheel_users wu
  WHERE wu.account_id = p_account_id
    AND wu.owner_id = p_owner_id
  LIMIT 1;

  IF COALESCE(v_auto_payment, false) THEN
    SELECT wc.config INTO v_wc_config FROM public.wheel_configs wc WHERE wc.user_id = p_owner_id LIMIT 1;
    v_cooldown_minutes := COALESCE((v_wc_config->>'autoPaymentCooldownMinutes')::integer, 0);

    IF v_cooldown_minutes > 0 THEN
      SELECT MAX(pp.created_at) INTO v_last_auto_at
      FROM public.prize_payments pp
      WHERE pp.account_id = p_account_id
        AND pp.owner_id = p_owner_id
        AND pp.auto_payment = true
        AND pp.status IN ('auto_pending', 'paid');

      IF v_last_auto_at IS NOT NULL AND v_last_auto_at + (v_cooldown_minutes || ' minutes')::interval > now() THEN
        v_cooldown_blocked := true;
      END IF;
    END IF;
  END IF;

  IF COALESCE(v_auto_payment, false) AND NOT v_cooldown_blocked THEN
    v_status := 'auto_pending';
  ELSE
    v_status := 'pending';
    IF v_cooldown_blocked THEN
      v_auto_payment := false;
    END IF;
  END IF;

  INSERT INTO public.prize_payments (
    owner_id, wheel_user_id, spin_result_id, account_id,
    user_name, user_email, prize, amount,
    pix_key, pix_key_type, auto_payment, status
  ) VALUES (
    p_owner_id, v_wu_id, p_spin_result_id, p_account_id,
    p_user_name, p_user_email, p_prize, p_amount,
    COALESCE(v_pix_key, ''), COALESCE(v_pix_key_type, ''),
    COALESCE(v_auto_payment, false), v_status
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'auto_payment', COALESCE(v_auto_payment, false),
    'cooldown_blocked', v_cooldown_blocked
  );
END;
$function$;
