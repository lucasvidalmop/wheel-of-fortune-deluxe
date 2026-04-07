CREATE TABLE public.whatsapp_message_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  recipient_phone text NOT NULL,
  recipient_name text NOT NULL DEFAULT '',
  message text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own whatsapp logs"
ON public.whatsapp_message_log
FOR SELECT
TO authenticated
USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own whatsapp logs"
ON public.whatsapp_message_log
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE INDEX idx_whatsapp_log_owner ON public.whatsapp_message_log(owner_id, created_at DESC);