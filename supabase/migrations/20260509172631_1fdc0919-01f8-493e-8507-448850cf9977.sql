
CREATE OR REPLACE FUNCTION public.authenticate_luckybox_user(p_email text, p_account_id text, p_owner_id uuid)
 RETURNS TABLE(id uuid, name text, account_id text, email text, owner_id uuid, blacklisted boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT wu.id, wu.name, wu.account_id, wu.email, wu.owner_id, COALESCE(wu.blacklisted, false)
  FROM public.wheel_users wu
  WHERE (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
    AND lower(btrim(wu.email)) = lower(btrim(p_email))
    AND btrim(wu.account_id) = btrim(p_account_id)
  ORDER BY wu.created_at DESC NULLS LAST
  LIMIT 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.authenticate_luckybox_user(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.authenticate_luckybox_user(text, text, uuid) TO anon, authenticated, service_role;
