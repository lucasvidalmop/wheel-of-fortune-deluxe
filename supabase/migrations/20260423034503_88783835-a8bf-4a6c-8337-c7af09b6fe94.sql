ALTER TABLE public.operator_permissions
ADD COLUMN IF NOT EXISTS sms_mb boolean NOT NULL DEFAULT true;

ALTER TABLE public.operator_permissions_defaults
ADD COLUMN IF NOT EXISTS sms_mb boolean NOT NULL DEFAULT true;