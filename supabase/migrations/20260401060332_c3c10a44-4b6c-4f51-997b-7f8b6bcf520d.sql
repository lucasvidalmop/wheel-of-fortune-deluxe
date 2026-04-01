
-- Wheel configs per user
CREATE TABLE public.wheel_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.wheel_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own config"
ON public.wheel_configs FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own config"
ON public.wheel_configs FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own config"
ON public.wheel_configs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Anon can read config by slug"
ON public.wheel_configs FOR SELECT TO anon
USING (true);

-- Add owner_id to wheel_users
ALTER TABLE public.wheel_users ADD COLUMN owner_id UUID;

-- Add owner_id to spin_results
ALTER TABLE public.spin_results ADD COLUMN owner_id UUID;

-- Policy: users can see their own wheel_users
CREATE POLICY "Users can select own wheel_users"
ON public.wheel_users FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own wheel_users"
ON public.wheel_users FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own wheel_users"
ON public.wheel_users FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete own wheel_users"
ON public.wheel_users FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Policy: users can see their own spin_results
CREATE POLICY "Users can read own spin_results"
ON public.spin_results FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Anon insert spin_results with owner_id
DROP POLICY IF EXISTS "Anyone can insert spin_results" ON public.spin_results;
CREATE POLICY "Anyone can insert spin_results"
ON public.spin_results FOR INSERT TO anon, authenticated
WITH CHECK (true);
