CREATE POLICY "Users can delete own whatsapp2 logs"
ON public.whatsapp2_message_log
FOR DELETE
TO authenticated
USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));