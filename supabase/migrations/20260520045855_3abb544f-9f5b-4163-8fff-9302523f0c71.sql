ALTER TABLE public.bet_events
  ADD COLUMN IF NOT EXISTS home_image_url text,
  ADD COLUMN IF NOT EXISTS away_image_url text;