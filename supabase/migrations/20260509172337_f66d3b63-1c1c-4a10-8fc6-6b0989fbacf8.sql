
ALTER TABLE public.luckybox_grants
  ADD COLUMN IF NOT EXISTS batch_id uuid,
  ADD COLUMN IF NOT EXISTS one_per_user boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_luckybox_grants_batch_id ON public.luckybox_grants(batch_id);

CREATE OR REPLACE FUNCTION public.redeem_luckybox_grant(p_owner_id uuid, p_account_id text, p_email text, p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_grant public.luckybox_grants%ROWTYPE;
  v_user public.wheel_users%ROWTYPE;
  v_grants jsonb;
  v_current integer;
  v_case_key text;
  v_queue jsonb;
  v_existing jsonb;
  v_forced jsonb;
  v_dup_count integer;
BEGIN
  SELECT * INTO v_grant FROM public.luckybox_grants
  WHERE upper(btrim(code)) = upper(btrim(p_code))
    AND owner_id = p_owner_id
  FOR UPDATE;

  IF v_grant.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código inválido');
  END IF;
  IF v_grant.status = 'redeemed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código já utilizado');
  END IF;
  IF v_grant.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código cancelado');
  END IF;

  SELECT * INTO v_user FROM public.wheel_users
  WHERE owner_id = p_owner_id
    AND btrim(account_id) = btrim(p_account_id)
    AND lower(btrim(email)) = lower(btrim(p_email))
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conta não encontrada para este código');
  END IF;
  IF v_grant.wheel_user_id IS NOT NULL AND v_grant.wheel_user_id <> v_user.id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este código não é seu');
  END IF;

  -- Enforce one-per-user per batch
  IF v_grant.one_per_user = true AND v_grant.batch_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_dup_count FROM public.luckybox_grants
    WHERE batch_id = v_grant.batch_id
      AND status = 'redeemed'
      AND id <> v_grant.id
      AND (
        wheel_user_id = v_user.id
        OR lower(btrim(recipient_email)) = lower(btrim(p_email))
        OR btrim(recipient_account_id) = btrim(p_account_id)
      );
    IF v_dup_count > 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Você já resgatou um código deste lote');
    END IF;
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
  SET status = 'redeemed', redeemed_at = now(),
      wheel_user_id = COALESCE(wheel_user_id, v_user.id),
      recipient_email = CASE WHEN COALESCE(recipient_email,'') = '' THEN p_email ELSE recipient_email END,
      recipient_account_id = CASE WHEN COALESCE(recipient_account_id,'') = '' THEN p_account_id ELSE recipient_account_id END,
      updated_at = now()
  WHERE id = v_grant.id;

  RETURN jsonb_build_object(
    'success', true, 'case_id', v_grant.case_id, 'case_name', v_grant.case_name,
    'quantity', v_grant.quantity, 'case_grants', v_grants
  );
END;
$function$;
