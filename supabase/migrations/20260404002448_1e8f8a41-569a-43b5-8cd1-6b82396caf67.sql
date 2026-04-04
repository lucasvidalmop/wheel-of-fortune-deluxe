CREATE TABLE public.site_settings (
  id integer PRIMARY KEY DEFAULT 1,
  bg_image_url text DEFAULT '',
  site_title text DEFAULT 'Wheel of Fortune',
  site_description text DEFAULT '',
  favicon_url text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO public.site_settings (id) VALUES (1);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site_settings"
ON public.site_settings FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admins can update site_settings"
ON public.site_settings FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));