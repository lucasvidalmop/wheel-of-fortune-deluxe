
ALTER TABLE public.wheel_users
  ADD COLUMN IF NOT EXISTS pix_key_type text DEFAULT '',
  ADD COLUMN IF NOT EXISTS pix_key text DEFAULT '',
  ADD COLUMN IF NOT EXISTS user_type text DEFAULT '',
  ADD COLUMN IF NOT EXISTS responsible text DEFAULT '';
