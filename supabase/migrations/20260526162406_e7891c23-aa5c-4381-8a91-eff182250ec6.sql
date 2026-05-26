CREATE OR REPLACE FUNCTION public.register_via_gorjeta(p_code text, p_email text, p_account_id text, p_name text DEFAULT ''::text, p_cpf text DEFAULT ''::text, p_phone text DEFAULT ''::text, p_pix_key text DEFAULT ''::text, p_pix_key_type text DEFAULT ''::text)
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
  v_signup_coins integer := 0;
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

  -- Read signup coins from owner's gorjeta page config
  SELECT GREATEST(0, COALESCE(NULLIF(config->'gorjetaPageConfig'->>'signupCoins','')::int, 0))
    INTO v_signup_coins
    FROM public.wheel_configs WHERE user_id = v_link.owner_id LIMIT 1;
  v_signup_coins := COALESCE(v_signup_coins, 0);

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
      pix_key, pix_key_type, spins_available, referral_link_id, user_type, responsible, tokens_balance
    ) VALUES (
      COALESCE(NULLIF(btrim(p_name), ''), 'Usuário'),
      lower(btrim(p_email)),
      btrim(p_account_id),
      v_link.owner_id,
      COALESCE(btrim(p_phone), ''),
      v_cpf_clean,
      COALESCE(btrim(p_pix_key), ''),
      COALESCE(btrim(p_pix_key_type), ''),
      0, v_link.id, 'Real', btrim(p_code), v_signup_coins
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
        tokens_balance = COALESCE(public.wheel_users.tokens_balance, 0) + v_signup_coins,
        updated_at = now()
    WHERE id = v_user.id RETURNING * INTO v_user;
  END IF;

  INSERT INTO public.referral_redemptions (referral_link_id, owner_id, email, account_id, cpf)
  VALUES (v_link.id, v_link.owner_id, lower(btrim(p_email)), btrim(p_account_id), v_cpf_clean);

  UPDATE public.referral_links SET registrations_count = registrations_count + 1, updated_at = now() WHERE id = v_link.id;

  SELECT slug INTO v_slug FROM public.wheel_configs WHERE user_id = v_link.owner_id LIMIT 1;

  RETURN jsonb_build_object('success', true, 'user_id', v_user.id, 'slug', v_slug, 'coins_granted', v_signup_coins);
END;
$function$;