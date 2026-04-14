CREATE POLICY "Service role can update edpay_transactions"
ON public.edpay_transactions
FOR UPDATE
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);