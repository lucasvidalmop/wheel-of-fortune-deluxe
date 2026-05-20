
CREATE OR REPLACE FUNCTION public.place_ticket(
  p_owner_id uuid, p_email text, p_account_id text, p_selections jsonb, p_amount integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user public.wheel_users%ROWTYPE;
  v_sel jsonb;
  v_event public.bet_events%ROWTYPE;
  v_outcome public.bet_outcomes%ROWTYPE;
  v_market public.bet_markets%ROWTYPE;
  v_closes_at timestamptz;
  v_status text;
  v_n integer := 0;
  v_base numeric := 1;
  v_house numeric := 1;
  v_bonus numeric := 1;
  v_final numeric;
  v_potential integer;
  v_ticket_id uuid;
  v_code text;
  v_seen text[] := ARRAY[]::text[];
  v_events text[] := ARRAY[]::text[];
  v_key text;
  v_event_title text;
  v_market_title text;
  v_same_fixture boolean := false;
  v_cfg jsonb;
  v_op_max_odd numeric;
  v_op_max_return integer;
  v_op_min_bet integer;
  v_op_max_bet integer;
  v_max_odd numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount'); END IF;
  IF jsonb_typeof(p_selections) <> 'array' OR jsonb_array_length(p_selections) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'need_min_two_selections'); END IF;
  IF jsonb_array_length(p_selections) > 20 THEN
    RETURN jsonb_build_object('success', false, 'error', 'too_many_selections'); END IF;

  SELECT page_config INTO v_cfg FROM public.bets_configs
   WHERE owner_id = p_owner_id ORDER BY created_at LIMIT 1;
  v_op_max_odd    := NULLIF((v_cfg->'multiTicket'->>'maxOdd'),'')::numeric;
  v_op_max_return := COALESCE(NULLIF((v_cfg->'multiTicket'->>'maxReturn'),'')::int, 0);
  v_op_min_bet    := GREATEST(1, COALESCE(NULLIF((v_cfg->'multiTicket'->>'minBet'),'')::int, 1));
  v_op_max_bet    := COALESCE(NULLIF((v_cfg->'multiTicket'->>'maxBet'),'')::int, 0);
  v_max_odd := LEAST(1000::numeric, COALESCE(v_op_max_odd, 1000));

  IF p_amount < v_op_min_bet THEN
    RETURN jsonb_build_object('success', false, 'error', 'stake_below_min'); END IF;
  IF v_op_max_bet > 0 AND p_amount > v_op_max_bet THEN
    RETURN jsonb_build_object('success', false, 'error', 'stake_above_max'); END IF;

  SELECT * INTO v_user FROM public.wheel_users
   WHERE owner_id = p_owner_id AND lower(email) = lower(p_email) AND account_id = p_account_id
   FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'user_not_found'); END IF;
  IF COALESCE(v_user.tokens_balance, 0) < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance'); END IF;

  FOR v_sel IN SELECT * FROM jsonb_array_elements(p_selections) LOOP
    v_n := v_n + 1;
    SELECT * INTO v_outcome FROM public.bet_outcomes WHERE id = (v_sel->>'outcomeId')::uuid;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'outcome_not_found'); END IF;
    SELECT * INTO v_event FROM public.bet_events WHERE id = v_outcome.event_id AND owner_id = p_owner_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'event_not_found'); END IF;
    IF v_event.status NOT IN ('open','scheduled') THEN
      RETURN jsonb_build_object('success', false, 'error', 'event_not_open', 'event_id', v_event.id); END IF;
    v_closes_at := v_event.closes_at; v_status := v_event.status;
    IF v_outcome.market_id IS NOT NULL THEN
      SELECT * INTO v_market FROM public.bet_markets WHERE id = v_outcome.market_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'market_not_found'); END IF;
      v_closes_at := COALESCE(v_market.closes_at, v_closes_at);
      v_status := v_market.status;
      IF v_status NOT IN ('open','scheduled') THEN
        RETURN jsonb_build_object('success', false, 'error', 'market_not_open'); END IF;
    END IF;
    IF v_closes_at IS NOT NULL AND v_closes_at < now() THEN
      RETURN jsonb_build_object('success', false, 'error', 'event_closed'); END IF;
    v_key := v_outcome.event_id::text || ':' || COALESCE(v_outcome.market_id::text, 'main');
    IF v_key = ANY(v_seen) THEN
      RETURN jsonb_build_object('success', false, 'error', 'duplicate_market'); END IF;
    v_seen := array_append(v_seen, v_key);
    IF v_outcome.event_id::text = ANY(v_events) THEN v_same_fixture := true; END IF;
    v_events := array_append(v_events, v_outcome.event_id::text);
    v_base := v_base * v_outcome.odd;
  END LOOP;

  IF v_n >= 2 THEN
    v_house := 0.97;
    IF v_base > 50  THEN v_house := LEAST(v_house, 0.90); END IF;
    IF v_base > 100 THEN v_house := LEAST(v_house, 0.80); END IF;
    IF v_same_fixture THEN v_house := LEAST(v_house, 0.85); END IF;
    IF v_n >= 10 THEN v_bonus := 1.20;
    ELSIF v_n >= 8 THEN v_bonus := 1.12;
    ELSIF v_n >= 5 THEN v_bonus := 1.07;
    ELSIF v_n >= 3 THEN v_bonus := 1.03;
    ELSE v_bonus := 1; END IF;
  END IF;

  v_final := ROUND(v_base * v_house * v_bonus, 2);
  IF v_final > v_max_odd THEN
    RETURN jsonb_build_object('success', false, 'error', 'odd_above_max', 'max_odd', v_max_odd); END IF;
  v_potential := ROUND(p_amount * v_final)::int;
  IF v_op_max_return > 0 AND v_potential > v_op_max_return THEN
    RETURN jsonb_build_object('success', false, 'error', 'return_above_max', 'max_return', v_op_max_return); END IF;

  v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));
  INSERT INTO public.bet_tickets (
    owner_id, wheel_user_id, account_id, user_email, user_name,
    public_code, total_odd, stake, potential_return, status
  ) VALUES (
    p_owner_id, v_user.id, v_user.account_id, v_user.email, COALESCE(v_user.name, ''),
    v_code, v_final, p_amount, v_potential, 'pending'
  ) RETURNING id INTO v_ticket_id;

  FOR v_sel IN SELECT * FROM jsonb_array_elements(p_selections) LOOP
    SELECT * INTO v_outcome FROM public.bet_outcomes WHERE id = (v_sel->>'outcomeId')::uuid;
    SELECT title INTO v_event_title FROM public.bet_events WHERE id = v_outcome.event_id;
    v_market_title := '';
    IF v_outcome.market_id IS NOT NULL THEN
      SELECT title INTO v_market_title FROM public.bet_markets WHERE id = v_outcome.market_id;
    END IF;
    INSERT INTO public.bet_ticket_selections (
      ticket_id, owner_id, event_id, market_id, outcome_id,
      event_title, market_title, selection_label, odd, status
    ) VALUES (
      v_ticket_id, p_owner_id, v_outcome.event_id, v_outcome.market_id, v_outcome.id,
      COALESCE(v_event_title,''), COALESCE(v_market_title,''), v_outcome.label, v_outcome.odd, 'pending'
    );
  END LOOP;

  UPDATE public.wheel_users SET tokens_balance = tokens_balance - p_amount, updated_at = now()
   WHERE id = v_user.id;

  RETURN jsonb_build_object(
    'success', true, 'ticket_id', v_ticket_id, 'public_code', v_code,
    'base_odd', v_base, 'house_factor', v_house, 'bonus', v_bonus,
    'total_odd', v_final, 'potential_return', v_potential,
    'new_balance', v_user.tokens_balance - p_amount
  );
END;
$$;
