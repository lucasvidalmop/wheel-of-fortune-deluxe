-- Trigger function for updated_at (idempotent create)
CREATE OR REPLACE FUNCTION public.bets_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 1) Permission
ALTER TABLE public.operator_permissions
  ADD COLUMN IF NOT EXISTS apostas boolean NOT NULL DEFAULT false;
ALTER TABLE public.operator_permissions_defaults
  ADD COLUMN IF NOT EXISTS apostas boolean NOT NULL DEFAULT false;

-- 2) bets_configs
CREATE TABLE IF NOT EXISTS public.bets_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  tag text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  page_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  coin_name text NOT NULL DEFAULT 'Coins',
  coin_icon_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bets_configs_owner ON public.bets_configs(owner_id);

CREATE TABLE IF NOT EXISTS public.bet_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  bets_config_id uuid NOT NULL REFERENCES public.bets_configs(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  subtitle text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  starts_at timestamptz,
  closes_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  payout_mode text NOT NULL DEFAULT 'coins',
  payout_case_id uuid,
  payout_case_qty_per_unit numeric NOT NULL DEFAULT 1,
  min_bet integer NOT NULL DEFAULT 1,
  max_bet integer NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  winning_outcome_id uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bet_events_owner ON public.bet_events(owner_id);
CREATE INDEX IF NOT EXISTS idx_bet_events_config ON public.bet_events(bets_config_id);
CREATE INDEX IF NOT EXISTS idx_bet_events_status ON public.bet_events(status);

CREATE TABLE IF NOT EXISTS public.bet_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.bet_events(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  label text NOT NULL DEFAULT '',
  odd numeric NOT NULL DEFAULT 1,
  position integer NOT NULL DEFAULT 0,
  is_winner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bet_outcomes_event ON public.bet_outcomes(event_id);

CREATE TABLE IF NOT EXISTS public.bet_wagers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  event_id uuid NOT NULL REFERENCES public.bet_events(id) ON DELETE CASCADE,
  outcome_id uuid NOT NULL REFERENCES public.bet_outcomes(id) ON DELETE CASCADE,
  wheel_user_id uuid,
  account_id text NOT NULL DEFAULT '',
  user_email text NOT NULL DEFAULT '',
  user_name text NOT NULL DEFAULT '',
  amount_coins integer NOT NULL DEFAULT 0,
  odd_snapshot numeric NOT NULL DEFAULT 1,
  payout_mode text NOT NULL DEFAULT 'coins',
  status text NOT NULL DEFAULT 'pending',
  payout_coins integer NOT NULL DEFAULT 0,
  payout_grant_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_bet_wagers_owner ON public.bet_wagers(owner_id);
CREATE INDEX IF NOT EXISTS idx_bet_wagers_event ON public.bet_wagers(event_id);
CREATE INDEX IF NOT EXISTS idx_bet_wagers_user ON public.bet_wagers(account_id, user_email);

ALTER TABLE public.bets_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bet_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bet_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bet_wagers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own bets_configs" ON public.bets_configs FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners insert own bets_configs" ON public.bets_configs FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners update own bets_configs" ON public.bets_configs FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners delete own bets_configs" ON public.bets_configs FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages bets_configs" ON public.bets_configs FOR ALL TO public
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Owners read own bet_events" ON public.bet_events FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners insert own bet_events" ON public.bet_events FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners update own bet_events" ON public.bet_events FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners delete own bet_events" ON public.bet_events FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages bet_events" ON public.bet_events FOR ALL TO public
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Owners read own bet_outcomes" ON public.bet_outcomes FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners insert own bet_outcomes" ON public.bet_outcomes FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners update own bet_outcomes" ON public.bet_outcomes FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners delete own bet_outcomes" ON public.bet_outcomes FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages bet_outcomes" ON public.bet_outcomes FOR ALL TO public
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Owners read own bet_wagers" ON public.bet_wagers FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners update own bet_wagers" ON public.bet_wagers FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners delete own bet_wagers" ON public.bet_wagers FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages bet_wagers" ON public.bet_wagers FOR ALL TO public
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER trg_bets_configs_updated BEFORE UPDATE ON public.bets_configs
  FOR EACH ROW EXECUTE FUNCTION public.bets_set_updated_at();
CREATE TRIGGER trg_bet_events_updated BEFORE UPDATE ON public.bet_events
  FOR EACH ROW EXECUTE FUNCTION public.bets_set_updated_at();

-- ============================================================
-- RPCs
-- ============================================================

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

CREATE OR REPLACE FUNCTION public.resolve_bet_event(
  p_event_id uuid, p_winning_outcome_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event public.bet_events%ROWTYPE;
  v_winner public.bet_outcomes%ROWTYPE;
  v_w record;
  v_payout integer;
  v_qty integer;
  v_grant_id uuid;
  v_processed integer := 0;
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

  UPDATE public.bet_events
     SET status = 'resolved', winning_outcome_id = p_winning_outcome_id, resolved_at = now(), updated_at = now()
   WHERE id = p_event_id;

  RETURN jsonb_build_object('success', true, 'processed', v_processed);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_bet_event(p_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event public.bet_events%ROWTYPE;
  v_w record;
  v_count integer := 0;
BEGIN
  SELECT * INTO v_event FROM public.bet_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'event_not_found'); END IF;
  IF v_event.status IN ('resolved', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_cancel');
  END IF;

  FOR v_w IN SELECT * FROM public.bet_wagers WHERE event_id = p_event_id AND status = 'pending' LOOP
    UPDATE public.wheel_users SET tokens_balance = tokens_balance + v_w.amount_coins, updated_at = now()
     WHERE id = v_w.wheel_user_id;
    UPDATE public.bet_wagers SET status = 'refunded', payout_coins = v_w.amount_coins, resolved_at = now()
     WHERE id = v_w.id;
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.bet_events SET status = 'cancelled', updated_at = now() WHERE id = p_event_id;
  RETURN jsonb_build_object('success', true, 'refunded', v_count);
END;
$$;