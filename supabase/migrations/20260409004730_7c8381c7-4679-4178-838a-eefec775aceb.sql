
ALTER TABLE public.referral_links ADD COLUMN max_registrations integer DEFAULT NULL;

CREATE OR REPLACE FUNCTION public.register_via_referral(
  p_code text,
  p_email text,
  p_account_id text,
  p_name text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link referral_links%ROWTYPE;
  v_existing uuid;
  v_user_id uuid;
BEGIN
  SELECT * INTO v_link FROM public.referral_links WHERE code = upper(btrim(p_code)) AND is_active = true;
  IF v_link.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link inválido ou desativado');
  END IF;

  -- Check max registrations limit
  IF v_link.max_registrations IS NOT NULL AND v_link.registrations_count >= v_link.max_registrations THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este link atingiu o limite máximo de inscrições');
  END IF;

  SELECT id INTO v_existing FROM public.wheel_users
  WHERE lower(btrim(email)) = lower(btrim(p_email))
    AND btrim(account_id) = btrim(p_account_id)
    AND owner_id = v_link.owner_id;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Você já está inscrito nesta roleta');
  END IF;

  INSERT INTO public.wheel_users (
    email, account_id, name, owner_id, spins_available, referral_link_id, phone
  ) VALUES (
    lower(btrim(p_email)), btrim(p_account_id), COALESCE(NULLIF(btrim(p_name),''), 'Jogador'), v_link.owner_id, v_link.spins_per_registration, v_link.id, ''
  )
  RETURNING id INTO v_user_id;

  UPDATE public.referral_links SET registrations_count = registrations_count + 1, updated_at = now() WHERE id = v_link.id;

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'spins', v_link.spins_per_registration);
END;
$$;
