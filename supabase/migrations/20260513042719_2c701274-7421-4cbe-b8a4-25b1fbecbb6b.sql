CREATE POLICY "Users can delete own wheel_configs"
  ON public.wheel_configs FOR DELETE
  TO authenticated
  USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own config_backups"
  ON public.config_backups FOR UPDATE
  TO authenticated
  USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));