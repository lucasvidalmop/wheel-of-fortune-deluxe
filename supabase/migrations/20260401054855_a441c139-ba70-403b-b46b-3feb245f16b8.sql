
CREATE TABLE public.spin_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  account_id TEXT NOT NULL,
  prize TEXT NOT NULL,
  spun_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.spin_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read spin_results"
ON public.spin_results
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anon can insert spin_results"
ON public.spin_results
FOR INSERT
TO anon
WITH CHECK (true);
