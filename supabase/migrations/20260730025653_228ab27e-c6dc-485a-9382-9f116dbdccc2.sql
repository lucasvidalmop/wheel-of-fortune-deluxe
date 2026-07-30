-- =====================  EVENTOS DE GORJETA  =====================
CREATE TABLE public.gorjeta_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  tag text NOT NULL,
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  rules text NOT NULL DEFAULT '',
  cover_url text NOT NULL DEFAULT '',
  theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  page_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  opens_at timestamptz,
  closes_at timestamptz,
  max_participants integer,
  require_pix boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX gorjeta_events_tag_key ON public.gorjeta_events (lower(tag));
CREATE INDEX gorjeta_events_owner_idx ON public.gorjeta_events (owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gorjeta_events TO authenticated;
GRANT ALL ON public.gorjeta_events TO service_role;
ALTER TABLE public.gorjeta_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages own events" ON public.gorjeta_events
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- =====================  PARTICIPANTES  =====================
CREATE TABLE public.gorjeta_event_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.gorjeta_events(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  wheel_user_id uuid,
  account_id text NOT NULL DEFAULT '',
  user_email text NOT NULL DEFAULT '',
  user_name text NOT NULL DEFAULT '',
  user_phone text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'signup',
  entry_number integer NOT NULL DEFAULT 0,
  is_ghost boolean NOT NULL DEFAULT false,
  has_won boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX gorjeta_event_participants_unique
  ON public.gorjeta_event_participants (event_id, lower(user_email));
CREATE INDEX gorjeta_event_participants_event_idx
  ON public.gorjeta_event_participants (event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gorjeta_event_participants TO authenticated;
GRANT ALL ON public.gorjeta_event_participants TO service_role;
ALTER TABLE public.gorjeta_event_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages own event participants" ON public.gorjeta_event_participants
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- =====================  RODADAS  =====================
CREATE TABLE public.gorjeta_event_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.gorjeta_events(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  game text NOT NULL DEFAULT 'plinko',
  title text NOT NULL DEFAULT '',
  game_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  prize_type text NOT NULL DEFAULT 'pix',
  prize_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  position integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX gorjeta_event_rounds_event_idx ON public.gorjeta_event_rounds (event_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gorjeta_event_rounds TO authenticated;
GRANT ALL ON public.gorjeta_event_rounds TO service_role;
ALTER TABLE public.gorjeta_event_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages own event rounds" ON public.gorjeta_event_rounds
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- =====================  RESULTADOS  =====================
CREATE TABLE public.gorjeta_event_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.gorjeta_events(id) ON DELETE CASCADE,
  round_id uuid REFERENCES public.gorjeta_event_rounds(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL,
  participant_id uuid REFERENCES public.gorjeta_event_participants(id) ON DELETE SET NULL,
  wheel_user_id uuid,
  user_name text NOT NULL DEFAULT '',
  user_email text NOT NULL DEFAULT '',
  account_id text NOT NULL DEFAULT '',
  game text NOT NULL DEFAULT 'plinko',
  outcome jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_winner boolean NOT NULL DEFAULT false,
  prize_type text NOT NULL DEFAULT 'pix',
  prize_label text NOT NULL DEFAULT '',
  prize_amount numeric NOT NULL DEFAULT 0,
  prize_payment_id uuid,
  is_ghost boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX gorjeta_event_results_event_idx ON public.gorjeta_event_results (event_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gorjeta_event_results TO authenticated;
GRANT ALL ON public.gorjeta_event_results TO service_role;
ALTER TABLE public.gorjeta_event_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages own event results" ON public.gorjeta_event_results
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- =====================  TRIGGERS updated_at  =====================
CREATE TRIGGER gorjeta_events_updated_at
  BEFORE UPDATE ON public.gorjeta_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER gorjeta_event_rounds_updated_at
  BEFORE UPDATE ON public.gorjeta_event_rounds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================  LEITURA PÚBLICA SEGURA  =====================
CREATE OR REPLACE FUNCTION public.get_gorjeta_event_by_tag(p_tag text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev public.gorjeta_events%ROWTYPE;
  v_count integer;
  v_winners jsonb;
BEGIN
  SELECT * INTO ev
  FROM public.gorjeta_events
  WHERE lower(tag) = lower(p_tag) AND is_active = true
  LIMIT 1;

  IF ev.id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT count(*) INTO v_count
  FROM public.gorjeta_event_participants
  WHERE event_id = ev.id;

  SELECT COALESCE(jsonb_agg(w ORDER BY w->>'created_at' DESC), '[]'::jsonb) INTO v_winners
  FROM (
    SELECT jsonb_build_object(
      'name', split_part(r.user_name, ' ', 1),
      'account_id', CASE WHEN length(r.account_id) > 4
                         THEN left(r.account_id, 4) || '****' ELSE r.account_id END,
      'prize_label', r.prize_label,
      'prize_amount', r.prize_amount,
      'game', r.game,
      'created_at', r.created_at
    ) AS w
    FROM public.gorjeta_event_results r
    WHERE r.event_id = ev.id AND r.is_winner = true
    ORDER BY r.created_at DESC
    LIMIT 30
  ) sub;

  RETURN jsonb_build_object(
    'found', true,
    'id', ev.id,
    'owner_id', ev.owner_id,
    'tag', ev.tag,
    'name', ev.name,
    'description', ev.description,
    'rules', ev.rules,
    'cover_url', ev.cover_url,
    'theme', ev.theme,
    'page_config', ev.page_config,
    'status', ev.status,
    'opens_at', ev.opens_at,
    'closes_at', ev.closes_at,
    'max_participants', ev.max_participants,
    'require_pix', ev.require_pix,
    'participants_count', v_count,
    'winners', v_winners
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_gorjeta_event_by_tag(text) TO anon, authenticated;

-- =====================  REALTIME  =====================
ALTER TABLE public.gorjeta_event_participants REPLICA IDENTITY FULL;
ALTER TABLE public.gorjeta_event_results REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gorjeta_event_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gorjeta_event_results;