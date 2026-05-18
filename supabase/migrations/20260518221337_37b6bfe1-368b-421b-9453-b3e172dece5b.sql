
-- bet_categories table
CREATE TABLE public.bet_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  bets_config_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#22d3ee',
  icon text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bet_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read bet_categories" ON public.bet_categories
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners insert bet_categories" ON public.bet_categories
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners update bet_categories" ON public.bet_categories
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners delete bet_categories" ON public.bet_categories
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages bet_categories" ON public.bet_categories
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_bet_categories_config ON public.bet_categories (bets_config_id, position);

-- Link events to categories
ALTER TABLE public.bet_events ADD COLUMN IF NOT EXISTS category_id uuid;
CREATE INDEX IF NOT EXISTS idx_bet_events_category ON public.bet_events (category_id);

-- Scheduler: opens scheduled events and closes overdue ones
CREATE OR REPLACE FUNCTION public.tick_bet_events()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opened int := 0;
  v_closed int := 0;
BEGIN
  UPDATE public.bet_events
     SET status = 'open', updated_at = now()
   WHERE status = 'scheduled'
     AND starts_at IS NOT NULL
     AND starts_at <= now()
     AND (closes_at IS NULL OR closes_at > now());
  GET DIAGNOSTICS v_opened = ROW_COUNT;

  UPDATE public.bet_events
     SET status = 'closed', updated_at = now()
   WHERE status IN ('open','scheduled')
     AND closes_at IS NOT NULL
     AND closes_at <= now();
  GET DIAGNOSTICS v_closed = ROW_COUNT;

  RETURN jsonb_build_object('opened', v_opened, 'closed', v_closed);
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule previous job if any, then schedule
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'tick-bet-events';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;

SELECT cron.schedule(
  'tick-bet-events',
  '* * * * *',
  $$ SELECT public.tick_bet_events(); $$
);
