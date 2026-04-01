
-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "Anyone can insert spin_results" ON public.spin_results;

-- Create a secure RPC for recording spin results
CREATE OR REPLACE FUNCTION public.record_spin_result(
  p_account_id text,
  p_user_name text,
  p_user_email text,
  p_prize text,
  p_owner_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spins integer;
  v_result_id uuid;
BEGIN
  -- Verify the wheel user exists and has spins
  SELECT spins_available INTO v_spins
  FROM public.wheel_users
  WHERE account_id = p_account_id
    AND (p_owner_id IS NULL OR owner_id = p_owner_id)
  LIMIT 1;

  IF v_spins IS NULL OR v_spins < 1 THEN
    RAISE EXCEPTION 'No spins available or user not found';
  END IF;

  INSERT INTO public.spin_results (account_id, user_name, user_email, prize, owner_id)
  VALUES (p_account_id, p_user_name, p_user_email, p_prize, p_owner_id)
  RETURNING id INTO v_result_id;

  RETURN v_result_id;
END;
$$;
