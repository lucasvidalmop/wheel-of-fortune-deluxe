
-- 1) battles table
CREATE TABLE public.battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'collecting' CHECK (status IN ('collecting','running','finished')),
  started_at timestamptz,
  finished_at timestamptz,
  champion_name text,
  champion_game text,
  champion_score numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_battles_owner_status ON public.battles(owner_id, status, created_at DESC);
CREATE UNIQUE INDEX battles_one_collecting_per_owner ON public.battles(owner_id) WHERE status = 'collecting';
CREATE UNIQUE INDEX battles_one_running_per_owner ON public.battles(owner_id) WHERE status = 'running';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.battles TO authenticated;
GRANT ALL ON public.battles TO service_role;

ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages battles" ON public.battles
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Users can read own battles" ON public.battles FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert own battles" ON public.battles FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can update own battles" ON public.battles FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can delete own battles" ON public.battles FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_battles_updated_at BEFORE UPDATE ON public.battles
  FOR EACH ROW EXECUTE FUNCTION public.touch_battle_participants_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.battles;

-- 2) add battle_id to battle_participants
ALTER TABLE public.battle_participants
  ADD COLUMN battle_id uuid REFERENCES public.battles(id) ON DELETE SET NULL;

CREATE INDEX idx_battle_participants_battle ON public.battle_participants(battle_id, created_at);

-- 3) helper: get or create the current "collecting" battle for an owner
CREATE OR REPLACE FUNCTION public.get_or_create_collecting_battle(_owner uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  SELECT id INTO _id FROM public.battles
    WHERE owner_id = _owner AND status = 'collecting' LIMIT 1;
  IF _id IS NULL THEN
    INSERT INTO public.battles(owner_id, status) VALUES (_owner, 'collecting')
      ON CONFLICT DO NOTHING
      RETURNING id INTO _id;
    IF _id IS NULL THEN
      SELECT id INTO _id FROM public.battles
        WHERE owner_id = _owner AND status = 'collecting' LIMIT 1;
    END IF;
  END IF;
  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_collecting_battle(uuid) TO authenticated, service_role;
