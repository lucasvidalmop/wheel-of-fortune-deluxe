CREATE OR REPLACE FUNCTION public.authenticate_wheel_user(p_email text, p_account_id text, p_owner_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, name text, spins_available integer, account_id text, owner_id uuid, fixed_prize_enabled boolean, fixed_prize_segment integer)
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user public.wheel_users%ROWTYPE;
BEGIN
  -- Auto-expire spins for exact or fallback matches within the same owner
  UPDATE public.wheel_users wu
  SET spins_available = 0,
      fixed_prize_enabled = false,
      fixed_prize_segment = NULL,
      spins_expire_at = NULL,
      updated_at = now()
  WHERE (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
    AND wu.spins_expire_at IS NOT NULL
    AND wu.spins_expire_at <= now()
    AND wu.spins_available > 0
    AND (
      (lower(btrim(wu.email)) = lower(btrim(p_email)) AND btrim(wu.account_id) = btrim(p_account_id))
      OR btrim(wu.account_id) = btrim(p_account_id)
      OR lower(btrim(wu.email)) = lower(btrim(p_email))
    );

  -- 1) Exact match: email + account id
  SELECT * INTO v_user
  FROM public.wheel_users wu
  WHERE lower(btrim(wu.email)) = lower(btrim(p_email))
    AND btrim(wu.account_id) = btrim(p_account_id)
    AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
  ORDER BY wu.created_at DESC NULLS LAST
  LIMIT 1;

  -- 2) Fallback by account id
  IF v_user.id IS NULL THEN
    SELECT * INTO v_user
    FROM public.wheel_users wu
    WHERE btrim(wu.account_id) = btrim(p_account_id)
      AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
    ORDER BY wu.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  -- 3) Fallback by email
  IF v_user.id IS NULL THEN
    SELECT * INTO v_user
    FROM public.wheel_users wu
    WHERE lower(btrim(wu.email)) = lower(btrim(p_email))
      AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
    ORDER BY wu.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_user.id IS NULL THEN
    RETURN;
  END IF;

  -- Keep registration data aligned with what the user typed when the row was found by fallback
  IF lower(btrim(v_user.email)) <> lower(btrim(p_email)) OR btrim(v_user.account_id) <> btrim(p_account_id) THEN
    UPDATE public.wheel_users
    SET email = lower(btrim(p_email)),
        account_id = btrim(p_account_id),
        updated_at = now()
    WHERE public.wheel_users.id = v_user.id;

    SELECT * INTO v_user
    FROM public.wheel_users
    WHERE public.wheel_users.id = v_user.id;
  END IF;

  RETURN QUERY
  SELECT v_user.id,
         v_user.name,
         v_user.spins_available,
         v_user.account_id,
         v_user.owner_id,
         v_user.fixed_prize_enabled,
         v_user.fixed_prize_segment;
END;
$function$;