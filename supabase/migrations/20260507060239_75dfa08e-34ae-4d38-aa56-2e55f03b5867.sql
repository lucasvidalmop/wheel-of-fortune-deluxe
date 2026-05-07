ALTER TABLE public.luckybox_configs 
  ADD COLUMN IF NOT EXISTS coin_name text NOT NULL DEFAULT 'Coins',
  ADD COLUMN IF NOT EXISTS coin_icon_url text NOT NULL DEFAULT '';