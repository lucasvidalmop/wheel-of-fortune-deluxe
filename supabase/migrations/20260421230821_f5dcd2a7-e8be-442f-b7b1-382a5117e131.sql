-- Preserve referral analytics history even after the referral_link is deleted.
-- 1) Add snapshot columns so we can show link code/label even after deletion.
ALTER TABLE public.referral_redemptions
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS link_code text,
  ADD COLUMN IF NOT EXISTS link_label text;

-- 2) Backfill from existing referral_links
UPDATE public.referral_redemptions rr
SET owner_id = rl.owner_id,
    link_code = rl.code,
    link_label = rl.label
FROM public.referral_links rl
WHERE rr.referral_link_id = rl.id
  AND (rr.owner_id IS NULL OR rr.link_code IS NULL OR rr.link_label IS NULL);

-- 3) Drop existing CASCADE FK and recreate as SET NULL so deletes preserve history.
ALTER TABLE public.referral_redemptions
  DROP CONSTRAINT IF EXISTS referral_redemptions_referral_link_id_fkey;

ALTER TABLE public.referral_redemptions
  ALTER COLUMN referral_link_id DROP NOT NULL;

ALTER TABLE public.referral_redemptions
  ADD CONSTRAINT referral_redemptions_referral_link_id_fkey
  FOREIGN KEY (referral_link_id) REFERENCES public.referral_links(id) ON DELETE SET NULL;

-- 4) Trigger: auto-populate snapshot fields and owner_id on insert.
CREATE OR REPLACE FUNCTION public.snapshot_referral_redemption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.referral_links%ROWTYPE;
BEGIN
  IF NEW.referral_link_id IS NOT NULL THEN
    SELECT * INTO v_link FROM public.referral_links WHERE id = NEW.referral_link_id;
    IF FOUND THEN
      IF NEW.owner_id IS NULL THEN NEW.owner_id := v_link.owner_id; END IF;
      IF NEW.link_code IS NULL THEN NEW.link_code := v_link.code; END IF;
      IF NEW.link_label IS NULL THEN NEW.link_label := v_link.label; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_referral_redemption ON public.referral_redemptions;
CREATE TRIGGER trg_snapshot_referral_redemption
BEFORE INSERT ON public.referral_redemptions
FOR EACH ROW EXECUTE FUNCTION public.snapshot_referral_redemption();

-- 5) RLS policy so owners can read their own redemptions even after the link is gone.
DROP POLICY IF EXISTS "Owners can read own referral_redemptions by owner_id" ON public.referral_redemptions;
CREATE POLICY "Owners can read own referral_redemptions by owner_id"
ON public.referral_redemptions
FOR SELECT
TO authenticated
USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_referral_redemptions_owner ON public.referral_redemptions(owner_id);
CREATE INDEX IF NOT EXISTS idx_referral_redemptions_link_code ON public.referral_redemptions(link_code);