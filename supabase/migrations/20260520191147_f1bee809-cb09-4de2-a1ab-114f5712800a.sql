
ALTER TABLE public.bet_events
  ADD COLUMN IF NOT EXISTS competition_id text,
  ADD COLUMN IF NOT EXISTS competition_name text,
  ADD COLUMN IF NOT EXISTS competition_slug text,
  ADD COLUMN IF NOT EXISTS competition_country text;

CREATE INDEX IF NOT EXISTS idx_bet_events_competition_slug
  ON public.bet_events (competition_slug);
