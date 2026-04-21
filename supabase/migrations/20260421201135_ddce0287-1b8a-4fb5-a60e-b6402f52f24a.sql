DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname='realtime' AND c.relname='messages') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated can subscribe to own channels" ON realtime.messages';
    EXECUTE $POL$
      CREATE POLICY "Authenticated can subscribe to own channels"
      ON realtime.messages
      FOR SELECT
      TO authenticated
      USING (
        topic LIKE auth.uid()::text || ':%'
      )
    $POL$;
  END IF;
END $$;