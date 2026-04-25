CREATE OR REPLACE FUNCTION public.get_bs_deposit_stats(p_owner_id uuid)
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
    AND COALESCE(metadata->>'variant', '') = 'bs';
$function$;

GRANT EXECUTE ON FUNCTION public.get_bs_deposit_stats(uuid) TO anon, authenticated;