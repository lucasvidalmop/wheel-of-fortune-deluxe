CREATE TABLE public.scheduled_brevo_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_email TEXT NOT NULL,
  sender_name TEXT NOT NULL DEFAULT '',
  reply_to TEXT,
  subject TEXT NOT NULL,
  html_content TEXT,
  text_content TEXT,
  source TEXT NOT NULL DEFAULT 'csv',
  csv_recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  scheduled_at TIMESTAMPTZ NOT NULL,
  recurrence TEXT NOT NULL DEFAULT 'none',
  status TEXT NOT NULL DEFAULT 'pending',
  next_run_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  last_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_brevo_next_run
  ON public.scheduled_brevo_emails (next_run_at)
  WHERE status = 'pending';

ALTER TABLE public.scheduled_brevo_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own scheduled brevo"
  ON public.scheduled_brevo_emails FOR SELECT
  TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own scheduled brevo"
  ON public.scheduled_brevo_emails FOR INSERT
  TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own scheduled brevo"
  ON public.scheduled_brevo_emails FOR UPDATE
  TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own scheduled brevo"
  ON public.scheduled_brevo_emails FOR DELETE
  TO authenticated USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_scheduled_brevo_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER touch_scheduled_brevo_emails_updated
  BEFORE UPDATE ON public.scheduled_brevo_emails
  FOR EACH ROW EXECUTE FUNCTION public.touch_scheduled_brevo_updated_at();

-- initialize next_run_at on insert
CREATE OR REPLACE FUNCTION public.init_scheduled_brevo_next_run()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.next_run_at IS NULL THEN NEW.next_run_at := NEW.scheduled_at; END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER init_scheduled_brevo_next_run
  BEFORE INSERT ON public.scheduled_brevo_emails
  FOR EACH ROW EXECUTE FUNCTION public.init_scheduled_brevo_next_run();