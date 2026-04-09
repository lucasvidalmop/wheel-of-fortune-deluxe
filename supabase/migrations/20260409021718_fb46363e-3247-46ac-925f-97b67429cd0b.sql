
ALTER TABLE public.referral_links ADD COLUMN IF NOT EXISTS page_config jsonb NOT NULL DEFAULT '{}'::jsonb;
