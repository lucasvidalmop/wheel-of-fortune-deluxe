-- 1) Add batalha_slot permission to operator_permissions and defaults
ALTER TABLE public.operator_permissions
  ADD COLUMN IF NOT EXISTS batalha_slot boolean NOT NULL DEFAULT false;

ALTER TABLE public.operator_permissions_defaults
  ADD COLUMN IF NOT EXISTS batalha_slot boolean NOT NULL DEFAULT false;

-- 2) Create battle_configs table
CREATE TABLE IF NOT EXISTS public.battle_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.battle_configs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can read own battle_config"
  ON public.battle_configs FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own battle_config"
  ON public.battle_configs FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own battle_config"
  ON public.battle_configs FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update any battle_config"
  ON public.battle_configs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger function (reuse existing pattern)
CREATE OR REPLACE FUNCTION public.touch_battle_configs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS battle_configs_set_updated_at ON public.battle_configs;
CREATE TRIGGER battle_configs_set_updated_at
  BEFORE UPDATE ON public.battle_configs
  FOR EACH ROW EXECUTE FUNCTION public.touch_battle_configs_updated_at();

-- Public read function for /batalha route (returns first/default config; can be expanded later)
CREATE OR REPLACE FUNCTION public.get_battle_config_default()
RETURNS TABLE(user_id uuid, config jsonb)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bc.user_id, bc.config
  FROM public.battle_configs bc
  ORDER BY bc.updated_at DESC
  LIMIT 1;
$$;