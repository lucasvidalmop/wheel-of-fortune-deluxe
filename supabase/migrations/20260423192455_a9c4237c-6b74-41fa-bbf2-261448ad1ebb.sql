CREATE OR REPLACE FUNCTION public.consume_fixed_prize_spin(
  p_account_id text,
  p_owner_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  segment_index integer,
  spins_available integer,
  owner_id uuid,
  fixed_prize_enabled boolean,
  fixed_prize_segment integer,
  blacklisted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user public.wheel_users%ROWTYPE;
  v_queue jsonb := '[]'::jsonb;
  v_claimed_segment integer;
  v_next_segment integer;
  v_new_spins integer;
BEGIN
  SELECT * INTO v_user
  FROM public.wheel_users wu
  WHERE btrim(wu.account_id) = btrim(p_account_id)
    AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
  ORDER BY wu.updated_at DESC NULLS LAST, wu.created_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF v_user.id IS NULL OR COALESCE(v_user.spins_available, 0) < 1 THEN
    RETURN;
  END IF;

  v_queue := COALESCE(v_user.fixed_prize_queue, '[]'::jsonb);

  v_claimed_segment := CASE
    WHEN jsonb_array_length(v_queue) > 0 THEN (v_queue->>0)::integer
    WHEN v_user.fixed_prize_enabled = true AND v_user.fixed_prize_segment IS NOT NULL THEN v_user.fixed_prize_segment
    ELSE NULL
  END;

  IF v_claimed_segment IS NULL THEN
    RETURN;
  END IF;

  IF jsonb_array_length(v_queue) > 0 THEN
    v_queue := v_queue - 0;
  ELSE
    v_queue := '[]'::jsonb;
  END IF;

  v_next_segment := CASE
    WHEN jsonb_array_length(v_queue) > 0 THEN (v_queue->>0)::integer
    ELSE NULL
  END;

  v_new_spins := GREATEST(COALESCE(v_user.spins_available, 0) - 1, 0);

  UPDATE public.wheel_users wu
  SET spins_available = v_new_spins,
      fixed_prize_queue = v_queue,
      fixed_prize_enabled = CASE WHEN v_next_segment IS NOT NULL THEN true ELSE false END,
      fixed_prize_segment = v_next_segment,
      updated_at = now()
  WHERE wu.id = v_user.id;

  RETURN QUERY
    SELECT
      v_claimed_segment,
      v_new_spins,
      v_user.owner_id,
      CASE WHEN v_next_segment IS NOT NULL THEN true ELSE false END,
      v_next_segment,
      v_user.blacklisted;
END;
$$;