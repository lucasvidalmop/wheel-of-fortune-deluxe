-- Public RPC to allow the deposit page (anon) to poll an EdPay transaction status
-- by edpay_id only. Returns just the status string — no PII, no owner data.
CREATE OR REPLACE FUNCTION public.get_public_deposit_status(p_edpay_id text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status
  FROM public.edpay_transactions
  WHERE edpay_id = p_edpay_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_deposit_status(text) TO anon, authenticated;