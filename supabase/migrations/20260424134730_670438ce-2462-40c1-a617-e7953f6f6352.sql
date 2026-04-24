-- 1) Tabela de log de envios da segunda instância de WhatsApp
CREATE TABLE public.whatsapp2_message_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  recipient_phone text NOT NULL,
  recipient_name text NOT NULL DEFAULT ''::text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'sent'::text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp2_message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own whatsapp2 logs"
ON public.whatsapp2_message_log
FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can read own whatsapp2 logs"
ON public.whatsapp2_message_log
FOR SELECT TO authenticated
USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_whatsapp2_message_log_owner_created
  ON public.whatsapp2_message_log (owner_id, created_at DESC);

-- 2) Nova permissão whatsapp2
ALTER TABLE public.operator_permissions
  ADD COLUMN IF NOT EXISTS whatsapp2 boolean NOT NULL DEFAULT true;

ALTER TABLE public.operator_permissions_defaults
  ADD COLUMN IF NOT EXISTS whatsapp2 boolean NOT NULL DEFAULT true;