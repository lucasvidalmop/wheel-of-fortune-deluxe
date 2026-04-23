CREATE TABLE public.sms_mb_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  recipient_phone text NOT NULL,
  recipient_name text NOT NULL DEFAULT ''::text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'sent'::text,
  error_message text,
  batch_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_mb_message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own sms_mb logs"
ON public.sms_mb_message_log
FOR INSERT
TO authenticated
WITH CHECK ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can read own sms_mb logs"
ON public.sms_mb_message_log
FOR SELECT
TO authenticated
USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete own sms_mb logs"
ON public.sms_mb_message_log
FOR DELETE
TO authenticated
USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));