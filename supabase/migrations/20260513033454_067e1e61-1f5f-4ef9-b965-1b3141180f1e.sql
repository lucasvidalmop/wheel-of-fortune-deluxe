-- 1. Restrict email_send_log SELECT to owner (via metadata) and admins
DROP POLICY IF EXISTS "Authenticated users can read email_send_log" ON public.email_send_log;
CREATE POLICY "Owners and admins can read email_send_log"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (
  ((metadata->>'owner_id')::uuid = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 2. Remove public anonymous read on referral_links to stop PII exposure
DROP POLICY IF EXISTS "Anyone can read active referral_links" ON public.referral_links;

-- Provide a safe security-definer function so public pages can resolve
-- a default referral code for an owner without exposing any PII.
CREATE OR REPLACE FUNCTION public.get_default_referral_code(p_owner_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT code
  FROM public.referral_links
  WHERE owner_id = p_owner_id
    AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_default_referral_code(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_default_referral_code(uuid) TO anon, authenticated;

-- 3. Allow owners to delete their own whatsapp message log entries
CREATE POLICY "Users can delete own whatsapp logs"
ON public.whatsapp_message_log
FOR DELETE
TO authenticated
USING (
  owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
