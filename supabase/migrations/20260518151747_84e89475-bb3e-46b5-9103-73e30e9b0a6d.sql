ALTER TABLE public.bet_events
  ADD COLUMN IF NOT EXISTS max_bets_per_user integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.place_bet(
  p_owner_id uuid, p_email text, p_account_id text,
  p_event_id uuid, p_outcome_id uuid, p_amount integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user public.wheel_users%ROWTYPE;
  v_event public.bet_events%ROWTYPE;
  v_outcome public.bet_outcomes%ROWTYPE;
  v_wager_id uuid;
  v_new_balance integer;
  v_existing_count integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;
  SELECT * INTO v_user FROM public.wheel_users
   WHERE owner_id = p_owner_id AND lower(email) = lower(p_email) AND account_id = p_account_id
   LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'user_not_found'); END IF;
  IF v_user.blacklisted THEN RETURN jsonb_build_object('success', false, 'error', 'user_blocked'); END IF;

  SELECT * INTO v_event FROM public.bet_events
   WHERE id = p_event_id AND owner_id = p_owner_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'event_not_found'); END IF;
  IF v_event.status <> 'open' THEN RETURN jsonb_build_object('success', false, 'error', 'event_not_open'); END IF;
  IF v_event.closes_at IS NOT NULL AND now() > v_event.closes_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'event_closed');
  END IF;
  IF p_amount < v_event.min_bet THEN
    RETURN jsonb_build_object('success', false, 'error', 'below_min_bet', 'min', v_event.min_bet);
  END IF;
  IF v_event.max_bet > 0 AND p_amount > v_event.max_bet THEN
    RETURN jsonb_build_object('success', false, 'error', 'above_max_bet', 'max', v_event.max_bet);
  END IF;

  IF v_event.max_bets_per_user > 0 THEN
    SELECT COUNT(*) INTO v_existing_count FROM public.bet_wagers
     WHERE event_id = p_event_id
       AND wheel_user_id = v_user.id
       AND status IN ('pending','won','lost');
    IF v_existing_count >= v_event.max_bets_per_user THEN
      RETURN jsonb_build_object('success', false, 'error', 'max_bets_reached',
        'max', v_event.max_bets_per_user, 'placed', v_existing_count);
    END IF;
  END IF;

  SELECT * INTO v_outcome FROM public.bet_outcomes
   WHERE id = p_outcome_id AND event_id = p_event_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'outcome_not_found'); END IF;

  IF COALESCE(v_user.tokens_balance, 0) < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance',
      'balance', COALESCE(v_user.tokens_balance, 0));
  END IF;

  UPDATE public.wheel_users SET tokens_balance = tokens_balance - p_amount, updated_at = now()
   WHERE id = v_user.id RETURNING tokens_balance INTO v_new_balance;

  INSERT INTO public.bet_wagers (
    owner_id, event_id, outcome_id, wheel_user_id, account_id, user_email, user_name,
    amount_coins, odd_snapshot, payout_mode
  ) VALUES (
    p_owner_id, p_event_id, p_outcome_id, v_user.id, v_user.account_id, v_user.email, v_user.name,
    p_amount, v_outcome.odd, v_event.payout_mode
  ) RETURNING id INTO v_wager_id;

  RETURN jsonb_build_object('success', true, 'wager_id', v_wager_id,
    'tokens_balance', v_new_balance, 'odd', v_outcome.odd);
END;
$$;