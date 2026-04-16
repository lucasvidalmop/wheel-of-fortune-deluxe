CREATE POLICY "Authenticated users can read email_send_log"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (true);