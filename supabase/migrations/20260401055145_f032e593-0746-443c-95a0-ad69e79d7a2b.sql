
DROP POLICY IF EXISTS "Anon can insert spin_results" ON public.spin_results;
CREATE POLICY "Anyone can insert spin_results"
ON public.spin_results
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
