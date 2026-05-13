
-- 1. Add owner_id column to email_send_log
ALTER TABLE public.email_send_log 
  ADD COLUMN IF NOT EXISTS owner_id uuid;

-- Backfill from metadata when possible
UPDATE public.email_send_log
SET owner_id = ((metadata->>'owner_id')::uuid)
WHERE owner_id IS NULL
  AND metadata ? 'owner_id'
  AND (metadata->>'owner_id') ~ '^[0-9a-fA-F-]{36}$';

CREATE INDEX IF NOT EXISTS idx_email_send_log_owner_id ON public.email_send_log(owner_id);

-- Replace SELECT policy to use owner_id column directly (with metadata fallback for legacy rows)
DROP POLICY IF EXISTS "Owners and admins can read email_send_log" ON public.email_send_log;

CREATE POLICY "Owners and admins can read email_send_log"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- 2. Add INSERT policy on spin_results so users can only insert their own
CREATE POLICY "Users can insert own spin_results"
ON public.spin_results
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());
