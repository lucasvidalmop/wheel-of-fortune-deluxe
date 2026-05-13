
-- 1. Remove anon/authenticated public SELECT on luckybox_cases (public access goes through get_luckybox_page_by_tag SECURITY DEFINER RPC)
DROP POLICY IF EXISTS "Anyone can read active luckybox_cases" ON public.luckybox_cases;

-- 2. Remove anon/authenticated public SELECT on redemption_pages (public access goes through get_redemption_page_by_tag SECURITY DEFINER RPC; shared_code must not be readable by anon)
DROP POLICY IF EXISTS "Anyone can read active redemption_pages" ON public.redemption_pages;

-- 3. Align sms_cs_message_log INSERT policy with sibling tables (allow admins)
DROP POLICY IF EXISTS "Users can insert own sms_cs logs" ON public.sms_cs_message_log;
CREATE POLICY "Users can insert own sms_cs logs"
ON public.sms_cs_message_log
FOR INSERT
TO authenticated
WITH CHECK ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
