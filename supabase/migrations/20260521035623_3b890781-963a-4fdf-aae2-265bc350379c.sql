-- Performance indexes for hot paths identified in the query audit.
-- All CONCURRENTLY-safe but kept simple here (small tables); using IF NOT EXISTS for idempotency.

-- spin_results (673 rows, fetched by Admin history ordered by spun_at; will grow)
CREATE INDEX IF NOT EXISTS idx_spin_results_owner_spun
  ON public.spin_results (owner_id, spun_at DESC);
CREATE INDEX IF NOT EXISTS idx_spin_results_spun_at
  ON public.spin_results (spun_at DESC);

-- prize_payments (497 rows, fetched by owner_id ordered by created_at in Dashboard gorjeta history)
CREATE INDEX IF NOT EXISTS idx_prize_payments_owner_created
  ON public.prize_payments (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prize_payments_wheel_user
  ON public.prize_payments (wheel_user_id);

-- scheduled_messages (6.4k rows; queried by owner+channel+status+next_run_at and owner+channel+status+scheduled_at)
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_owner_status_next
  ON public.scheduled_messages (owner_id, status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_owner_status_scheduled
  ON public.scheduled_messages (owner_id, status, scheduled_at DESC);

-- sms_message_log (5.5k rows) and sms_mb_message_log (10k rows): only have pkey. Add owner+created_at.
CREATE INDEX IF NOT EXISTS idx_sms_message_log_owner_created
  ON public.sms_message_log (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_mb_message_log_owner_created
  ON public.sms_mb_message_log (owner_id, created_at DESC);

-- imported_contacts (7.3k rows, queried by owner_id)
CREATE INDEX IF NOT EXISTS idx_imported_contacts_owner_created
  ON public.imported_contacts (owner_id, created_at DESC);

-- luckybox_openings (queried by owner_id + created_at in history tab)
CREATE INDEX IF NOT EXISTS idx_luckybox_openings_owner_created
  ON public.luckybox_openings (owner_id, created_at DESC);

-- bet_wagers (queried by owner+created_at and wheel_user_id)
CREATE INDEX IF NOT EXISTS idx_bet_wagers_owner_created
  ON public.bet_wagers (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bet_wagers_wheel_user
  ON public.bet_wagers (wheel_user_id);

-- bet_events ordering by created_at within a config
CREATE INDEX IF NOT EXISTS idx_bet_events_config_created
  ON public.bet_events (bets_config_id, created_at DESC);

-- edpay_transactions (queried by owner_id)
CREATE INDEX IF NOT EXISTS idx_edpay_transactions_owner_created
  ON public.edpay_transactions (owner_id, created_at DESC);