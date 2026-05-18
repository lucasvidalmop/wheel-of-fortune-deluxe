
CREATE OR REPLACE FUNCTION public.cancel_bet_wager(p_wager_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_w public.bet_wagers%ROWTYPE;
BEGIN
  SELECT * INTO v_w FROM public.bet_wagers WHERE id = p_wager_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'wager_not_found');
  END IF;
  IF v_w.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_pending', 'status', v_w.status);
  END IF;

  IF v_w.wheel_user_id IS NOT NULL THEN
    UPDATE public.wheel_users
       SET tokens_balance = COALESCE(tokens_balance, 0) + v_w.amount_coins,
           updated_at = now()
     WHERE id = v_w.wheel_user_id;
  END IF;

  UPDATE public.bet_wagers
     SET status = 'refunded',
         payout_coins = v_w.amount_coins,
         resolved_at = now()
   WHERE id = p_wager_id;

  RETURN jsonb_build_object('success', true, 'refunded', v_w.amount_coins);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_bet_wager(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_bet_wager(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_bet_wager(uuid) TO authenticated;
