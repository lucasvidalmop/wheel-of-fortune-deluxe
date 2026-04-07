UPDATE public.wheel_users
SET
  email = lower(btrim(email)),
  account_id = btrim(account_id),
  updated_at = now()
WHERE email IS DISTINCT FROM lower(btrim(email))
   OR account_id IS DISTINCT FROM btrim(account_id);

CREATE OR REPLACE FUNCTION public.normalize_wheel_user_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := lower(btrim(NEW.email));
  END IF;

  IF NEW.account_id IS NOT NULL THEN
    NEW.account_id := btrim(NEW.account_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_wheel_user_identity_before_write ON public.wheel_users;

CREATE TRIGGER normalize_wheel_user_identity_before_write
BEFORE INSERT OR UPDATE ON public.wheel_users
FOR EACH ROW
EXECUTE FUNCTION public.normalize_wheel_user_identity();

CREATE OR REPLACE FUNCTION public.authenticate_wheel_user(
  p_email text,
  p_account_id text,
  p_owner_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  id uuid,
  name text,
  spins_available integer,
  account_id text,
  owner_id uuid,
  fixed_prize_enabled boolean,
  fixed_prize_segment integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
    SELECT wu.id, wu.name, wu.spins_available, wu.account_id, wu.owner_id,
           wu.fixed_prize_enabled, wu.fixed_prize_segment
    FROM public.wheel_users wu
    WHERE lower(btrim(wu.email)) = lower(btrim(p_email))
      AND btrim(wu.account_id) = btrim(p_account_id)
      AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
    LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_wheel_user_spins(
  p_account_id text,
  p_owner_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  name text,
  spins_available integer,
  owner_id uuid,
  fixed_prize_enabled boolean,
  fixed_prize_segment integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
    SELECT wu.name, wu.spins_available, wu.owner_id,
           wu.fixed_prize_enabled, wu.fixed_prize_segment
    FROM public.wheel_users wu
    WHERE btrim(wu.account_id) = btrim(p_account_id)
      AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
    LIMIT 1;
END;
$function$;