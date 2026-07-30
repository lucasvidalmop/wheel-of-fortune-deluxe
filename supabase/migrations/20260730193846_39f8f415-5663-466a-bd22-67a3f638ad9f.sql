ALTER TABLE public.gorjeta_events
  ADD COLUMN IF NOT EXISTS prize_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS winners_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS block_by_ip boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS drawn_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.gorjeta_event_participants
  ADD COLUMN IF NOT EXISTS ip_address text;

CREATE UNIQUE INDEX IF NOT EXISTS gorjeta_event_participants_ip_unique
  ON public.gorjeta_event_participants (event_id, ip_address)
  WHERE ip_address IS NOT NULL AND ip_address <> '';

CREATE INDEX IF NOT EXISTS gorjeta_event_participants_account_idx
  ON public.gorjeta_event_participants (event_id, lower(account_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gorjeta_events TO authenticated;
GRANT ALL ON public.gorjeta_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gorjeta_event_participants TO authenticated;
GRANT ALL ON public.gorjeta_event_participants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gorjeta_event_results TO authenticated;
GRANT ALL ON public.gorjeta_event_results TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gorjeta_event_rounds TO authenticated;
GRANT ALL ON public.gorjeta_event_rounds TO service_role;

ALTER TABLE public.operator_permissions
  ADD COLUMN IF NOT EXISTS sorteio boolean NOT NULL DEFAULT true;
ALTER TABLE public.operator_permissions_defaults
  ADD COLUMN IF NOT EXISTS sorteio boolean NOT NULL DEFAULT true;