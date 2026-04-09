CREATE OR REPLACE FUNCTION public.get_prize_history(p_account_id text, p_owner_id uuid)
RETURNS TABLE(id uuid, prize text, spun_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT sr.id, sr.prize, sr.spun_at
  FROM public.spin_results sr
  WHERE sr.account_id = btrim(p_account_id)
    AND sr.owner_id = p_owner_id
  ORDER BY sr.spun_at DESC
  LIMIT 50;
$$;