
CREATE TABLE public.page_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text NOT NULL,
  owner_id uuid,
  slug text,
  ip_address text,
  city text,
  region text,
  country text,
  device_type text,
  os text,
  browser text,
  referrer text,
  page_url text,
  duration_seconds integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Operators can view their own page views
CREATE POLICY "Users can read own page_views"
ON public.page_views
FOR SELECT
TO authenticated
USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Allow anonymous inserts for tracking (the edge function uses service role but the anon insert policy is a fallback)
CREATE POLICY "Anyone can insert page_views"
ON public.page_views
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow updates for duration tracking
CREATE POLICY "Anyone can update page_views duration"
ON public.page_views
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE INDEX idx_page_views_owner_id ON public.page_views(owner_id);
CREATE INDEX idx_page_views_slug ON public.page_views(slug);
CREATE INDEX idx_page_views_created_at ON public.page_views(created_at DESC);
CREATE INDEX idx_page_views_session_id ON public.page_views(session_id);
