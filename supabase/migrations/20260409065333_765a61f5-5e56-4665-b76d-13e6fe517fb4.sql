
CREATE OR REPLACE FUNCTION public.register_via_referral(p_code text, p_email text, p_account_id text, p_name text DEFAULT ''::text, p_cpf text DEFAULT ''::text)
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
BEGIN
  v_cpf_clean := btrim(p_cpf);

  SELECT * INTO v_link FROM public.referral_links WHERE code = upper(btrim(p_code)) AND is_active = true;
  IF v_link.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link inválido ou desativado');
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

  SELECT * INTO v_user FROM public.wheel_users
  WHERE lower(btrim(email)) = lower(btrim(p_email))
    AND btrim(account_id) = btrim(p_account_id)
    AND owner_id = v_link.owner_id;

  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado. Verifique seu e-mail e ID.');
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
      updated_at = now()
  WHERE id = v_user.id;

  INSERT INTO public.referral_redemptions (referral_link_id, email, account_id, cpf)
  VALUES (v_link.id, lower(btrim(p_email)), btrim(p_account_id), v_cpf_clean);

  UPDATE public.referral_links SET registrations_count = registrations_count + 1, updated_at = now() WHERE id = v_link.id;

  SELECT slug INTO v_slug FROM public.wheel_configs WHERE user_id = v_link.owner_id LIMIT 1;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user.id,
    'spins', v_link.spins_per_registration,
    'name', v_user.name,
    'slug', v_slug,
    'owner_id', v_link.owner_id,
    'label', v_link.label
  );
END;
$function$;
