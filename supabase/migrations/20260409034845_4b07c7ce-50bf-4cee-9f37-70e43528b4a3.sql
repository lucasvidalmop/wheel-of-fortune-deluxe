
-- Drop the old 4-param version that doesn't handle fixed prizes
DROP FUNCTION IF EXISTS public.register_via_referral(text, text, text, text);
