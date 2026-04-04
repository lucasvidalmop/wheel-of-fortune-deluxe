CREATE OR REPLACE FUNCTION public.decrement_wheel_user_spins(p_account_id text, p_owner_id uuid DEFAULT NULL)
RETURNS TABLE(spins_available integer, owner_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.wheel_users wu
  SET spins_available = GREATEST(0, wu.spins_available - 1),
      fixed_prize_enabled = false,
      fixed_prize_segment = NULL,
      updated_at = now()
  WHERE wu.account_id = p_account_id
    AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id);

  RETURN QUERY
    SELECT wu.spins_available, wu.owner_id
    FROM public.wheel_users wu
    WHERE wu.account_id = p_account_id
      AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
    LIMIT 1;
END;
$$;