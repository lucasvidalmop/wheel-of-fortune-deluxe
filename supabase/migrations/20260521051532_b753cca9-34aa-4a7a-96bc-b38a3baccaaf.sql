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
    SELECT t.*
      FROM public.bet_tickets t
     WHERE t.status = 'pending'
       AND EXISTS (
         SELECT 1 FROM public.bet_ticket_selections s
          WHERE s.ticket_id = t.id AND s.outcome_id = ANY(p_outcome_ids)
       )
     FOR UPDATE
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