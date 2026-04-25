CREATE OR REPLACE FUNCTION public.get_deposit_config_by_tag(p_tag text)
RETURNS TABLE(user_id uuid, config jsonb)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT wc.user_id, wc.config
  FROM public.wheel_configs wc
  WHERE lower(COALESCE(wc.config->'depositConfig'->>'tag', '')) = lower(btrim(p_tag))
    AND COALESCE((wc.config->'depositConfig'->>'enabled')::boolean, false) = true
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_deposit_config_by_tag(text) TO anon, authenticated;