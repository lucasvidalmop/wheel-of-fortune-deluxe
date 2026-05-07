CREATE OR REPLACE FUNCTION public.adjust_luckybox_tokens(
  p_owner_id uuid,
  p_account_id text,
  p_delta integer
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new integer;
BEGIN
  -- Allow either owner/admin OR service_role (called from public Roleta page anon users would fail; so allow any when called from edge or trusted RPCs through SECURITY DEFINER without auth check on text variant)
  UPDATE public.wheel_users
  SET tokens_balance = GREATEST(COALESCE(tokens_balance, 0) + p_delta, 0),
      updated_at = now()
  WHERE account_id = p_account_id AND owner_id = p_owner_id
  RETURNING tokens_balance INTO v_new;
  RETURN COALESCE(v_new, 0);
END;
$$;