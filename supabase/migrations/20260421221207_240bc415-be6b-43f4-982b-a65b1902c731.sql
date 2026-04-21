-- 1. Log dedicado ClickSend
CREATE TABLE public.sms_cs_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  recipient_name text NOT NULL DEFAULT '',
  recipient_phone text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  batch_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_cs_message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sms_cs logs"
  ON public.sms_cs_message_log FOR SELECT TO authenticated
  USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own sms_cs logs"
  ON public.sms_cs_message_log FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own sms_cs logs"
  ON public.sms_cs_message_log FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- 2. Coluna de permissão sms_cs
ALTER TABLE public.operator_permissions
  ADD COLUMN IF NOT EXISTS sms_cs boolean NOT NULL DEFAULT true;

ALTER TABLE public.operator_permissions_defaults
  ADD COLUMN IF NOT EXISTS sms_cs boolean NOT NULL DEFAULT true;