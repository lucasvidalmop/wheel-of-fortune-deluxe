
-- 1) Lock down referral_redemptions: remove public read & public insert
DROP POLICY IF EXISTS "Anyone can read referral_redemptions" ON public.referral_redemptions;
DROP POLICY IF EXISTS "Anyone can insert referral_redemptions" ON public.referral_redemptions;

-- Owners (operators) can read their own redemptions via referral_links.owner_id
CREATE POLICY "Owners can read own referral_redemptions"
ON public.referral_redemptions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.referral_links rl
    WHERE rl.id = referral_redemptions.referral_link_id
      AND (rl.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Service role full access (used by SECURITY DEFINER functions and admin tooling)
CREATE POLICY "Service role manages referral_redemptions"
ON public.referral_redemptions
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 2) Restrict anonymous wheel_configs read to slug-only via a SECURITY DEFINER helper
DROP POLICY IF EXISTS "Anon can read slug from wheel_configs" ON public.wheel_configs;

CREATE OR REPLACE FUNCTION public.get_wheel_config_slug_only(p_user_id uuid)
RETURNS TABLE(slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT wc.slug FROM public.wheel_configs wc WHERE wc.user_id = p_user_id LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_wheel_config_slug_only(uuid) TO anon, authenticated;

-- 3) Block anonymous bucket-wide listing on app-assets while allowing reads of known paths.
-- Public bucket already serves objects via public URLs, but we drop any permissive list policies.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage' AND c.relname = 'objects'
      AND polname IN (
        'Allow public read on app-assets',
        'Public Access',
        'Public read access',
        'Anyone can list app-assets'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.polname);
  END LOOP;
END $$;

-- 4) Realtime channel authorization: scope channel topics to authenticated users
-- Only allow authenticated users to subscribe to channels they own (topic prefixed with their uid)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname='realtime' AND c.relname='messages') THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "Authenticated can subscribe to own channels" ON realtime.messages';
    EXECUTE $POL$
      CREATE POLICY "Authenticated can subscribe to own channels"
      ON realtime.messages
      FOR SELECT
      TO authenticated
      USING (
        topic LIKE auth.uid()::text || ':%'
        OR topic = 'prize-payments-realtime'
      )
    $POL$;
  END IF;
END $$;
