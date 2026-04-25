CREATE OR REPLACE FUNCTION public.get_bs_deposit_stats(p_owner_id uuid, p_since timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(total_amount numeric, total_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE status IN ('paid','confirmed','completed')), 0)::numeric AS total_amount,
    COALESCE(COUNT(*) FILTER (WHERE status NOT IN ('cancelled','expired','failed','error')), 0)::integer AS total_count
  FROM public.edpay_transactions
  WHERE owner_id = p_owner_id
    AND type = 'deposit_public'
    AND COALESCE(metadata->>'variant', '') = 'bs'
    AND (p_since IS NULL OR created_at >= p_since);
$function$;