
CREATE OR REPLACE FUNCTION public.create_prize_payment(
  p_owner_id uuid,
  p_wheel_user_id uuid DEFAULT NULL,
  p_spin_result_id uuid DEFAULT NULL,
  p_account_id text DEFAULT '',
  p_user_name text DEFAULT '',
  p_user_email text DEFAULT '',
  p_prize text DEFAULT '',
  p_amount numeric DEFAULT 0,
  p_pix_key text DEFAULT '',
  p_pix_key_type text DEFAULT '',
  p_auto_payment boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_status text;
BEGIN
  IF p_auto_payment THEN
    v_status := 'auto_pending';
  ELSE
    v_status := 'pending';
  END IF;

  INSERT INTO public.prize_payments (
    owner_id, wheel_user_id, spin_result_id, account_id,
    user_name, user_email, prize, amount,
    pix_key, pix_key_type, auto_payment, status
  ) VALUES (
    p_owner_id, p_wheel_user_id, p_spin_result_id, p_account_id,
    p_user_name, p_user_email, p_prize, p_amount,
    p_pix_key, p_pix_key_type, p_auto_payment, v_status
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
