
CREATE TABLE IF NOT EXISTS public.operator_permissions (
  user_id uuid PRIMARY KEY,
  roleta boolean NOT NULL DEFAULT true,
  sms boolean NOT NULL DEFAULT true,
  email boolean NOT NULL DEFAULT true,
  whatsapp boolean NOT NULL DEFAULT true,
  financeiro boolean NOT NULL DEFAULT true,
  gorjeta boolean NOT NULL DEFAULT true,
  referral boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all operator_permissions"
ON public.operator_permissions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own operator_permissions"
ON public.operator_permissions FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Service role manages operator_permissions"
ON public.operator_permissions FOR ALL TO public
USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Global defaults stored as a single row keyed by id=1
CREATE TABLE IF NOT EXISTS public.operator_permissions_defaults (
  id integer PRIMARY KEY DEFAULT 1,
  roleta boolean NOT NULL DEFAULT true,
  sms boolean NOT NULL DEFAULT true,
  email boolean NOT NULL DEFAULT true,
  whatsapp boolean NOT NULL DEFAULT true,
  financeiro boolean NOT NULL DEFAULT true,
  gorjeta boolean NOT NULL DEFAULT true,
  referral boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operator_permissions_defaults_singleton CHECK (id = 1)
);

ALTER TABLE public.operator_permissions_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read defaults"
ON public.operator_permissions_defaults FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Service role manages defaults"
ON public.operator_permissions_defaults FOR ALL TO public
USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

INSERT INTO public.operator_permissions_defaults (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
