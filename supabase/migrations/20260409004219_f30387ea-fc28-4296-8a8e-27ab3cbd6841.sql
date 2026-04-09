
CREATE TABLE public.referral_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  code text NOT NULL UNIQUE DEFAULT upper(substr(md5(random()::text), 1, 8)),
  label text NOT NULL DEFAULT '',
  spins_per_registration integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  registrations_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_links ENABLE ROW LEVEL SECURITY;

-- Owners can manage their own links
CREATE POLICY "Users can read own referral_links"
  ON public.referral_links FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own referral_links"
  ON public.referral_links FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own referral_links"
  ON public.referral_links FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own referral_links"
  ON public.referral_links FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- Anonymous can read active links by code (for the registration page)
CREATE POLICY "Anyone can read active referral_links"
  ON public.referral_links FOR SELECT
  TO anon
  USING (is_active = true);

-- Add referral_link_id to wheel_users to track origin
ALTER TABLE public.wheel_users ADD COLUMN referral_link_id uuid REFERENCES public.referral_links(id) ON DELETE SET NULL;

-- Function to register via referral link
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
  -- Find active link
  SELECT * INTO v_link FROM public.referral_links WHERE code = upper(btrim(p_code)) AND is_active = true;
  IF v_link.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link inválido ou desativado');
  END IF;

  -- Check if user already registered for this operator
  SELECT id INTO v_existing FROM public.wheel_users
  WHERE lower(btrim(email)) = lower(btrim(p_email))
    AND btrim(account_id) = btrim(p_account_id)
    AND owner_id = v_link.owner_id;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Você já está inscrito nesta roleta');
  END IF;

  -- Create wheel user
  INSERT INTO public.wheel_users (
    email, account_id, name, owner_id, spins_available, referral_link_id, phone
  ) VALUES (
    lower(btrim(p_email)), btrim(p_account_id), COALESCE(NULLIF(btrim(p_name),''), 'Jogador'), v_link.owner_id, v_link.spins_per_registration, v_link.id, ''
  )
  RETURNING id INTO v_user_id;

  -- Increment counter
  UPDATE public.referral_links SET registrations_count = registrations_count + 1, updated_at = now() WHERE id = v_link.id;

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'spins', v_link.spins_per_registration);
END;
$$;
