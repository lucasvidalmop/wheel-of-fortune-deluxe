
CREATE TABLE public.sms_message_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  recipient_phone text NOT NULL,
  recipient_name text NOT NULL DEFAULT '',
  message text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sms logs" ON public.sms_message_log FOR SELECT TO authenticated USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert own sms logs" ON public.sms_message_log FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can delete own sms logs" ON public.sms_message_log FOR DELETE TO authenticated USING (owner_id = auth.uid());
