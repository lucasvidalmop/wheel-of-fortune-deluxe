CREATE OR REPLACE FUNCTION public.lobby_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.lobby_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL UNIQUE,
  tag text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  page_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.lobby_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own lobby_configs" ON public.lobby_configs FOR SELECT TO authenticated
  USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners insert own lobby_configs" ON public.lobby_configs FOR INSERT TO authenticated
  WITH CHECK ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners update own lobby_configs" ON public.lobby_configs FOR UPDATE TO authenticated
  USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners delete own lobby_configs" ON public.lobby_configs FOR DELETE TO authenticated
  USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages lobby_configs" ON public.lobby_configs FOR ALL TO public
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER lobby_configs_set_updated_at
BEFORE UPDATE ON public.lobby_configs
FOR EACH ROW EXECUTE FUNCTION public.lobby_set_updated_at();