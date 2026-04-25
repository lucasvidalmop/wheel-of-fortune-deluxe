
CREATE OR REPLACE FUNCTION public.touch_battle_participants_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE TABLE public.battle_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  game TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  edpay_transaction_id UUID,
  consumed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_battle_participants_owner ON public.battle_participants(owner_id, created_at DESC);
CREATE UNIQUE INDEX idx_battle_participants_unique_tx ON public.battle_participants(edpay_transaction_id) WHERE edpay_transaction_id IS NOT NULL;

ALTER TABLE public.battle_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own battle_participants"
ON public.battle_participants FOR SELECT TO authenticated
USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own battle_participants"
ON public.battle_participants FOR INSERT TO authenticated
WITH CHECK ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own battle_participants"
ON public.battle_participants FOR UPDATE TO authenticated
USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete own battle_participants"
ON public.battle_participants FOR DELETE TO authenticated
USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages battle_participants"
ON public.battle_participants FOR ALL TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE TRIGGER update_battle_participants_updated_at
BEFORE UPDATE ON public.battle_participants
FOR EACH ROW EXECUTE FUNCTION public.touch_battle_participants_updated_at();

ALTER TABLE public.battle_participants REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_participants;
