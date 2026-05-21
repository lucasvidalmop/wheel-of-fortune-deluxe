
DO $$
DECLARE
  dup RECORD;
  keep_id uuid;
  out_rec RECORD;
  matching_outcome uuid;
BEGIN
  -- Pass 1: dedupe outcomes within each market by normalized label
  FOR dup IN
    SELECT market_id, lower(trim(label)) AS lbl, MIN(id::text)::uuid AS keep_id, array_agg(id) AS ids
    FROM bet_outcomes
    WHERE market_id IS NOT NULL
    GROUP BY market_id, lower(trim(label))
    HAVING count(*) > 1
  LOOP
    UPDATE bet_wagers SET outcome_id = dup.keep_id
      WHERE outcome_id = ANY(dup.ids) AND outcome_id <> dup.keep_id;
    UPDATE bet_ticket_selections SET outcome_id = dup.keep_id
      WHERE outcome_id = ANY(dup.ids) AND outcome_id <> dup.keep_id;
    UPDATE bet_events SET winning_outcome_id = dup.keep_id
      WHERE winning_outcome_id = ANY(dup.ids) AND winning_outcome_id <> dup.keep_id;
    UPDATE bet_markets SET winning_outcome_id = dup.keep_id
      WHERE winning_outcome_id = ANY(dup.ids) AND winning_outcome_id <> dup.keep_id;
    DELETE FROM bet_outcomes
      WHERE id = ANY(dup.ids) AND id <> dup.keep_id;
  END LOOP;

  -- Pass 2: dedupe markets within each event by normalized title
  FOR dup IN
    SELECT event_id, lower(trim(title)) AS t, MIN(id::text)::uuid AS keep_id, array_agg(id) AS ids
    FROM bet_markets
    GROUP BY event_id, lower(trim(title))
    HAVING count(*) > 1
  LOOP
    keep_id := dup.keep_id;
    FOR out_rec IN
      SELECT id, label FROM bet_outcomes
      WHERE market_id = ANY(dup.ids) AND market_id <> keep_id
    LOOP
      SELECT id INTO matching_outcome FROM bet_outcomes
        WHERE market_id = keep_id
          AND lower(trim(label)) = lower(trim(out_rec.label))
        LIMIT 1;
      IF matching_outcome IS NOT NULL THEN
        UPDATE bet_wagers SET outcome_id = matching_outcome WHERE outcome_id = out_rec.id;
        UPDATE bet_ticket_selections SET outcome_id = matching_outcome WHERE outcome_id = out_rec.id;
        UPDATE bet_events SET winning_outcome_id = matching_outcome WHERE winning_outcome_id = out_rec.id;
        UPDATE bet_markets SET winning_outcome_id = matching_outcome WHERE winning_outcome_id = out_rec.id;
        DELETE FROM bet_outcomes WHERE id = out_rec.id;
      ELSE
        UPDATE bet_outcomes SET market_id = keep_id WHERE id = out_rec.id;
      END IF;
    END LOOP;
    UPDATE bet_wagers SET market_id = keep_id
      WHERE market_id = ANY(dup.ids) AND market_id <> keep_id;
    UPDATE bet_ticket_selections SET market_id = keep_id
      WHERE market_id = ANY(dup.ids) AND market_id <> keep_id;
    DELETE FROM bet_markets
      WHERE id = ANY(dup.ids) AND id <> keep_id;
  END LOOP;
END $$;

-- Pass 3: dedupe outcomes again after market merge (in case it created new collisions)
DO $$
DECLARE
  dup RECORD;
BEGIN
  FOR dup IN
    SELECT market_id, lower(trim(label)) AS lbl, MIN(id::text)::uuid AS keep_id, array_agg(id) AS ids
    FROM bet_outcomes
    WHERE market_id IS NOT NULL
    GROUP BY market_id, lower(trim(label))
    HAVING count(*) > 1
  LOOP
    UPDATE bet_wagers SET outcome_id = dup.keep_id
      WHERE outcome_id = ANY(dup.ids) AND outcome_id <> dup.keep_id;
    UPDATE bet_ticket_selections SET outcome_id = dup.keep_id
      WHERE outcome_id = ANY(dup.ids) AND outcome_id <> dup.keep_id;
    UPDATE bet_events SET winning_outcome_id = dup.keep_id
      WHERE winning_outcome_id = ANY(dup.ids) AND winning_outcome_id <> dup.keep_id;
    UPDATE bet_markets SET winning_outcome_id = dup.keep_id
      WHERE winning_outcome_id = ANY(dup.ids) AND winning_outcome_id <> dup.keep_id;
    DELETE FROM bet_outcomes
      WHERE id = ANY(dup.ids) AND id <> dup.keep_id;
  END LOOP;
END $$;

-- Prevent future duplicates at DB level
CREATE UNIQUE INDEX IF NOT EXISTS bet_markets_event_norm_title_unique
  ON bet_markets (event_id, (lower(trim(title))));

CREATE UNIQUE INDEX IF NOT EXISTS bet_outcomes_market_norm_label_unique
  ON bet_outcomes (market_id, (lower(trim(label))))
  WHERE market_id IS NOT NULL;
