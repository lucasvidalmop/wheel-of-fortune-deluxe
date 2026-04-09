
CREATE TABLE public.scheduled_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  message text NOT NULL,
  recipient_type text NOT NULL DEFAULT 'individual',
  recipient_value text NOT NULL,
  recipient_label text NOT NULL DEFAULT '',
  scheduled_at timestamp with time zone NOT NULL,
  recurrence text NOT NULL DEFAULT 'none',
  status text NOT NULL DEFAULT 'pending',
  last_sent_at timestamp with time zone,
  next_run_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own scheduled_messages" ON public.scheduled_messages FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own scheduled_messages" ON public.scheduled_messages FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own scheduled_messages" ON public.scheduled_messages FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Users can delete own scheduled_messages" ON public.scheduled_messages FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE INDEX idx_scheduled_messages_next_run ON public.scheduled_messages (next_run_at) WHERE status = 'pending';
