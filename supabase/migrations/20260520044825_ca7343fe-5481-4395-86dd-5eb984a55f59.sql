ALTER TABLE public.bet_events ADD COLUMN IF NOT EXISTS external_fixture_id text;
CREATE UNIQUE INDEX IF NOT EXISTS bet_events_owner_fixture_unique
  ON public.bet_events (owner_id, external_fixture_id)
  WHERE external_fixture_id IS NOT NULL;