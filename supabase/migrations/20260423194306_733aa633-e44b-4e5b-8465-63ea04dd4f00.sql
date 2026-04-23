CREATE OR REPLACE FUNCTION public.decrement_wheel_user_spins(p_account_id text, p_owner_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(spins_available integer, owner_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user public.wheel_users%ROWTYPE;
  v_queue jsonb := '[]'::jsonb;
  v_next_segment integer;
  v_next_spins integer;
BEGIN
  SELECT * INTO v_user
  FROM public.wheel_users wu
  WHERE wu.account_id = p_account_id
    AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
  LIMIT 1;

  IF v_user.id IS NULL THEN
    RETURN;
  END IF;

  v_queue := COALESCE(v_user.fixed_prize_queue, '[]'::jsonb);

  IF jsonb_array_length(v_queue) > 0 THEN
    v_queue := v_queue - 0;
  ELSIF v_user.fixed_prize_enabled = true AND v_user.fixed_prize_segment IS NOT NULL THEN
    v_queue := '[]'::jsonb;
  END IF;

  v_next_spins := GREATEST(COALESCE(v_user.spins_available, 0) - 1, 0);

  IF v_next_spins <= 0 THEN
    v_queue := '[]'::jsonb;
    v_next_segment := NULL;
  ELSE
    v_next_segment := CASE
      WHEN jsonb_array_length(v_queue) > 0 THEN (v_queue->>0)::integer
      ELSE NULL
    END;
  END IF;

  UPDATE public.wheel_users wu
  SET spins_available = v_next_spins,
      fixed_prize_queue = v_queue,
      fixed_prize_enabled = CASE WHEN v_next_segment IS NOT NULL THEN true ELSE false END,
      fixed_prize_segment = v_next_segment,
      updated_at = now()
  WHERE wu.id = v_user.id;

  RETURN QUERY
    SELECT wu.spins_available, wu.owner_id
    FROM public.wheel_users wu
    WHERE wu.id = v_user.id
    LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrement_claimed_spin(p_account_id text, p_owner_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(spins_available integer, owner_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user public.wheel_users%ROWTYPE;
  v_next_spins integer;
BEGIN
  SELECT * INTO v_user
  FROM public.wheel_users wu
  WHERE btrim(wu.account_id) = btrim(p_account_id)
    AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
  ORDER BY wu.updated_at DESC NULLS LAST, wu.created_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF v_user.id IS NULL THEN
    RETURN;
  END IF;

  v_next_spins := GREATEST(COALESCE(v_user.spins_available, 0) - 1, 0);

  UPDATE public.wheel_users wu
  SET spins_available = v_next_spins,
      fixed_prize_queue = CASE WHEN v_next_spins <= 0 THEN '[]'::jsonb ELSE COALESCE(wu.fixed_prize_queue, '[]'::jsonb) END,
      fixed_prize_enabled = CASE
        WHEN v_next_spins <= 0 THEN false
        WHEN jsonb_array_length(COALESCE(wu.fixed_prize_queue, '[]'::jsonb)) > 0 THEN true
        ELSE COALESCE(wu.fixed_prize_enabled, false)
      END,
      fixed_prize_segment = CASE
        WHEN v_next_spins <= 0 THEN NULL
        WHEN jsonb_array_length(COALESCE(wu.fixed_prize_queue, '[]'::jsonb)) > 0 THEN (wu.fixed_prize_queue->>0)::integer
        ELSE wu.fixed_prize_segment
      END,
      updated_at = now()
  WHERE wu.id = v_user.id;

  RETURN QUERY
    SELECT wu.spins_available, wu.owner_id
    FROM public.wheel_users wu
    WHERE wu.id = v_user.id
    LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_wheel_user_spins(p_account_id text, p_owner_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(name text, spins_available integer, owner_id uuid, fixed_prize_enabled boolean, fixed_prize_segment integer, blacklisted boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.wheel_users wu
  SET spins_available = 0,
      fixed_prize_enabled = false,
      fixed_prize_segment = NULL,
      fixed_prize_queue = '[]'::jsonb,
      spins_expire_at = NULL,
      updated_at = now()
  WHERE btrim(wu.account_id) = btrim(p_account_id)
    AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
    AND (
      (wu.spins_expire_at IS NOT NULL AND wu.spins_expire_at <= now() AND wu.spins_available > 0)
      OR (
        COALESCE(wu.spins_available, 0) <= 0
        AND (
          COALESCE(jsonb_array_length(COALESCE(wu.fixed_prize_queue, '[]'::jsonb)), 0) > 0
          OR wu.fixed_prize_enabled = true
          OR wu.fixed_prize_segment IS NOT NULL
        )
      )
    );

  RETURN QUERY
    SELECT wu.name,
           wu.spins_available,
           wu.owner_id,
           CASE
             WHEN jsonb_array_length(COALESCE(wu.fixed_prize_queue, '[]'::jsonb)) > 0 THEN true
             ELSE wu.fixed_prize_enabled
           END AS fixed_prize_enabled,
           CASE
             WHEN jsonb_array_length(COALESCE(wu.fixed_prize_queue, '[]'::jsonb)) > 0 THEN (wu.fixed_prize_queue->>0)::integer
             ELSE wu.fixed_prize_segment
           END AS fixed_prize_segment,
           wu.blacklisted
    FROM public.wheel_users wu
    WHERE btrim(wu.account_id) = btrim(p_account_id)
      AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
    LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.authenticate_wheel_user(p_email text, p_account_id text, p_owner_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, name text, spins_available integer, account_id text, owner_id uuid, fixed_prize_enabled boolean, fixed_prize_segment integer, blacklisted boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user public.wheel_users%ROWTYPE;
BEGIN
  UPDATE public.wheel_users wu
  SET spins_available = 0,
      fixed_prize_enabled = false,
      fixed_prize_segment = NULL,
      fixed_prize_queue = '[]'::jsonb,
      spins_expire_at = NULL,
      updated_at = now()
  WHERE (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
    AND (
      (wu.spins_expire_at IS NOT NULL AND wu.spins_expire_at <= now() AND wu.spins_available > 0)
      OR (
        COALESCE(wu.spins_available, 0) <= 0
        AND (
          COALESCE(jsonb_array_length(COALESCE(wu.fixed_prize_queue, '[]'::jsonb)), 0) > 0
          OR wu.fixed_prize_enabled = true
          OR wu.fixed_prize_segment IS NOT NULL
        )
      )
    )
    AND (
      (lower(btrim(wu.email)) = lower(btrim(p_email)) AND btrim(wu.account_id) = btrim(p_account_id))
      OR btrim(wu.account_id) = btrim(p_account_id)
      OR lower(btrim(wu.email)) = lower(btrim(p_email))
    );

  SELECT * INTO v_user FROM public.wheel_users wu
  WHERE lower(btrim(wu.email)) = lower(btrim(p_email))
    AND btrim(wu.account_id) = btrim(p_account_id)
    AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
  ORDER BY wu.created_at DESC NULLS LAST LIMIT 1;

  IF v_user.id IS NULL THEN
    SELECT * INTO v_user FROM public.wheel_users wu
    WHERE btrim(wu.account_id) = btrim(p_account_id)
      AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
    ORDER BY wu.created_at DESC NULLS LAST LIMIT 1;
  END IF;

  IF v_user.id IS NULL THEN
    SELECT * INTO v_user FROM public.wheel_users wu
    WHERE lower(btrim(wu.email)) = lower(btrim(p_email))
      AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
    ORDER BY wu.created_at DESC NULLS LAST LIMIT 1;
  END IF;

  IF v_user.id IS NULL THEN RETURN; END IF;

  IF lower(btrim(v_user.email)) <> lower(btrim(p_email)) OR btrim(v_user.account_id) <> btrim(p_account_id) THEN
    UPDATE public.wheel_users
    SET email = lower(btrim(p_email)), account_id = btrim(p_account_id), updated_at = now()
    WHERE public.wheel_users.id = v_user.id;
    SELECT * INTO v_user FROM public.wheel_users WHERE public.wheel_users.id = v_user.id;
  END IF;

  RETURN QUERY
  SELECT v_user.id,
         v_user.name,
         v_user.spins_available,
         v_user.account_id,
         v_user.owner_id,
         CASE
           WHEN jsonb_array_length(COALESCE(v_user.fixed_prize_queue, '[]'::jsonb)) > 0 THEN true
           ELSE v_user.fixed_prize_enabled
         END,
         CASE
           WHEN jsonb_array_length(COALESCE(v_user.fixed_prize_queue, '[]'::jsonb)) > 0 THEN (v_user.fixed_prize_queue->>0)::integer
           ELSE v_user.fixed_prize_segment
         END,
         v_user.blacklisted;
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
  v_wc_config jsonb;
  v_expiration_minutes integer;
  v_expire_at timestamptz;
  v_fixed_queue jsonb := '[]'::jsonb;
  v_existing_queue jsonb := '[]'::jsonb;
  v_combined_queue jsonb := '[]'::jsonb;
  v_first_segment integer := NULL;
  v_total_segments integer := 0;
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
  v_total_segments := COALESCE(jsonb_array_length(COALESCE(v_wc_config->'segments', '[]'::jsonb)), 0);
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

  v_fixed_queue := public.build_fixed_prize_queue(
    v_link.fixed_prize_plan,
    v_link.spins_per_registration,
    NULLIF(v_total_segments, 0),
    v_link.fixed_prize_segments,
    v_link.fixed_prize_segment,
    COALESCE(v_wc_config->'segments', '[]'::jsonb)
  );

  v_existing_queue := CASE
    WHEN COALESCE(v_user.spins_available, 0) > 0 AND jsonb_array_length(COALESCE(v_user.fixed_prize_queue, '[]'::jsonb)) > 0 THEN COALESCE(v_user.fixed_prize_queue, '[]'::jsonb)
    WHEN COALESCE(v_user.spins_available, 0) > 0 AND v_user.fixed_prize_enabled = true AND v_user.fixed_prize_segment IS NOT NULL THEN jsonb_build_array(v_user.fixed_prize_segment)
    ELSE '[]'::jsonb
  END;

  v_combined_queue := v_existing_queue || COALESCE(v_fixed_queue, '[]'::jsonb);
  v_first_segment := CASE
    WHEN jsonb_array_length(v_combined_queue) > 0 THEN (v_combined_queue->>0)::integer
    ELSE NULL
  END;

  UPDATE public.wheel_users
  SET spins_available = GREATEST(COALESCE(CASE WHEN COALESCE(v_user.spins_available, 0) > 0 THEN public.wheel_users.spins_available ELSE 0 END, 0), 0) + v_link.spins_per_registration,
      fixed_prize_enabled = CASE WHEN v_first_segment IS NOT NULL THEN true ELSE false END,
      fixed_prize_segment = v_first_segment,
      fixed_prize_queue = v_combined_queue,
      auto_payment = CASE WHEN v_link.auto_payment THEN true ELSE public.wheel_users.auto_payment END,
      phone = CASE WHEN btrim(p_phone) != '' THEN btrim(p_phone) ELSE public.wheel_users.phone END,
      pix_key = CASE WHEN btrim(p_pix_key) != '' THEN btrim(p_pix_key) ELSE public.wheel_users.pix_key END,
      pix_key_type = CASE WHEN btrim(p_pix_key_type) != '' THEN btrim(p_pix_key_type) ELSE public.wheel_users.pix_key_type END,
      spins_expire_at = CASE WHEN v_expire_at IS NOT NULL THEN v_expire_at ELSE public.wheel_users.spins_expire_at END,
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

UPDATE public.wheel_users
SET fixed_prize_queue = '[]'::jsonb,
    fixed_prize_enabled = false,
    fixed_prize_segment = NULL,
    updated_at = now()
WHERE COALESCE(spins_available, 0) <= 0
  AND (
    COALESCE(jsonb_array_length(COALESCE(fixed_prize_queue, '[]'::jsonb)), 0) > 0
    OR fixed_prize_enabled = true
    OR fixed_prize_segment IS NOT NULL
  );