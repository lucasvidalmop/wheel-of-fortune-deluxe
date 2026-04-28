-- 1) New column: shared shuffled pool for the whole link
ALTER TABLE public.referral_links
  ADD COLUMN IF NOT EXISTS fixed_prize_pool jsonb;

-- 2) Helper: build a fully shuffled pool from the plan (no truncation, no random fill)
CREATE OR REPLACE FUNCTION public.build_link_prize_pool(p_plan jsonb)
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
BEGIN
  IF jsonb_typeof(p_plan) <> 'array' THEN
    RETURN '[]'::jsonb;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_plan) LOOP
    v_segment := NULLIF(v_item->>'segment_index', '')::integer;
    v_count := GREATEST(COALESCE(NULLIF(v_item->>'count', '')::integer, 0), 0);
    IF v_segment IS NOT NULL AND v_count > 0 THEN
      FOR v_i IN 1..v_count LOOP
        v_queue := array_append(v_queue, v_segment);
      END LOOP;
    END IF;
  END LOOP;

  -- Fisher-Yates shuffle
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

-- 3) Atomic pop from the link's shared pool. Returns the popped segments as jsonb array.
CREATE OR REPLACE FUNCTION public.pop_link_prize_pool(p_link_id uuid, p_count integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link public.referral_links%ROWTYPE;
  v_pool jsonb;
  v_taken jsonb := '[]'::jsonb;
  v_remaining jsonb;
  v_n integer;
  v_i integer;
BEGIN
  IF p_count IS NULL OR p_count <= 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT * INTO v_link FROM public.referral_links WHERE id = p_link_id FOR UPDATE;
  IF v_link.id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  v_pool := COALESCE(v_link.fixed_prize_pool, 'null'::jsonb);

  -- If pool not yet initialized AND a plan exists, build it now from the plan
  IF v_pool IS NULL OR v_pool = 'null'::jsonb THEN
    IF v_link.fixed_prize_plan IS NOT NULL AND jsonb_typeof(v_link.fixed_prize_plan) = 'array' THEN
      v_pool := public.build_link_prize_pool(v_link.fixed_prize_plan);
    ELSE
      v_pool := '[]'::jsonb;
    END IF;
  END IF;

  v_n := LEAST(p_count, COALESCE(jsonb_array_length(v_pool), 0));

  IF v_n > 0 THEN
    SELECT jsonb_agg(value) INTO v_taken
    FROM (SELECT value FROM jsonb_array_elements(v_pool) WITH ORDINALITY t(value, ord) WHERE ord <= v_n ORDER BY ord) s;

    SELECT COALESCE(jsonb_agg(value), '[]'::jsonb) INTO v_remaining
    FROM (SELECT value FROM jsonb_array_elements(v_pool) WITH ORDINALITY t(value, ord) WHERE ord > v_n ORDER BY ord) s;
  ELSE
    v_taken := '[]'::jsonb;
    v_remaining := v_pool;
  END IF;

  UPDATE public.referral_links
  SET fixed_prize_pool = v_remaining,
      updated_at = now()
  WHERE id = v_link.id;

  RETURN COALESCE(v_taken, '[]'::jsonb);
END;
$$;

-- 4) Rewrite register_via_referral to use the shared pool
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
  v_has_plan boolean := false;
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

  v_has_plan := (v_link.fixed_prize_plan IS NOT NULL AND jsonb_typeof(v_link.fixed_prize_plan) = 'array' AND jsonb_array_length(v_link.fixed_prize_plan) > 0);

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

  -- NEW: Pull the next N items from the link's shared pool (atomic, with row lock)
  IF v_has_plan THEN
    v_fixed_queue := public.pop_link_prize_pool(v_link.id, v_link.spins_per_registration);
  ELSIF v_link.fixed_prize_segments IS NOT NULL AND jsonb_typeof(v_link.fixed_prize_segments) = 'array' AND jsonb_array_length(v_link.fixed_prize_segments) > 0 THEN
    -- Legacy: random pick from list
    v_fixed_queue := jsonb_build_array((v_link.fixed_prize_segments->(floor(random() * jsonb_array_length(v_link.fixed_prize_segments))::int))::int);
  ELSIF v_link.fixed_prize_segment IS NOT NULL THEN
    v_fixed_queue := jsonb_build_array(v_link.fixed_prize_segment);
  ELSE
    v_fixed_queue := '[]'::jsonb;
  END IF;

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

-- 5) Trigger to (re)build pool whenever the plan changes or a new link is inserted
CREATE OR REPLACE FUNCTION public.refresh_referral_link_pool()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.fixed_prize_plan IS NOT NULL AND jsonb_typeof(NEW.fixed_prize_plan) = 'array' AND jsonb_array_length(NEW.fixed_prize_plan) > 0 THEN
      NEW.fixed_prize_pool := public.build_link_prize_pool(NEW.fixed_prize_plan);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Rebuild only if plan actually changed
    IF NEW.fixed_prize_plan IS DISTINCT FROM OLD.fixed_prize_plan THEN
      IF NEW.fixed_prize_plan IS NOT NULL AND jsonb_typeof(NEW.fixed_prize_plan) = 'array' AND jsonb_array_length(NEW.fixed_prize_plan) > 0 THEN
        NEW.fixed_prize_pool := public.build_link_prize_pool(NEW.fixed_prize_plan);
      ELSE
        NEW.fixed_prize_pool := NULL;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_link_pool ON public.referral_links;
CREATE TRIGGER trg_referral_link_pool
BEFORE INSERT OR UPDATE ON public.referral_links
FOR EACH ROW EXECUTE FUNCTION public.refresh_referral_link_pool();