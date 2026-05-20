
-- 1. bet_tickets
CREATE TABLE public.bet_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  wheel_user_id uuid,
  account_id text NOT NULL DEFAULT '',
  user_email text NOT NULL DEFAULT '',
  user_name text NOT NULL DEFAULT '',
  public_code text NOT NULL UNIQUE,
  total_odd numeric NOT NULL DEFAULT 1,
  stake integer NOT NULL DEFAULT 0,
  potential_return integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  payout_coins integer NOT NULL DEFAULT 0,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bet_tickets_owner_idx ON public.bet_tickets(owner_id);
CREATE INDEX bet_tickets_wheel_user_idx ON public.bet_tickets(wheel_user_id);
CREATE INDEX bet_tickets_status_idx ON public.bet_tickets(status);

ALTER TABLE public.bet_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own bet_tickets" ON public.bet_tickets FOR SELECT TO authenticated
  USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners update own bet_tickets" ON public.bet_tickets FOR UPDATE TO authenticated
  USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners delete own bet_tickets" ON public.bet_tickets FOR DELETE TO authenticated
  USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages bet_tickets" ON public.bet_tickets FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 2. bet_ticket_selections
CREATE TABLE public.bet_ticket_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.bet_tickets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  event_id uuid NOT NULL,
  market_id uuid,
  outcome_id uuid NOT NULL,
  event_title text NOT NULL DEFAULT '',
  market_title text NOT NULL DEFAULT '',
  selection_label text NOT NULL DEFAULT '',
  odd numeric NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bet_ticket_selections_ticket_idx ON public.bet_ticket_selections(ticket_id);
CREATE INDEX bet_ticket_selections_event_idx ON public.bet_ticket_selections(event_id);
CREATE INDEX bet_ticket_selections_market_idx ON public.bet_ticket_selections(market_id);
CREATE INDEX bet_ticket_selections_outcome_idx ON public.bet_ticket_selections(outcome_id);
CREATE INDEX bet_ticket_selections_status_idx ON public.bet_ticket_selections(status);

ALTER TABLE public.bet_ticket_selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own bet_ticket_selections" ON public.bet_ticket_selections FOR SELECT TO authenticated
  USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners update own bet_ticket_selections" ON public.bet_ticket_selections FOR UPDATE TO authenticated
  USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners delete own bet_ticket_selections" ON public.bet_ticket_selections FOR DELETE TO authenticated
  USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages bet_ticket_selections" ON public.bet_ticket_selections FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 3. place_ticket
CREATE OR REPLACE FUNCTION public.place_ticket(
  p_owner_id uuid,
  p_email text,
  p_account_id text,
  p_selections jsonb,
  p_amount integer
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
  v_count integer := 0;
  v_total_odd numeric := 1;
  v_potential integer;
  v_ticket_id uuid;
  v_code text;
  v_seen text[] := ARRAY[]::text[];
  v_key text;
  v_event_title text;
  v_market_title text;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;
  IF jsonb_typeof(p_selections) <> 'array' OR jsonb_array_length(p_selections) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'need_min_two_selections');
  END IF;
  IF jsonb_array_length(p_selections) > 20 THEN
    RETURN jsonb_build_object('success', false, 'error', 'too_many_selections');
  END IF;

  SELECT * INTO v_user FROM public.wheel_users
   WHERE owner_id = p_owner_id AND lower(email) = lower(p_email) AND account_id = p_account_id
   FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'user_not_found'); END IF;
  IF COALESCE(v_user.tokens_balance, 0) < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance');
  END IF;

  -- validate each selection
  FOR v_sel IN SELECT * FROM jsonb_array_elements(p_selections) LOOP
    v_count := v_count + 1;
    SELECT * INTO v_outcome FROM public.bet_outcomes
     WHERE id = (v_sel->>'outcomeId')::uuid;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'outcome_not_found'); END IF;

    SELECT * INTO v_event FROM public.bet_events
     WHERE id = v_outcome.event_id AND owner_id = p_owner_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'event_not_found'); END IF;
    IF v_event.status NOT IN ('open','scheduled') THEN
      RETURN jsonb_build_object('success', false, 'error', 'event_not_open', 'event_id', v_event.id);
    END IF;

    v_closes_at := v_event.closes_at;
    v_status := v_event.status;

    IF v_outcome.market_id IS NOT NULL THEN
      SELECT * INTO v_market FROM public.bet_markets WHERE id = v_outcome.market_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'market_not_found'); END IF;
      v_closes_at := COALESCE(v_market.closes_at, v_closes_at);
      v_status := v_market.status;
      IF v_status NOT IN ('open','scheduled') THEN
        RETURN jsonb_build_object('success', false, 'error', 'market_not_open');
      END IF;
    END IF;

    IF v_closes_at IS NOT NULL AND v_closes_at < now() THEN
      RETURN jsonb_build_object('success', false, 'error', 'event_closed');
    END IF;

    -- dedupe by event + market
    v_key := v_outcome.event_id::text || ':' || COALESCE(v_outcome.market_id::text, 'main');
    IF v_key = ANY(v_seen) THEN
      RETURN jsonb_build_object('success', false, 'error', 'duplicate_market');
    END IF;
    v_seen := array_append(v_seen, v_key);

    v_total_odd := v_total_odd * v_outcome.odd;
  END LOOP;

  v_potential := ROUND(p_amount * v_total_odd)::int;
  v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));

  -- create ticket
  INSERT INTO public.bet_tickets (
    owner_id, wheel_user_id, account_id, user_email, user_name,
    public_code, total_odd, stake, potential_return, status
  ) VALUES (
    p_owner_id, v_user.id, v_user.account_id, v_user.email, COALESCE(v_user.name, ''),
    v_code, v_total_odd, p_amount, v_potential, 'pending'
  ) RETURNING id INTO v_ticket_id;

  -- create selections (re-read for snapshots)
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

  -- deduct balance
  UPDATE public.wheel_users SET tokens_balance = tokens_balance - p_amount, updated_at = now()
   WHERE id = v_user.id;

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', v_ticket_id,
    'public_code', v_code,
    'total_odd', v_total_odd,
    'potential_return', v_potential,
    'new_balance', v_user.tokens_balance - p_amount
  );
END;
$$;

-- 4. helper: resolve any tickets whose selections are all settled
CREATE OR REPLACE FUNCTION public._resolve_tickets_for_outcomes(p_outcome_ids uuid[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ticket record;
  v_total integer;
  v_won integer;
  v_lost integer;
  v_pending integer;
BEGIN
  FOR v_ticket IN
    SELECT DISTINCT t.*
      FROM public.bet_tickets t
      JOIN public.bet_ticket_selections s ON s.ticket_id = t.id
     WHERE s.outcome_id = ANY(p_outcome_ids) AND t.status = 'pending'
     FOR UPDATE OF t
  LOOP
    SELECT count(*) FILTER (WHERE status='won'),
           count(*) FILTER (WHERE status='lost'),
           count(*) FILTER (WHERE status='pending'),
           count(*)
      INTO v_won, v_lost, v_pending, v_total
      FROM public.bet_ticket_selections WHERE ticket_id = v_ticket.id;

    IF v_lost > 0 THEN
      UPDATE public.bet_tickets SET status='lost', resolved_at=now() WHERE id = v_ticket.id;
    ELSIF v_pending = 0 AND v_won = v_total THEN
      -- all won: credit
      UPDATE public.wheel_users
         SET tokens_balance = tokens_balance + v_ticket.potential_return, updated_at = now()
       WHERE id = v_ticket.wheel_user_id;
      UPDATE public.bet_tickets
         SET status='won', payout_coins = v_ticket.potential_return, resolved_at=now()
       WHERE id = v_ticket.id;
    END IF;
  END LOOP;
END;
$$;

-- 5. patch resolve_bet_event to also settle ticket selections + tickets
CREATE OR REPLACE FUNCTION public.resolve_bet_event(p_event_id uuid, p_winning_outcome_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_event public.bet_events%ROWTYPE;
  v_winner public.bet_outcomes%ROWTYPE;
  v_w record;
  v_payout integer;
  v_qty integer;
  v_grant_id uuid;
  v_processed integer := 0;
  v_outcome_ids uuid[];
BEGIN
  SELECT * INTO v_event FROM public.bet_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'event_not_found'); END IF;
  IF v_event.status = 'resolved' THEN RETURN jsonb_build_object('success', false, 'error', 'already_resolved'); END IF;

  SELECT * INTO v_winner FROM public.bet_outcomes
   WHERE id = p_winning_outcome_id AND event_id = p_event_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'outcome_not_in_event'); END IF;

  UPDATE public.bet_outcomes SET is_winner = (id = p_winning_outcome_id) WHERE event_id = p_event_id;

  FOR v_w IN SELECT * FROM public.bet_wagers WHERE event_id = p_event_id AND status = 'pending' LOOP
    IF v_w.outcome_id = p_winning_outcome_id THEN
      IF v_event.payout_mode = 'case' AND v_event.payout_case_id IS NOT NULL THEN
        v_qty := GREATEST(1, FLOOR(v_w.amount_coins * v_event.payout_case_qty_per_unit)::int);
        INSERT INTO public.luckybox_grants (
          owner_id, case_id, case_name, wheel_user_id,
          recipient_name, recipient_phone, recipient_email, recipient_account_id,
          code, status, quantity, one_per_user
        )
        SELECT v_event.owner_id, c.id, c.name, v_w.wheel_user_id,
               v_w.user_name, COALESCE((SELECT phone FROM public.wheel_users WHERE id = v_w.wheel_user_id), ''),
               v_w.user_email, v_w.account_id,
               upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)),
               'pending', v_qty, false
          FROM public.luckybox_cases c WHERE c.id = v_event.payout_case_id
        RETURNING id INTO v_grant_id;

        UPDATE public.bet_wagers SET status = 'won', payout_grant_id = v_grant_id, resolved_at = now()
         WHERE id = v_w.id;
      ELSE
        v_payout := ROUND(v_w.amount_coins * v_w.odd_snapshot)::int;
        UPDATE public.wheel_users SET tokens_balance = tokens_balance + v_payout, updated_at = now()
         WHERE id = v_w.wheel_user_id;
        UPDATE public.bet_wagers SET status = 'won', payout_coins = v_payout, resolved_at = now()
         WHERE id = v_w.id;
      END IF;
    ELSE
      UPDATE public.bet_wagers SET status = 'lost', resolved_at = now() WHERE id = v_w.id;
    END IF;
    v_processed := v_processed + 1;
  END LOOP;

  -- settle ticket selections for this event
  UPDATE public.bet_ticket_selections
     SET status = CASE WHEN outcome_id = p_winning_outcome_id THEN 'won' ELSE 'lost' END
   WHERE event_id = p_event_id AND status = 'pending';

  SELECT array_agg(id) INTO v_outcome_ids FROM public.bet_outcomes WHERE event_id = p_event_id;
  PERFORM public._resolve_tickets_for_outcomes(COALESCE(v_outcome_ids, ARRAY[]::uuid[]));

  UPDATE public.bet_events
     SET status = 'resolved', winning_outcome_id = p_winning_outcome_id, resolved_at = now(), updated_at = now()
   WHERE id = p_event_id;

  RETURN jsonb_build_object('success', true, 'processed', v_processed);
END;
$function$;

-- 6. patch resolve_bet_market similarly
CREATE OR REPLACE FUNCTION public.resolve_bet_market(p_market_id uuid, p_winning_outcome_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_market public.bet_markets%ROWTYPE;
  v_winner public.bet_outcomes%ROWTYPE;
  v_w record;
  v_payout integer;
  v_qty integer;
  v_grant_id uuid;
  v_processed integer := 0;
  v_outcome_ids uuid[];
BEGIN
  SELECT * INTO v_market FROM public.bet_markets WHERE id = p_market_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'market_not_found'); END IF;
  IF v_market.status = 'resolved' THEN RETURN jsonb_build_object('success', false, 'error', 'already_resolved'); END IF;

  SELECT * INTO v_winner FROM public.bet_outcomes
   WHERE id = p_winning_outcome_id AND market_id = p_market_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'outcome_not_in_market'); END IF;

  UPDATE public.bet_outcomes SET is_winner = (id = p_winning_outcome_id) WHERE market_id = p_market_id;

  FOR v_w IN SELECT * FROM public.bet_wagers WHERE market_id = p_market_id AND status = 'pending' LOOP
    IF v_w.outcome_id = p_winning_outcome_id THEN
      IF v_market.payout_mode = 'case' AND v_market.payout_case_id IS NOT NULL THEN
        v_qty := GREATEST(1, FLOOR(v_w.amount_coins * v_market.payout_case_qty_per_unit)::int);
        INSERT INTO public.luckybox_grants (
          owner_id, case_id, case_name, wheel_user_id,
          recipient_name, recipient_phone, recipient_email, recipient_account_id,
          code, status, quantity, one_per_user
        )
        SELECT v_market.owner_id, c.id, c.name, v_w.wheel_user_id,
               v_w.user_name, COALESCE((SELECT phone FROM public.wheel_users WHERE id = v_w.wheel_user_id), ''),
               v_w.user_email, v_w.account_id,
               upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)),
               'pending', v_qty, false
          FROM public.luckybox_cases c WHERE c.id = v_market.payout_case_id
        RETURNING id INTO v_grant_id;

        UPDATE public.bet_wagers SET status = 'won', payout_grant_id = v_grant_id, resolved_at = now()
         WHERE id = v_w.id;
      ELSE
        v_payout := ROUND(v_w.amount_coins * v_w.odd_snapshot)::int;
        UPDATE public.wheel_users SET tokens_balance = tokens_balance + v_payout, updated_at = now()
         WHERE id = v_w.wheel_user_id;
        UPDATE public.bet_wagers SET status = 'won', payout_coins = v_payout, resolved_at = now()
         WHERE id = v_w.id;
      END IF;
    ELSE
      UPDATE public.bet_wagers SET status = 'lost', resolved_at = now() WHERE id = v_w.id;
    END IF;
    v_processed := v_processed + 1;
  END LOOP;

  -- settle ticket selections for this market
  UPDATE public.bet_ticket_selections
     SET status = CASE WHEN outcome_id = p_winning_outcome_id THEN 'won' ELSE 'lost' END
   WHERE market_id = p_market_id AND status = 'pending';

  SELECT array_agg(id) INTO v_outcome_ids FROM public.bet_outcomes WHERE market_id = p_market_id;
  PERFORM public._resolve_tickets_for_outcomes(COALESCE(v_outcome_ids, ARRAY[]::uuid[]));

  UPDATE public.bet_markets
     SET status = 'resolved', winning_outcome_id = p_winning_outcome_id, resolved_at = now(), updated_at = now()
   WHERE id = p_market_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.bet_markets
     WHERE event_id = v_market.event_id AND status NOT IN ('resolved','cancelled')
  ) THEN
    UPDATE public.bet_events
       SET status = 'resolved', resolved_at = now(), updated_at = now()
     WHERE id = v_market.event_id AND status <> 'resolved';
  END IF;

  RETURN jsonb_build_object('success', true, 'processed', v_processed);
END;
$function$;
