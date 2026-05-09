CREATE OR REPLACE FUNCTION public.get_luckybox_user_state(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user public.wheel_users%ROWTYPE;
BEGIN
  SELECT * INTO v_user FROM public.wheel_users WHERE id = p_user_id LIMIT 1;
  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  RETURN jsonb_build_object(
    'found', true,
    'id', v_user.id,
    'name', COALESCE(v_user.name, ''),
    'email', COALESCE(v_user.email, ''),
    'account_id', COALESCE(v_user.account_id, ''),
    'tokens_balance', COALESCE(v_user.tokens_balance, 0),
    'case_grants', COALESCE(v_user.case_grants, '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_luckybox_user_state(uuid) TO anon, authenticated;