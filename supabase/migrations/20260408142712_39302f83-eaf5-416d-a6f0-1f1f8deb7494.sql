DROP FUNCTION IF EXISTS public.create_prize_payment(uuid, uuid, uuid, text, text, text, text, numeric, text, text, boolean);

CREATE OR REPLACE FUNCTION public.create_prize_payment(
  p_owner_id uuid,
  p_account_id text DEFAULT ''::text,
  p_user_name text DEFAULT ''::text,
  p_user_email text DEFAULT ''::text,
  p_prize text DEFAULT ''::text,
  p_amount numeric DEFAULT 0,
  p_spin_result_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_status text;
  v_wu_id uuid;
  v_pix_key text;
  v_pix_key_type text;
  v_auto_payment boolean;
BEGIN
  SELECT wu.id, wu.pix_key, wu.pix_key_type, wu.auto_payment
  INTO v_wu_id, v_pix_key, v_pix_key_type, v_auto_payment
  FROM public.wheel_users wu
  WHERE wu.account_id = p_account_id
    AND wu.owner_id = p_owner_id
  LIMIT 1;

  IF COALESCE(v_auto_payment, false) THEN
    v_status := 'auto_pending';
  ELSE
    v_status := 'pending';
  END IF;

  INSERT INTO public.prize_payments (
    owner_id, wheel_user_id, spin_result_id, account_id,
    user_name, user_email, prize, amount,
    pix_key, pix_key_type, auto_payment, status
  ) VALUES (
    p_owner_id, v_wu_id, p_spin_result_id, p_account_id,
    p_user_name, p_user_email, p_prize, p_amount,
    COALESCE(v_pix_key, ''), COALESCE(v_pix_key_type, ''),
    COALESCE(v_auto_payment, false), v_status
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'auto_payment', COALESCE(v_auto_payment, false)
  );
END;
$function$;