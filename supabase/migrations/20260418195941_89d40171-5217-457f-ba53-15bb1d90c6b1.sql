ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS dashboard_title text DEFAULT '',
  ADD COLUMN IF NOT EXISTS dashboard_description text DEFAULT '',
  ADD COLUMN IF NOT EXISTS dashboard_favicon_url text DEFAULT '';