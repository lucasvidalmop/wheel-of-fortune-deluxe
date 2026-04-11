
DROP FUNCTION IF EXISTS public.get_wheel_user_spins(text, uuid);
DROP FUNCTION IF EXISTS public.authenticate_wheel_user(text, text, uuid);

-- Recreate get_wheel_user_spins with blacklisted
CREATE OR REPLACE FUNCTION public.get_wheel_user_spins(p_account_id text, p_owner_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(name text, spins_available integer, owner_id uuid, fixed_prize_enabled boolean, fixed_prize_segment integer, blacklisted boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.wheel_users wu
  SET spins_available = 0, fixed_prize_enabled = false, fixed_prize_segment = NULL, spins_expire_at = NULL, updated_at = now()
  WHERE btrim(wu.account_id) = btrim(p_account_id)
    AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
    AND wu.spins_expire_at IS NOT NULL AND wu.spins_expire_at <= now()
    AND wu.spins_available > 0;

  RETURN QUERY
    SELECT wu.name, wu.spins_available, wu.owner_id,
           wu.fixed_prize_enabled, wu.fixed_prize_segment, wu.blacklisted
    FROM public.wheel_users wu
    WHERE btrim(wu.account_id) = btrim(p_account_id)
      AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
    LIMIT 1;
END;
$function$;

-- Recreate authenticate_wheel_user with blacklisted
CREATE OR REPLACE FUNCTION public.authenticate_wheel_user(p_email text, p_account_id text, p_owner_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, name text, spins_available integer, account_id text, owner_id uuid, fixed_prize_enabled boolean, fixed_prize_segment integer, blacklisted boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user public.wheel_users%ROWTYPE;
BEGIN
  UPDATE public.wheel_users wu
  SET spins_available = 0, fixed_prize_enabled = false, fixed_prize_segment = NULL, spins_expire_at = NULL, updated_at = now()
  WHERE (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
    AND wu.spins_expire_at IS NOT NULL AND wu.spins_expire_at <= now()
    AND wu.spins_available > 0
    AND (
      (lower(btrim(wu.email)) = lower(btrim(p_email)) AND btrim(wu.account_id) = btrim(p_account_id))
      OR btrim(wu.account_id) = btrim(p_account_id)
      OR lower(btrim(wu.email)) = lower(btrim(p_email))
    );

  SELECT * INTO v_user FROM public.wheel_users wu
  WHERE lower(btrim(wu.email)) = lower(btrim(p_email))
    AND btrim(wu.account_id) = btrim(p_account_id)
    AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
  ORDER BY wu.created_at DESC NULLS LAST LIMIT 1;

  IF v_user.id IS NULL THEN
    SELECT * INTO v_user FROM public.wheel_users wu
    WHERE btrim(wu.account_id) = btrim(p_account_id)
      AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
    ORDER BY wu.created_at DESC NULLS LAST LIMIT 1;
  END IF;

  IF v_user.id IS NULL THEN
    SELECT * INTO v_user FROM public.wheel_users wu
    WHERE lower(btrim(wu.email)) = lower(btrim(p_email))
      AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
    ORDER BY wu.created_at DESC NULLS LAST LIMIT 1;
  END IF;

  IF v_user.id IS NULL THEN RETURN; END IF;

  IF lower(btrim(v_user.email)) <> lower(btrim(p_email)) OR btrim(v_user.account_id) <> btrim(p_account_id) THEN
    UPDATE public.wheel_users
    SET email = lower(btrim(p_email)), account_id = btrim(p_account_id), updated_at = now()
    WHERE public.wheel_users.id = v_user.id;
    SELECT * INTO v_user FROM public.wheel_users WHERE public.wheel_users.id = v_user.id;
  END IF;

  RETURN QUERY
  SELECT v_user.id, v_user.name, v_user.spins_available, v_user.account_id,
         v_user.owner_id, v_user.fixed_prize_enabled, v_user.fixed_prize_segment,
         v_user.blacklisted;
END;
$function$;
