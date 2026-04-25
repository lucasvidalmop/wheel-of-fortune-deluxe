-- Add optional reset timestamp parameter to get_bs_deposit_stats
-- so the dashboard can "reset" the BS deposit limits without deleting transactions.
CREATE OR REPLACE FUNCTION public.get_bs_deposit_stats(p_owner_id uuid, p_since timestamptz DEFAULT NULL)
 RETURNS TABLE(total_amount numeric, total_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    COALESCE(SUM(amount), 0)::numeric AS total_amount,
    COALESCE(COUNT(*), 0)::integer AS total_count
  FROM public.edpay_transactions
  WHERE owner_id = p_owner_id
    AND type = 'deposit_public'
    AND status IN ('paid', 'confirmed', 'completed')
    AND COALESCE(metadata->>'variant', '') = 'bs'
    AND (p_since IS NULL OR created_at >= p_since);
$function$;