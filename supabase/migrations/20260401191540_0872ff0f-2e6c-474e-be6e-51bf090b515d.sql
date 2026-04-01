
-- 1. Drop dangerous anon policies on wheel_users
DROP POLICY IF EXISTS "Allow anon to read wheel_users for auth" ON public.wheel_users;
DROP POLICY IF EXISTS "Allow anon to update spins" ON public.wheel_users;

-- 2. Create security definer RPCs for anon wheel operations

-- Authenticate a wheel user by email + account_id (+ optional owner_id)
CREATE OR REPLACE FUNCTION public.authenticate_wheel_user(
  p_email text,
  p_account_id text,
  p_owner_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  name text,
  spins_available integer,
  account_id text,
  owner_id uuid,
  fixed_prize_enabled boolean,
  fixed_prize_segment integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT wu.id, wu.name, wu.spins_available, wu.account_id, wu.owner_id,
           wu.fixed_prize_enabled, wu.fixed_prize_segment
    FROM public.wheel_users wu
    WHERE wu.email = p_email
      AND wu.account_id = p_account_id
      AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
    LIMIT 1;
END;
$$;

-- Get wheel user spins by account_id (+ optional owner_id)
CREATE OR REPLACE FUNCTION public.get_wheel_user_spins(
  p_account_id text,
  p_owner_id uuid DEFAULT NULL
)
RETURNS TABLE(
  name text,
  spins_available integer,
  owner_id uuid,
  fixed_prize_enabled boolean,
  fixed_prize_segment integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT wu.name, wu.spins_available, wu.owner_id,
           wu.fixed_prize_enabled, wu.fixed_prize_segment
    FROM public.wheel_users wu
    WHERE wu.account_id = p_account_id
      AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
    LIMIT 1;
END;
$$;

-- Decrement spins for a wheel user
CREATE OR REPLACE FUNCTION public.decrement_wheel_user_spins(
  p_account_id text,
  p_owner_id uuid DEFAULT NULL
)
RETURNS TABLE(spins_available integer, owner_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.wheel_users wu
  SET spins_available = GREATEST(0, wu.spins_available - 1),
      updated_at = now()
  WHERE wu.account_id = p_account_id
    AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id);

  RETURN QUERY
    SELECT wu.spins_available, wu.owner_id
    FROM public.wheel_users wu
    WHERE wu.account_id = p_account_id
      AND (p_owner_id IS NULL OR wu.owner_id = p_owner_id)
    LIMIT 1;
END;
$$;

-- 3. Fix storage policies - scope to owner path
DROP POLICY IF EXISTS "Authenticated users can upload app assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update app assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete app assets" ON storage.objects;

CREATE POLICY "Users can upload own app assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'app-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own app assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'app-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own app assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'app-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Also allow admins full access to app-assets
CREATE POLICY "Admins can manage all app assets"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'app-assets'
    AND public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    bucket_id = 'app-assets'
    AND public.has_role(auth.uid(), 'admin')
  );

-- 4. Fix search_path on existing functions
CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
 RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$;
