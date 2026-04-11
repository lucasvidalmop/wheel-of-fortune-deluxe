CREATE OR REPLACE FUNCTION public.get_wheel_user_spins(p_account_id text, p_owner_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(name text, spins_available integer, owner_id uuid, fixed_prize_enabled boolean, fixed_prize_segment integer)
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Auto-expire spins
  UPDATE public.wheel_users wu
  SET spins_available = 0, fixed_prize_enabled = false, fixed_prize_segment = NULL, spins_expire_at = NULL, updated_at = now()
  WHERE btrim(wu.account_id) = btrim(p_account_id)
    AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
    AND wu.spins_expire_at IS NOT NULL AND wu.spins_expire_at <= now()
    AND wu.spins_available > 0;

  RETURN QUERY
    SELECT wu.name, wu.spins_available, wu.owner_id,
           wu.fixed_prize_enabled, wu.fixed_prize_segment
    FROM public.wheel_users wu
    WHERE btrim(wu.account_id) = btrim(p_account_id)
      AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
    LIMIT 1;
END;
$function$;