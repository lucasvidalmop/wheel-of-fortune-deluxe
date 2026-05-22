
-- Reverse 3 incorrectly-won single wagers
UPDATE bet_wagers
SET status='lost', payout_coins=0, resolved_at=now()
WHERE id IN (
  '3595a957-6aa2-477c-8c80-066b7524bb7f',
  '090e8259-ee08-41ce-86b4-2b80d9d2d6ce',
  'e66d3356-b179-4805-b306-f21ab87b033e'
);

-- Debit reversed tokens
UPDATE wheel_users SET tokens_balance = GREATEST(tokens_balance - 1428, 0), updated_at=now()
WHERE id='34583e9a-c354-4e82-9da0-a0e34dcd18a7';
UPDATE wheel_users SET tokens_balance = GREATEST(tokens_balance - 280, 0), updated_at=now()
WHERE id='be399097-787a-41b1-8ac8-2b5d4c44375e';

-- Fix mislabeled selections (tickets already lost from other selections)
UPDATE bet_ticket_selections
SET status='lost'
WHERE event_id='ca144007-0eb6-4f8c-8d2a-16d7133127f9'
  AND outcome_id='70fd22a6-b24c-4187-8fd8-d688c2ec27f8'
  AND status='won';

-- Resolve Home/Away market (draw -> no winner)
UPDATE bet_markets
SET status='resolved', resolved_at=now(), winning_outcome_id=NULL
WHERE id='00e2abd1-9d9b-4c3a-a23f-874269d7366b' AND status<>'resolved';
