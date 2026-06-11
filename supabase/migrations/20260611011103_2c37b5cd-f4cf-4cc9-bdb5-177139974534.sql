CREATE OR REPLACE FUNCTION public.auto_credit_luckybox_grant(p_grant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_grant public.luckybox_grants;
  v_user public.wheel_users;
  v_grants jsonb;
  v_queue jsonb;
  v_case_key text;
  v_current int;
  v_forced jsonb;
  v_existing jsonb;
BEGIN
  SELECT * INTO v_grant FROM public.luckybox_grants WHERE id = p_grant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Grant not found');
  END IF;
  -- Only the owner can auto-credit
  IF v_grant.owner_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;
  IF v_grant.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already processed');
  END IF;
  IF v_grant.wheel_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No recipient user');
  END IF;

  SELECT * INTO v_user FROM public.wheel_users WHERE id = v_grant.wheel_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recipient user not found');
  END IF;

  v_grants := COALESCE(v_user.case_grants, '{}'::jsonb);
  v_case_key := v_grant.case_id::text;
  v_current := COALESCE((v_grants->>v_case_key)::integer, 0);
  v_grants := jsonb_set(v_grants, ARRAY[v_case_key], to_jsonb(v_current + GREATEST(v_grant.quantity, 1)), true);

  v_queue := COALESCE(v_user.forced_prize_queue, '{}'::jsonb);
  v_forced := COALESCE(v_grant.forced_prizes, '[]'::jsonb);
  IF jsonb_typeof(v_forced) = 'array' AND jsonb_array_length(v_forced) > 0 THEN
    v_existing := COALESCE(v_queue->v_case_key, '[]'::jsonb);
    v_existing := v_existing || v_forced;
    v_queue := jsonb_set(v_queue, ARRAY[v_case_key], v_existing, true);
  END IF;

  UPDATE public.wheel_users
  SET case_grants = v_grants, forced_prize_queue = v_queue, updated_at = now()
  WHERE id = v_user.id;

  UPDATE public.luckybox_grants
  SET status = 'redeemed', redeemed_at = now(), updated_at = now()
  WHERE id = v_grant.id;

  RETURN jsonb_build_object('success', true, 'case_id', v_grant.case_id, 'quantity', v_grant.quantity);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.auto_credit_luckybox_grant(uuid) TO authenticated;