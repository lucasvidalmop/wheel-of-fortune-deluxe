-- ============ RAFFLE EVENTS ============
CREATE TABLE public.raffle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  tag text NOT NULL,
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  banner_url text NOT NULL DEFAULT '',
  rules text NOT NULL DEFAULT '',
  prize_label text NOT NULL DEFAULT '',
  signup_url text NOT NULL DEFAULT '',
  min_participants integer NOT NULL DEFAULT 0,
  max_participants integer,
  winners_count integer NOT NULL DEFAULT 1,
  opens_at timestamptz,
  closes_at timestamptz,
  draw_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  messages jsonb NOT NULL DEFAULT '{}'::jsonb,
  locked_at timestamptz,
  locked_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX raffle_events_tag_key ON public.raffle_events (lower(tag));
CREATE INDEX raffle_events_owner_idx ON public.raffle_events (owner_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.raffle_events TO authenticated;
GRANT ALL ON public.raffle_events TO service_role;
ALTER TABLE public.raffle_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raffle_events_select" ON public.raffle_events FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "raffle_events_insert" ON public.raffle_events FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "raffle_events_update" ON public.raffle_events FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "raffle_events_delete" ON public.raffle_events FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER raffle_events_updated_at BEFORE UPDATE ON public.raffle_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PARTICIPANTS ============
CREATE TABLE public.raffle_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.raffle_events(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  wheel_user_id uuid,
  account_id text NOT NULL,
  email text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  public_code text NOT NULL,
  status text NOT NULL DEFAULT 'approved',
  flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ip_address text,
  user_agent text,
  device_type text,
  os text,
  browser text,
  city text,
  region text,
  country text,
  session_fingerprint text,
  internal_note text NOT NULL DEFAULT '',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX raffle_participants_event_account ON public.raffle_participants (event_id, lower(account_id));
CREATE UNIQUE INDEX raffle_participants_event_email ON public.raffle_participants (event_id, lower(email));
CREATE UNIQUE INDEX raffle_participants_event_code ON public.raffle_participants (event_id, public_code);
CREATE INDEX raffle_participants_event_status ON public.raffle_participants (event_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.raffle_participants TO authenticated;
GRANT ALL ON public.raffle_participants TO service_role;
ALTER TABLE public.raffle_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raffle_participants_select" ON public.raffle_participants FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "raffle_participants_insert" ON public.raffle_participants FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "raffle_participants_update" ON public.raffle_participants FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "raffle_participants_delete" ON public.raffle_participants FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER raffle_participants_updated_at BEFORE UPDATE ON public.raffle_participants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ DRAWS ============
CREATE TABLE public.raffle_draws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.raffle_events(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  round integer NOT NULL DEFAULT 1,
  participants_snapshot_count integer NOT NULL DEFAULT 0,
  winners jsonb NOT NULL DEFAULT '[]'::jsonb,
  executed_by uuid,
  executed_at timestamptz NOT NULL DEFAULT now(),
  redraw_reason text NOT NULL DEFAULT '',
  superseded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX raffle_draws_event_idx ON public.raffle_draws (event_id, round DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.raffle_draws TO authenticated;
GRANT ALL ON public.raffle_draws TO service_role;
ALTER TABLE public.raffle_draws ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raffle_draws_select" ON public.raffle_draws FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "raffle_draws_insert" ON public.raffle_draws FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "raffle_draws_update" ON public.raffle_draws FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "raffle_draws_delete" ON public.raffle_draws FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ RESTRICTIONS ============
CREATE TABLE public.raffle_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.raffle_events(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  kind text NOT NULL,
  value text NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX raffle_restrictions_lookup ON public.raffle_restrictions (owner_id, kind, lower(value));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.raffle_restrictions TO authenticated;
GRANT ALL ON public.raffle_restrictions TO service_role;
ALTER TABLE public.raffle_restrictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raffle_restrictions_select" ON public.raffle_restrictions FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "raffle_restrictions_insert" ON public.raffle_restrictions FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "raffle_restrictions_delete" ON public.raffle_restrictions FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ ATTEMPTS ============
CREATE TABLE public.raffle_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.raffle_events(id) ON DELETE CASCADE,
  owner_id uuid,
  email text NOT NULL DEFAULT '',
  account_id text NOT NULL DEFAULT '',
  ip_address text,
  outcome text NOT NULL DEFAULT '',
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX raffle_attempts_ip_idx ON public.raffle_attempts (ip_address, created_at DESC);
CREATE INDEX raffle_attempts_event_idx ON public.raffle_attempts (event_id, created_at DESC);

GRANT SELECT ON public.raffle_attempts TO authenticated;
GRANT ALL ON public.raffle_attempts TO service_role;
ALTER TABLE public.raffle_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raffle_attempts_select" ON public.raffle_attempts FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ REALTIME ============
ALTER TABLE public.raffle_events REPLICA IDENTITY FULL;
ALTER TABLE public.raffle_participants REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.raffle_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.raffle_participants;