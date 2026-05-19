
CREATE TABLE public.bet_markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  event_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Principal',
  position integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  closes_at timestamptz,
  winning_outcome_id uuid,
  min_bet integer NOT NULL DEFAULT 1,
  max_bet integer NOT NULL DEFAULT 0,
  max_bets_per_user integer NOT NULL DEFAULT 0,
  payout_mode text NOT NULL DEFAULT 'coins',
  payout_case_id uuid,
  payout_case_qty_per_unit numeric NOT NULL DEFAULT 1,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bet_markets_event ON public.bet_markets(event_id);
CREATE INDEX idx_bet_markets_owner ON public.bet_markets(owner_id);

ALTER TABLE public.bet_markets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own bet_markets" ON public.bet_markets
  FOR SELECT TO authenticated
  USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners insert own bet_markets" ON public.bet_markets
  FOR INSERT TO authenticated
  WITH CHECK ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners update own bet_markets" ON public.bet_markets
  FOR UPDATE TO authenticated
  USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners delete own bet_markets" ON public.bet_markets
  FOR DELETE TO authenticated
  USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages bet_markets" ON public.bet_markets
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER bet_markets_updated_at
  BEFORE UPDATE ON public.bet_markets
  FOR EACH ROW EXECUTE FUNCTION public.bets_set_updated_at();

ALTER TABLE public.bet_outcomes ADD COLUMN market_id uuid;
ALTER TABLE public.bet_wagers ADD COLUMN market_id uuid;

CREATE INDEX idx_bet_outcomes_market ON public.bet_outcomes(market_id);
CREATE INDEX idx_bet_wagers_market ON public.bet_wagers(market_id);

INSERT INTO public.bet_markets (
  id, owner_id, event_id, title, position, status, closes_at, winning_outcome_id,
  min_bet, max_bet, max_bets_per_user, payout_mode, payout_case_id, payout_case_qty_per_unit,
  resolved_at, created_at, updated_at
)
SELECT
  gen_random_uuid(), e.owner_id, e.id, 'Principal', 0, e.status, e.closes_at, e.winning_outcome_id,
  e.min_bet, e.max_bet, e.max_bets_per_user, e.payout_mode, e.payout_case_id, e.payout_case_qty_per_unit,
  e.resolved_at, e.created_at, e.updated_at
FROM public.bet_events e;

UPDATE public.bet_outcomes o
   SET market_id = m.id
  FROM public.bet_markets m
 WHERE m.event_id = o.event_id AND o.market_id IS NULL;

UPDATE public.bet_wagers w
   SET market_id = o.market_id
  FROM public.bet_outcomes o
 WHERE o.id = w.outcome_id AND w.market_id IS NULL;

CREATE OR REPLACE FUNCTION public.place_bet(p_owner_id uuid, p_email text, p_account_id text, p_event_id uuid, p_outcome_id uuid, p_amount integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user public.wheel_users%ROWTYPE;
  v_event public.bet_events%ROWTYPE;
  v_outcome public.bet_outcomes%ROWTYPE;
  v_market public.bet_markets%ROWTYPE;
  v_wager_id uuid;
  v_new_balance integer;
  v_existing_count integer;
  v_min integer;
  v_max integer;
  v_max_per_user integer;
  v_closes_at timestamptz;
  v_payout_mode text;
  v_status text;
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
  IF v_event.status = 'cancelled' THEN RETURN jsonb_build_object('success', false, 'error', 'event_not_open'); END IF;

  SELECT * INTO v_outcome FROM public.bet_outcomes
   WHERE id = p_outcome_id AND event_id = p_event_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'outcome_not_found'); END IF;

  IF v_outcome.market_id IS NOT NULL THEN
    SELECT * INTO v_market FROM public.bet_markets WHERE id = v_outcome.market_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'market_not_found'); END IF;
    v_min := v_market.min_bet;
    v_max := v_market.max_bet;
    v_max_per_user := v_market.max_bets_per_user;
    v_closes_at := COALESCE(v_market.closes_at, v_event.closes_at);
    v_payout_mode := v_market.payout_mode;
    v_status := v_market.status;
  ELSE
    v_min := v_event.min_bet;
    v_max := v_event.max_bet;
    v_max_per_user := v_event.max_bets_per_user;
    v_closes_at := v_event.closes_at;
    v_payout_mode := v_event.payout_mode;
    v_status := v_event.status;
  END IF;

  IF v_status <> 'open' THEN RETURN jsonb_build_object('success', false, 'error', 'event_not_open'); END IF;
  IF v_closes_at IS NOT NULL AND now() > v_closes_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'event_closed');
  END IF;
  IF p_amount < v_min THEN
    RETURN jsonb_build_object('success', false, 'error', 'below_min_bet', 'min', v_min);
  END IF;
  IF v_max > 0 AND p_amount > v_max THEN
    RETURN jsonb_build_object('success', false, 'error', 'above_max_bet', 'max', v_max);
  END IF;

  IF v_max_per_user > 0 THEN
    IF v_outcome.market_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_existing_count FROM public.bet_wagers
       WHERE market_id = v_outcome.market_id
         AND wheel_user_id = v_user.id
         AND status IN ('pending','won','lost');
    ELSE
      SELECT COUNT(*) INTO v_existing_count FROM public.bet_wagers
       WHERE event_id = p_event_id
         AND wheel_user_id = v_user.id
         AND status IN ('pending','won','lost');
    END IF;
    IF v_existing_count >= v_max_per_user THEN
      RETURN jsonb_build_object('success', false, 'error', 'max_bets_reached',
        'max', v_max_per_user, 'placed', v_existing_count);
    END IF;
  END IF;

  IF COALESCE(v_user.tokens_balance, 0) < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance',
      'balance', COALESCE(v_user.tokens_balance, 0));
  END IF;

  UPDATE public.wheel_users SET tokens_balance = tokens_balance - p_amount, updated_at = now()
   WHERE id = v_user.id RETURNING tokens_balance INTO v_new_balance;

  INSERT INTO public.bet_wagers (
    owner_id, event_id, outcome_id, market_id, wheel_user_id, account_id, user_email, user_name,
    amount_coins, odd_snapshot, payout_mode
  ) VALUES (
    p_owner_id, p_event_id, p_outcome_id, v_outcome.market_id, v_user.id, v_user.account_id, v_user.email, v_user.name,
    p_amount, v_outcome.odd, v_payout_mode
  ) RETURNING id INTO v_wager_id;

  RETURN jsonb_build_object('success', true, 'wager_id', v_wager_id,
    'tokens_balance', v_new_balance, 'odd', v_outcome.odd);
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_bet_market(p_market_id uuid, p_winning_outcome_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_market public.bet_markets%ROWTYPE;
  v_winner public.bet_outcomes%ROWTYPE;
  v_w record;
  v_payout integer;
  v_qty integer;
  v_grant_id uuid;
  v_processed integer := 0;
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

CREATE OR REPLACE FUNCTION public.cancel_bet_market(p_market_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_market public.bet_markets%ROWTYPE;
  v_w record;
  v_count integer := 0;
BEGIN
  SELECT * INTO v_market FROM public.bet_markets WHERE id = p_market_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'market_not_found'); END IF;
  IF v_market.status IN ('resolved','cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_cancel');
  END IF;

  FOR v_w IN SELECT * FROM public.bet_wagers WHERE market_id = p_market_id AND status = 'pending' LOOP
    UPDATE public.wheel_users SET tokens_balance = tokens_balance + v_w.amount_coins, updated_at = now()
     WHERE id = v_w.wheel_user_id;
    UPDATE public.bet_wagers SET status = 'refunded', payout_coins = v_w.amount_coins, resolved_at = now()
     WHERE id = v_w.id;
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.bet_markets SET status = 'cancelled', updated_at = now() WHERE id = p_market_id;
  RETURN jsonb_build_object('success', true, 'refunded', v_count);
END;
$function$;
