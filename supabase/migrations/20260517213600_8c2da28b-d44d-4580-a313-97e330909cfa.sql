CREATE OR REPLACE FUNCTION public.update_wheel_user_self(
  p_owner_id uuid,
  p_email text,
  p_cpf text,
  p_name text DEFAULT NULL::text,
  p_phone text DEFAULT NULL::text,
  p_pix_key text DEFAULT NULL::text,
  p_pix_key_type text DEFAULT NULL::text,
  p_new_account_id text DEFAULT NULL::text,
  p_allowed_fields jsonb DEFAULT '{}'::jsonb,
  p_mode text DEFAULT 'update'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_cpf_match boolean := false;
  v_user_cpf_digits text;
BEGIN
  IF p_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'owner_required');
  END IF;

  v_email := lower(btrim(coalesce(p_email, '')));
  v_cpf_digits := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');

  IF v_email = '' OR length(v_cpf_digits) < 11 THEN
    RETURN jsonb_build_object('success', false, 'error', 'identification_required');
  END IF;

  -- Prefer a matching CPF when the same email has more than one cadastro.
  SELECT * INTO v_user
  FROM public.wheel_users
  WHERE owner_id = p_owner_id
    AND lower(btrim(email)) = v_email
    AND regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = v_cpf_digits
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_user.id IS NOT NULL THEN
    v_cpf_match := true;
  ELSE
    -- Legacy fallback: find the latest cadastro by email and owner.
    SELECT * INTO v_user
    FROM public.wheel_users
    WHERE owner_id = p_owner_id
      AND lower(btrim(email)) = v_email
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_user.id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_found');
    END IF;

    v_user_cpf_digits := regexp_replace(coalesce(v_user.cpf, ''), '\D', '', 'g');

    IF v_user_cpf_digits = v_cpf_digits THEN
      v_cpf_match := true;
    ELSIF v_user_cpf_digits = '' THEN
      -- Old records may exist without CPF because CPF was not saved before.
      -- In that case, bind the informed CPF to this existing email cadastro.
      UPDATE public.wheel_users
      SET cpf = v_cpf_digits,
          updated_at = now()
      WHERE id = v_user.id;
      v_user.cpf := v_cpf_digits;
      v_cpf_match := true;
    ELSE
      SELECT EXISTS(
        SELECT 1
        FROM public.referral_redemptions
        WHERE owner_id = p_owner_id
          AND lower(btrim(email)) = v_email
          AND regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = v_cpf_digits
      ) INTO v_cpf_match;
    END IF;
  END IF;

  IF NOT v_cpf_match THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF p_mode = 'lookup' THEN
    RETURN jsonb_build_object('success', true, 'user', jsonb_build_object(
      'name', v_user.name,
      'email', v_user.email,
      'account_id', v_user.account_id,
      'phone', v_user.phone,
      'pix_key', v_user.pix_key,
      'pix_key_type', v_user.pix_key_type,
      'cpf', v_user.cpf
    ));
  END IF;

  v_allow_name := coalesce((p_allowed_fields->>'name')::boolean, false);
  v_allow_phone := coalesce((p_allowed_fields->>'phone')::boolean, false);
  v_allow_pix := coalesce((p_allowed_fields->>'pixKey')::boolean, false);
  v_allow_account := coalesce((p_allowed_fields->>'accountId')::boolean, false);

  v_new_account := nullif(btrim(coalesce(p_new_account_id, '')), '');
  IF v_allow_account AND v_new_account IS NOT NULL AND v_new_account <> v_user.account_id THEN
    SELECT id INTO v_conflict_id
    FROM public.wheel_users
    WHERE owner_id = p_owner_id
      AND btrim(account_id) = v_new_account
      AND id <> v_user.id
    LIMIT 1;

    IF v_conflict_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'account_id_taken');
    END IF;
  END IF;

  UPDATE public.wheel_users
  SET
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

GRANT EXECUTE ON FUNCTION public.update_wheel_user_self(uuid, text, text, text, text, text, text, text, jsonb, text) TO anon, authenticated, service_role;