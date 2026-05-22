
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.bolao_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  tag text NOT NULL,
  name text NOT NULL DEFAULT 'Bolão da Copa',
  is_active boolean NOT NULL DEFAULT true,
  submission_deadline timestamptz,
  page_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  scoring jsonb NOT NULL DEFAULT '{"qualified_group":5,"exact_group_position":10,"best_third":8,"r16":10,"qf":15,"sf":25,"finalist":40,"champion":80}'::jsonb,
  groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  bracket_template jsonb NOT NULL DEFAULT '[]'::jsonb,
  official_results jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, tag)
);
ALTER TABLE public.bolao_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read bolao_configs" ON public.bolao_configs FOR SELECT TO authenticated USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners insert bolao_configs" ON public.bolao_configs FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners update bolao_configs" ON public.bolao_configs FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners delete bolao_configs" ON public.bolao_configs FOR DELETE TO authenticated USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service manages bolao_configs" ON public.bolao_configs FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE TRIGGER trg_bolao_configs_uat BEFORE UPDATE ON public.bolao_configs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.bolao_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  bolao_config_id uuid NOT NULL,
  wheel_user_id uuid,
  account_id text NOT NULL DEFAULT '',
  user_email text NOT NULL DEFAULT '',
  user_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  best_thirds jsonb NOT NULL DEFAULT '[]'::jsonb,
  score integer NOT NULL DEFAULT 0,
  score_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bolao_config_id, account_id)
);
ALTER TABLE public.bolao_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read bolao_entries" ON public.bolao_entries FOR SELECT TO authenticated USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners update bolao_entries" ON public.bolao_entries FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners delete bolao_entries" ON public.bolao_entries FOR DELETE TO authenticated USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service manages bolao_entries" ON public.bolao_entries FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE TRIGGER trg_bolao_entries_uat BEFORE UPDATE ON public.bolao_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.bolao_entry_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.bolao_entries(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  group_key text NOT NULL,
  first_team text NOT NULL DEFAULT '',
  second_team text NOT NULL DEFAULT '',
  third_team text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entry_id, group_key)
);
ALTER TABLE public.bolao_entry_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read bolao_entry_groups" ON public.bolao_entry_groups FOR SELECT TO authenticated USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service manages bolao_entry_groups" ON public.bolao_entry_groups FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE TABLE public.bolao_entry_bracket (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.bolao_entries(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  round text NOT NULL,
  slot integer NOT NULL,
  team_code text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entry_id, round, slot)
);
ALTER TABLE public.bolao_entry_bracket ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read bolao_entry_bracket" ON public.bolao_entry_bracket FOR SELECT TO authenticated USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service manages bolao_entry_bracket" ON public.bolao_entry_bracket FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_bolao_entries_config ON public.bolao_entries(bolao_config_id);
CREATE INDEX idx_bolao_entry_groups_entry ON public.bolao_entry_groups(entry_id);
CREATE INDEX idx_bolao_entry_bracket_entry ON public.bolao_entry_bracket(entry_id);
