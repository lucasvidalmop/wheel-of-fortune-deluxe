-- Allow operators to delete their own spin results
CREATE POLICY "Users can delete own spin_results"
ON public.spin_results
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

-- Allow operators to delete their own page views
CREATE POLICY "Users can delete own page_views"
ON public.page_views
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());
