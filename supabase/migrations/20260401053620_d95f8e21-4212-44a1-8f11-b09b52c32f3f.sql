CREATE POLICY "Allow anon to read wheel_users for auth"
ON public.wheel_users
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow anon to update spins"
ON public.wheel_users
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);