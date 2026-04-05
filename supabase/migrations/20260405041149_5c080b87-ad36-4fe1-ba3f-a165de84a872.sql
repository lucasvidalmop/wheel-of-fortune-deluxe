DROP FUNCTION IF EXISTS public.get_wheel_config_by_slug(text);

CREATE FUNCTION public.get_wheel_config_by_slug(p_slug text)
RETURNS TABLE(user_id uuid, config jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT wc.user_id, wc.config FROM public.wheel_configs wc WHERE wc.slug = p_slug LIMIT 1;
$$;