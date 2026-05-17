CREATE OR REPLACE FUNCTION public.update_wheel_user_self(
  p_owner_id uuid,
  p_email text,
  p_account_id text,
  p_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_cpf text DEFAULT NULL,
  p_pix_key text DEFAULT NULL,
  p_pix_key_type text DEFAULT NULL,
  p_allowed_fields jsonb DEFAULT '{}'::jsonb,
  p_mode text DEFAULT 'update'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user wheel_users%ROWTYPE;
  v_email text;
  v_account text;
  v_allow_name boolean;
  v_allow_phone boolean;
  v_allow_cpf boolean;
  v_allow_pix boolean;
BEGIN
  IF p_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'owner_required');
  END IF;
  v_email := lower(btrim(coalesce(p_email, '')));
  v_account := btrim(coalesce(p_account_id, ''));
  IF v_email = '' OR v_account = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'identification_required');
  END IF;

  SELECT * INTO v_user FROM public.wheel_users
   WHERE owner_id = p_owner_id
     AND lower(email) = v_email
     AND account_id = v_account
   LIMIT 1;

  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF p_mode = 'lookup' THEN
    RETURN jsonb_build_object(
      'success', true,
      'user', jsonb_build_object(
        'name', v_user.name,
        'email', v_user.email,
        'account_id', v_user.account_id,
        'phone', v_user.phone,
        'pix_key', v_user.pix_key,
        'pix_key_type', v_user.pix_key_type
      )
    );
  END IF;

  v_allow_name := coalesce((p_allowed_fields->>'name')::boolean, false);
  v_allow_phone := coalesce((p_allowed_fields->>'phone')::boolean, false);
  v_allow_cpf := coalesce((p_allowed_fields->>'cpf')::boolean, false);
  v_allow_pix := coalesce((p_allowed_fields->>'pixKey')::boolean, false);

  UPDATE public.wheel_users SET
    name = CASE WHEN v_allow_name AND p_name IS NOT NULL AND btrim(p_name) <> '' THEN btrim(p_name) ELSE name END,
    phone = CASE WHEN v_allow_phone AND p_phone IS NOT NULL THEN btrim(p_phone) ELSE phone END,
    pix_key = CASE WHEN v_allow_pix AND p_pix_key IS NOT NULL THEN btrim(p_pix_key) ELSE pix_key END,
    pix_key_type = CASE WHEN v_allow_pix AND p_pix_key_type IS NOT NULL THEN btrim(p_pix_key_type) ELSE pix_key_type END,
    updated_at = now()
  WHERE id = v_user.id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.update_wheel_user_self(uuid, text, text, text, text, text, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_wheel_user_self(uuid, text, text, text, text, text, text, text, jsonb, text) TO anon, authenticated, service_role;