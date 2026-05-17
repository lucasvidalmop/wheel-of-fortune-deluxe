-- 1) Add cpf to wheel_users
ALTER TABLE public.wheel_users ADD COLUMN IF NOT EXISTS cpf TEXT NOT NULL DEFAULT '';

-- 2) Backfill from referral_redemptions (most recent non-empty cpf per email+owner)
UPDATE public.wheel_users wu
SET cpf = sub.cpf
FROM (
  SELECT DISTINCT ON (lower(btrim(email)), owner_id)
    lower(btrim(email)) AS email, owner_id, regexp_replace(coalesce(cpf, ''), '\D', '', 'g') AS cpf
  FROM public.referral_redemptions
  WHERE coalesce(cpf, '') <> ''
  ORDER BY lower(btrim(email)), owner_id, created_at DESC
) sub
WHERE lower(wu.email) = sub.email
  AND wu.owner_id = sub.owner_id
  AND coalesce(wu.cpf, '') = '';

-- 3) Update register_via_gorjeta to also save cpf to wheel_users
CREATE OR REPLACE FUNCTION public.register_via_gorjeta(
  p_code text, p_email text, p_account_id text,
  p_name text DEFAULT ''::text, p_cpf text DEFAULT ''::text,
  p_phone text DEFAULT ''::text, p_pix_key text DEFAULT ''::text, p_pix_key_type text DEFAULT ''::text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_link referral_links%ROWTYPE;
  v_user wheel_users%ROWTYPE;
  v_slug text;
  v_cpf_clean text;
  v_exists boolean;
BEGIN
  v_cpf_clean := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');

  SELECT * INTO v_link FROM public.referral_links WHERE code = btrim(p_code) AND is_active = true;
  IF v_link.id IS NULL THEN
    SELECT * INTO v_link FROM public.referral_links WHERE code = upper(btrim(p_code)) AND is_active = true;
  END IF;
  IF v_link.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Link inválido ou desativado'); END IF;
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'O prazo desta promoção expirou.');
  END IF;
  IF v_link.max_registrations IS NOT NULL AND v_link.registrations_count >= v_link.max_registrations THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este link atingiu o limite máximo de resgates');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.referral_redemptions WHERE referral_link_id = v_link.id AND lower(btrim(email)) = lower(btrim(p_email))) INTO v_exists;
  IF v_exists THEN RETURN jsonb_build_object('success', false, 'error', 'Este e-mail já foi inscrito neste link.'); END IF;

  SELECT EXISTS(SELECT 1 FROM public.referral_redemptions WHERE referral_link_id = v_link.id AND btrim(account_id) = btrim(p_account_id)) INTO v_exists;
  IF v_exists THEN RETURN jsonb_build_object('success', false, 'error', 'Este ID já foi inscrito neste link.'); END IF;

  IF v_cpf_clean <> '' THEN
    SELECT EXISTS(SELECT 1 FROM public.referral_redemptions WHERE referral_link_id = v_link.id AND regexp_replace(coalesce(cpf,''), '\D', '', 'g') = v_cpf_clean AND cpf <> '') INTO v_exists;
    IF v_exists THEN RETURN jsonb_build_object('success', false, 'error', 'Este CPF já foi inscrito neste link.'); END IF;
  END IF;

  SELECT * INTO v_user FROM public.wheel_users
   WHERE lower(btrim(email)) = lower(btrim(p_email)) AND btrim(account_id) = btrim(p_account_id) AND owner_id = v_link.owner_id;
  IF v_user.id IS NULL THEN
    SELECT * INTO v_user FROM public.wheel_users
     WHERE btrim(account_id) = btrim(p_account_id) AND owner_id = v_link.owner_id
     ORDER BY created_at DESC NULLS LAST LIMIT 1;
  END IF;
  IF v_user.id IS NULL THEN
    SELECT * INTO v_user FROM public.wheel_users
     WHERE lower(btrim(email)) = lower(btrim(p_email)) AND owner_id = v_link.owner_id
     ORDER BY created_at DESC NULLS LAST LIMIT 1;
  END IF;

  IF v_user.id IS NULL THEN
    INSERT INTO public.wheel_users (
      name, email, account_id, owner_id, phone, cpf,
      pix_key, pix_key_type, spins_available, referral_link_id, user_type, responsible
    ) VALUES (
      COALESCE(NULLIF(btrim(p_name), ''), 'Usuário'),
      lower(btrim(p_email)),
      btrim(p_account_id),
      v_link.owner_id,
      COALESCE(btrim(p_phone), ''),
      v_cpf_clean,
      COALESCE(btrim(p_pix_key), ''),
      COALESCE(btrim(p_pix_key_type), ''),
      0, v_link.id, 'Real', btrim(p_code)
    ) RETURNING * INTO v_user;
  ELSE
    UPDATE public.wheel_users
    SET email = lower(btrim(p_email)),
        account_id = btrim(p_account_id),
        name = COALESCE(NULLIF(btrim(p_name), ''), public.wheel_users.name),
        phone = CASE WHEN btrim(p_phone) <> '' THEN btrim(p_phone) ELSE public.wheel_users.phone END,
        cpf = CASE WHEN v_cpf_clean <> '' THEN v_cpf_clean ELSE public.wheel_users.cpf END,
        pix_key = CASE WHEN btrim(p_pix_key) <> '' THEN btrim(p_pix_key) ELSE public.wheel_users.pix_key END,
        pix_key_type = CASE WHEN btrim(p_pix_key_type) <> '' THEN btrim(p_pix_key_type) ELSE public.wheel_users.pix_key_type END,
        auto_payment = CASE WHEN v_link.auto_payment THEN true ELSE public.wheel_users.auto_payment END,
        referral_link_id = COALESCE(public.wheel_users.referral_link_id, v_link.id),
        updated_at = now()
    WHERE id = v_user.id RETURNING * INTO v_user;
  END IF;

  INSERT INTO public.referral_redemptions (referral_link_id, owner_id, email, account_id, cpf)
  VALUES (v_link.id, v_link.owner_id, lower(btrim(p_email)), btrim(p_account_id), v_cpf_clean);

  UPDATE public.referral_links SET registrations_count = registrations_count + 1, updated_at = now() WHERE id = v_link.id;

  SELECT slug INTO v_slug FROM public.wheel_configs WHERE user_id = v_link.owner_id LIMIT 1;

  RETURN jsonb_build_object('success', true, 'user_id', v_user.id, 'slug', v_slug);
END;
$function$;

-- 4) Update update_wheel_user_self to validate CPF against wheel_users first, fallback to referral_redemptions
CREATE OR REPLACE FUNCTION public.update_wheel_user_self(
  p_owner_id uuid, p_email text, p_cpf text,
  p_name text DEFAULT NULL, p_phone text DEFAULT NULL,
  p_pix_key text DEFAULT NULL, p_pix_key_type text DEFAULT NULL,
  p_new_account_id text DEFAULT NULL,
  p_allowed_fields jsonb DEFAULT '{}'::jsonb,
  p_mode text DEFAULT 'update'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_user wheel_users%ROWTYPE;
  v_email text;
  v_cpf_digits text;
  v_new_account text;
  v_allow_name boolean;
  v_allow_phone boolean;
  v_allow_pix boolean;
  v_allow_account boolean;
  v_conflict_id uuid;
  v_cpf_match boolean;
BEGIN
  IF p_owner_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'owner_required'); END IF;
  v_email := lower(btrim(coalesce(p_email, '')));
  v_cpf_digits := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  IF v_email = '' OR v_cpf_digits = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'identification_required');
  END IF;

  -- Find user by email+owner first
  SELECT * INTO v_user FROM public.wheel_users
   WHERE owner_id = p_owner_id AND lower(email) = v_email
   ORDER BY created_at DESC LIMIT 1;

  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  -- Validate CPF: prefer wheel_users.cpf, fallback to referral_redemptions
  IF regexp_replace(coalesce(v_user.cpf, ''), '\D', '', 'g') = v_cpf_digits THEN
    v_cpf_match := true;
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM public.referral_redemptions
       WHERE owner_id = p_owner_id
         AND lower(email) = v_email
         AND regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = v_cpf_digits
    ) INTO v_cpf_match;
  END IF;

  IF NOT v_cpf_match THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF p_mode = 'lookup' THEN
    RETURN jsonb_build_object('success', true, 'user', jsonb_build_object(
      'name', v_user.name, 'email', v_user.email, 'account_id', v_user.account_id,
      'phone', v_user.phone, 'pix_key', v_user.pix_key, 'pix_key_type', v_user.pix_key_type,
      'cpf', v_user.cpf
    ));
  END IF;

  v_allow_name := coalesce((p_allowed_fields->>'name')::boolean, false);
  v_allow_phone := coalesce((p_allowed_fields->>'phone')::boolean, false);
  v_allow_pix := coalesce((p_allowed_fields->>'pixKey')::boolean, false);
  v_allow_account := coalesce((p_allowed_fields->>'accountId')::boolean, false);

  v_new_account := nullif(btrim(coalesce(p_new_account_id, '')), '');
  IF v_allow_account AND v_new_account IS NOT NULL AND v_new_account <> v_user.account_id THEN
    SELECT id INTO v_conflict_id FROM public.wheel_users
      WHERE owner_id = p_owner_id AND btrim(account_id) = v_new_account AND id <> v_user.id LIMIT 1;
    IF v_conflict_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'account_id_taken');
    END IF;
  END IF;

  UPDATE public.wheel_users SET
    name = CASE WHEN v_allow_name AND p_name IS NOT NULL AND btrim(p_name) <> '' THEN btrim(p_name) ELSE name END,
    phone = CASE WHEN v_allow_phone AND p_phone IS NOT NULL THEN btrim(p_phone) ELSE phone END,
    pix_key = CASE WHEN v_allow_pix AND p_pix_key IS NOT NULL THEN btrim(p_pix_key) ELSE pix_key END,
    pix_key_type = CASE WHEN v_allow_pix AND p_pix_key_type IS NOT NULL THEN btrim(p_pix_key_type) ELSE pix_key_type END,
    account_id = CASE WHEN v_allow_account AND v_new_account IS NOT NULL THEN v_new_account ELSE account_id END,
    updated_at = now()
  WHERE id = v_user.id;

  RETURN jsonb_build_object('success', true);
END;
$function$;