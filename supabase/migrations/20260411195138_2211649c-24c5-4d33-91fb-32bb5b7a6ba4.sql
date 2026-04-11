CREATE OR REPLACE FUNCTION public.authenticate_wheel_user(p_email text, p_account_id text, p_owner_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, name text, spins_available integer, account_id text, owner_id uuid, fixed_prize_enabled boolean, fixed_prize_segment integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user public.wheel_users%ROWTYPE;
BEGIN
  -- Auto-expire spins for exact or fallback matches within the same owner
  UPDATE public.wheel_users wu
  SET spins_available = 0,
      fixed_prize_enabled = false,
      fixed_prize_segment = NULL,
      spins_expire_at = NULL,
      updated_at = now()
  WHERE (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
    AND wu.spins_expire_at IS NOT NULL
    AND wu.spins_expire_at <= now()
    AND wu.spins_available > 0
    AND (
      (lower(btrim(wu.email)) = lower(btrim(p_email)) AND btrim(wu.account_id) = btrim(p_account_id))
      OR btrim(wu.account_id) = btrim(p_account_id)
      OR lower(btrim(wu.email)) = lower(btrim(p_email))
    );

  -- 1) Exact match: email + account id
  SELECT * INTO v_user
  FROM public.wheel_users wu
  WHERE lower(btrim(wu.email)) = lower(btrim(p_email))
    AND btrim(wu.account_id) = btrim(p_account_id)
    AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
  ORDER BY wu.created_at DESC NULLS LAST
  LIMIT 1;

  -- 2) Fallback by account id
  IF v_user.id IS NULL THEN
    SELECT * INTO v_user
    FROM public.wheel_users wu
    WHERE btrim(wu.account_id) = btrim(p_account_id)
      AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
    ORDER BY wu.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  -- 3) Fallback by email
  IF v_user.id IS NULL THEN
    SELECT * INTO v_user
    FROM public.wheel_users wu
    WHERE lower(btrim(wu.email)) = lower(btrim(p_email))
      AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
    ORDER BY wu.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_user.id IS NULL THEN
    RETURN;
  END IF;

  -- Keep registration data aligned with what the user typed when the row was found by fallback
  IF lower(btrim(v_user.email)) <> lower(btrim(p_email)) OR btrim(v_user.account_id) <> btrim(p_account_id) THEN
    UPDATE public.wheel_users
    SET email = lower(btrim(p_email)),
        account_id = btrim(p_account_id),
        updated_at = now()
    WHERE id = v_user.id;

    SELECT * INTO v_user
    FROM public.wheel_users
    WHERE id = v_user.id;
  END IF;

  RETURN QUERY
  SELECT v_user.id,
         v_user.name,
         v_user.spins_available,
         v_user.account_id,
         v_user.owner_id,
         v_user.fixed_prize_enabled,
         v_user.fixed_prize_segment;
END;
$function$;

CREATE OR REPLACE FUNCTION public.register_via_referral(p_code text, p_email text, p_account_id text, p_name text DEFAULT ''::text, p_cpf text DEFAULT ''::text, p_phone text DEFAULT ''::text, p_pix_key text DEFAULT ''::text, p_pix_key_type text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_link referral_links%ROWTYPE;
  v_user wheel_users%ROWTYPE;
  v_slug text;
  v_cpf_clean text;
  v_exists boolean;
  v_segments jsonb;
  v_chosen_segment integer;
  v_expiration_minutes integer;
  v_expire_at timestamptz;
  v_wc_config jsonb;
BEGIN
  v_cpf_clean := btrim(p_cpf);

  SELECT * INTO v_link FROM public.referral_links WHERE code = btrim(p_code) AND is_active = true;
  IF v_link.id IS NULL THEN
    SELECT * INTO v_link FROM public.referral_links WHERE code = upper(btrim(p_code)) AND is_active = true;
  END IF;

  IF v_link.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link inválido ou desativado');
  END IF;

  IF v_link.expires_at IS NOT NULL AND v_link.expires_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'O prazo desta promoção expirou.');
  END IF;

  IF v_link.max_registrations IS NOT NULL AND v_link.registrations_count >= v_link.max_registrations THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este link atingiu o limite máximo de resgates');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.referral_redemptions WHERE referral_link_id = v_link.id AND lower(btrim(email)) = lower(btrim(p_email))) INTO v_exists;
  IF v_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este e-mail já resgatou um giro neste link.');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.referral_redemptions WHERE referral_link_id = v_link.id AND btrim(account_id) = btrim(p_account_id)) INTO v_exists;
  IF v_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este ID já resgatou um giro neste link.');
  END IF;

  IF v_cpf_clean != '' THEN
    SELECT EXISTS(SELECT 1 FROM public.referral_redemptions WHERE referral_link_id = v_link.id AND btrim(cpf) = v_cpf_clean AND cpf != '') INTO v_exists;
    IF v_exists THEN
      RETURN jsonb_build_object('success', false, 'error', 'Este CPF já resgatou um giro neste link.');
    END IF;
  END IF;

  SELECT wc.config INTO v_wc_config FROM public.wheel_configs wc WHERE wc.user_id = v_link.owner_id LIMIT 1;
  v_expiration_minutes := COALESCE((v_wc_config->>'spinExpirationMinutes')::integer, 0);
  IF v_expiration_minutes > 0 THEN
    v_expire_at := now() + (v_expiration_minutes || ' minutes')::interval;
  ELSE
    v_expire_at := NULL;
  END IF;

  SELECT * INTO v_user FROM public.wheel_users
  WHERE lower(btrim(email)) = lower(btrim(p_email))
    AND btrim(account_id) = btrim(p_account_id)
    AND owner_id = v_link.owner_id;

  IF v_user.id IS NULL THEN
    SELECT * INTO v_user FROM public.wheel_users
    WHERE btrim(account_id) = btrim(p_account_id)
      AND owner_id = v_link.owner_id
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_user.id IS NULL THEN
    SELECT * INTO v_user FROM public.wheel_users
    WHERE lower(btrim(email)) = lower(btrim(p_email))
      AND owner_id = v_link.owner_id
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_user.id IS NULL THEN
    INSERT INTO public.wheel_users (
      name, email, account_id, owner_id, phone,
      pix_key, pix_key_type, spins_available, referral_link_id,
      user_type, responsible, spins_expire_at
    ) VALUES (
      COALESCE(NULLIF(btrim(p_name), ''), 'Usuário'),
      lower(btrim(p_email)),
      btrim(p_account_id),
      v_link.owner_id,
      COALESCE(btrim(p_phone), ''),
      COALESCE(btrim(p_pix_key), ''),
      COALESCE(btrim(p_pix_key_type), ''),
      0,
      v_link.id,
      'Real',
      btrim(p_code),
      v_expire_at
    )
    RETURNING * INTO v_user;
  ELSE
    UPDATE public.wheel_users
    SET email = lower(btrim(p_email)),
        account_id = btrim(p_account_id),
        name = COALESCE(NULLIF(btrim(p_name), ''), public.wheel_users.name),
        phone = CASE WHEN btrim(p_phone) <> '' THEN btrim(p_phone) ELSE public.wheel_users.phone END,
        pix_key = CASE WHEN btrim(p_pix_key) <> '' THEN btrim(p_pix_key) ELSE public.wheel_users.pix_key END,
        pix_key_type = CASE WHEN btrim(p_pix_key_type) <> '' THEN btrim(p_pix_key_type) ELSE public.wheel_users.pix_key_type END,
        referral_link_id = COALESCE(public.wheel_users.referral_link_id, v_link.id),
        updated_at = now()
    WHERE id = v_user.id
    RETURNING * INTO v_user;
  END IF;

  v_segments := v_link.fixed_prize_segments;
  IF v_segments IS NULL AND v_link.fixed_prize_segment IS NOT NULL THEN
    v_segments := jsonb_build_array(v_link.fixed_prize_segment);
  END IF;

  IF v_segments IS NOT NULL AND jsonb_array_length(v_segments) > 0 THEN
    v_chosen_segment := (v_segments->(floor(random() * jsonb_array_length(v_segments))::int))::int;
  ELSE
    v_chosen_segment := NULL;
  END IF;

  UPDATE public.wheel_users
  SET spins_available = spins_available + v_link.spins_per_registration,
      fixed_prize_enabled = CASE WHEN v_chosen_segment IS NOT NULL THEN true ELSE fixed_prize_enabled END,
      fixed_prize_segment = CASE WHEN v_chosen_segment IS NOT NULL THEN v_chosen_segment ELSE wheel_users.fixed_prize_segment END,
      auto_payment = CASE WHEN v_link.auto_payment THEN true ELSE wheel_users.auto_payment END,
      phone = CASE WHEN btrim(p_phone) != '' THEN btrim(p_phone) ELSE wheel_users.phone END,
      pix_key = CASE WHEN btrim(p_pix_key) != '' THEN btrim(p_pix_key) ELSE wheel_users.pix_key END,
      pix_key_type = CASE WHEN btrim(p_pix_key_type) != '' THEN btrim(p_pix_key_type) ELSE wheel_users.pix_key_type END,
      spins_expire_at = CASE WHEN v_expire_at IS NOT NULL THEN v_expire_at ELSE wheel_users.spins_expire_at END,
      updated_at = now()
  WHERE id = v_user.id;

  INSERT INTO public.referral_redemptions (referral_link_id, email, account_id, cpf)
  VALUES (v_link.id, lower(btrim(p_email)), btrim(p_account_id), v_cpf_clean);

  UPDATE public.referral_links SET registrations_count = registrations_count + 1, updated_at = now() WHERE id = v_link.id;

  SELECT slug INTO v_slug FROM public.wheel_configs WHERE user_id = v_link.owner_id LIMIT 1;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user.id,
    'wheel_user_id', v_user.id,
    'spins', v_link.spins_per_registration,
    'name', v_user.name,
    'slug', v_slug,
    'owner_id', v_link.owner_id,
    'label', v_link.label
  );
END;
$function$;