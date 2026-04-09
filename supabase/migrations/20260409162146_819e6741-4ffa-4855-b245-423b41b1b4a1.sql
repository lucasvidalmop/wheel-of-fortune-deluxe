ALTER TABLE public.scheduled_messages
  ADD COLUMN media_url text DEFAULT NULL,
  ADD COLUMN media_type text DEFAULT NULL,
  ADD COLUMN media_mimetype text DEFAULT NULL,
  ADD COLUMN media_filename text DEFAULT NULL,
  ADD COLUMN mention_all boolean DEFAULT false;