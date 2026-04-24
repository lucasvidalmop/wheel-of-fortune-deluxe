
CREATE TABLE IF NOT EXISTS public.whatsapp_share_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_share_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own whatsapp_share_templates"
ON public.whatsapp_share_templates FOR SELECT TO authenticated
USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own whatsapp_share_templates"
ON public.whatsapp_share_templates FOR INSERT TO authenticated
WITH CHECK ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own whatsapp_share_templates"
ON public.whatsapp_share_templates FOR UPDATE TO authenticated
USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete own whatsapp_share_templates"
ON public.whatsapp_share_templates FOR DELETE TO authenticated
USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_whatsapp_share_templates_owner ON public.whatsapp_share_templates(owner_id, updated_at DESC);
