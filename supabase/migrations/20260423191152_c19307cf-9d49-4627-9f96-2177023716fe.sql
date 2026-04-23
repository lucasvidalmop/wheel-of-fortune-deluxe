CREATE OR REPLACE FUNCTION public.segment_is_paying_prize(p_segment jsonb)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_title text := lower(coalesce(p_segment->>'title', ''));
  v_reward text := lower(coalesce(p_segment->>'reward', ''));
  v_message text := lower(coalesce(p_segment->>'postSpinMessage', ''));
  v_reward_compact text := regexp_replace(coalesce(p_segment->>'reward', ''), '\s+', '', 'g');
BEGIN
  IF v_title ~ '(r\$|brl|reais?|real|pix)'
     OR v_reward ~ '(r\$|brl|reais?|real|pix)'
     OR v_message ~ '(r\$|brl|reais?|real|pix)' THEN
    RETURN true;
  END IF;

  IF v_reward_compact ~ '^-?\d+(?:[\.,]\d+)?$'
     AND v_title !~ '(giro|giros|spin|spins|perdeu|amanh[ãa]|tente|brinde|cupom)' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.build_fixed_prize_queue(
  p_plan jsonb,
  p_spins integer,
  p_total_segments integer DEFAULT NULL::integer,
  p_legacy_segments jsonb DEFAULT NULL::jsonb,
  p_legacy_segment integer DEFAULT NULL::integer,
  p_segments jsonb DEFAULT NULL::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_queue integer[] := ARRAY[]::integer[];
  v_item jsonb;
  v_segment integer;
  v_count integer;
  v_i integer;
  v_j integer;
  v_tmp integer;
  v_limit integer := GREATEST(COALESCE(p_spins, 0), 0);
  v_plan_segments integer[] := ARRAY[]::integer[];
  v_fill_candidates integer[] := ARRAY[]::integer[];
  v_fill_pick integer;
BEGIN
  IF jsonb_typeof(p_plan) = 'array' THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_plan) LOOP
      v_segment := NULLIF(v_item->>'segment_index', '')::integer;
      v_count := GREATEST(COALESCE(NULLIF(v_item->>'count', '')::integer, 0), 0);

      IF v_segment IS NOT NULL AND v_count > 0 THEN
        IF NOT (v_segment = ANY(v_plan_segments)) THEN
          v_plan_segments := array_append(v_plan_segments, v_segment);
        END IF;
        FOR v_i IN 1..v_count LOOP
          v_queue := array_append(v_queue, v_segment);
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  IF COALESCE(array_length(v_queue, 1), 0) = 0 THEN
    IF jsonb_typeof(p_legacy_segments) = 'array' AND jsonb_array_length(p_legacy_segments) > 0 THEN
      FOR v_item IN SELECT value FROM jsonb_array_elements(p_legacy_segments) LOOP
        v_segment := NULLIF(trim(both ' ' from v_item::text), '')::integer;
        IF v_segment IS NOT NULL THEN
          v_queue := array_append(v_queue, v_segment);
        END IF;
      END LOOP;
    ELSIF p_legacy_segment IS NOT NULL THEN
      v_queue := array_append(v_queue, p_legacy_segment);
    END IF;
  ELSIF v_limit > 0 THEN
    IF jsonb_typeof(p_segments) = 'array' AND jsonb_array_length(p_segments) > 0 THEN
      FOR v_i IN 0..(jsonb_array_length(p_segments) - 1) LOOP
        IF NOT (v_i = ANY(v_plan_segments))
           AND NOT public.segment_is_paying_prize(p_segments->v_i) THEN
          v_fill_candidates := array_append(v_fill_candidates, v_i);
        END IF;
      END LOOP;
    ELSIF p_total_segments IS NOT NULL AND p_total_segments > 0 THEN
      FOR v_i IN 0..(p_total_segments - 1) LOOP
        IF NOT (v_i = ANY(v_plan_segments)) THEN
          v_fill_candidates := array_append(v_fill_candidates, v_i);
        END IF;
      END LOOP;
    END IF;

    WHILE COALESCE(array_length(v_queue, 1), 0) < v_limit AND COALESCE(array_length(v_fill_candidates, 1), 0) > 0 LOOP
      v_fill_pick := v_fill_candidates[1 + floor(random() * array_length(v_fill_candidates, 1))::integer];
      v_queue := array_append(v_queue, v_fill_pick);
    END LOOP;
  END IF;

  IF v_limit > 0 AND COALESCE(array_length(v_queue, 1), 0) > v_limit THEN
    v_queue := v_queue[1:v_limit];
  END IF;

  IF COALESCE(array_length(v_queue, 1), 0) > 1 THEN
    FOR v_i IN REVERSE array_upper(v_queue, 1)..2 LOOP
      v_j := floor(random() * v_i + 1)::integer;
      v_tmp := v_queue[v_i];
      v_queue[v_i] := v_queue[v_j];
      v_queue[v_j] := v_tmp;
    END LOOP;
  END IF;

  RETURN COALESCE(to_jsonb(v_queue), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.register_via_referral(
  p_code text,
  p_email text,
  p_account_id text,
  p_name text DEFAULT ''::text,
  p_cpf text DEFAULT ''::text,
  p_phone text DEFAULT ''::text,
  p_pix_key text DEFAULT ''::text,
  p_pix_key_type text DEFAULT ''::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    WHEN jsonb_array_length(COALESCE(v_user.fixed_prize_queue, '[]'::jsonb)) > 0 THEN COALESCE(v_user.fixed_prize_queue, '[]'::jsonb)
    WHEN v_user.fixed_prize_enabled = true AND v_user.fixed_prize_segment IS NOT NULL THEN jsonb_build_array(v_user.fixed_prize_segment)
    ELSE '[]'::jsonb
  END;

  v_combined_queue := v_existing_queue || COALESCE(v_fixed_queue, '[]'::jsonb);
  v_first_segment := CASE
    WHEN jsonb_array_length(v_combined_queue) > 0 THEN (v_combined_queue->>0)::integer
    ELSE NULL
  END;

  UPDATE public.wheel_users
  SET spins_available = spins_available + v_link.spins_per_registration,
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
$$;