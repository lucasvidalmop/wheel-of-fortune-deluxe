-- 1. Fix page_views: remove overly permissive UPDATE policy (edge function uses service_role)
DROP POLICY IF EXISTS "Anyone can update page_views duration" ON public.page_views;

-- Also tighten INSERT: only allow via service role (edge function handles inserts)
DROP POLICY IF EXISTS "Anyone can insert page_views" ON public.page_views;

CREATE POLICY "Service role can insert page_views"
ON public.page_views FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update page_views"
ON public.page_views FOR UPDATE
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 2. Fix wheel_configs: restrict anon SELECT to only match requested slug via RPC
DROP POLICY IF EXISTS "Anon can read config by slug" ON public.wheel_configs;

CREATE OR REPLACE FUNCTION public.get_wheel_config_by_slug(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT config FROM public.wheel_configs WHERE slug = p_slug LIMIT 1;
$$;

-- 3. Fix user_roles: add explicit service-role-only mutation policies
CREATE POLICY "Only service role can insert roles"
ON public.user_roles FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only service role can update roles"
ON public.user_roles FOR UPDATE
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only service role can delete roles"
ON public.user_roles FOR DELETE
TO public
USING (auth.role() = 'service_role');