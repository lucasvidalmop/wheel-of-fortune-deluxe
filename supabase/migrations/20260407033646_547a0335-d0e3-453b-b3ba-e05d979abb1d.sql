
-- Remove duplicate account_id per owner (keep the one with the latest updated_at, or latest id)
DELETE FROM public.wheel_users a
USING public.wheel_users b
WHERE a.account_id = b.account_id
  AND a.owner_id IS NOT DISTINCT FROM b.owner_id
  AND a.id < b.id;

-- Remove duplicate email per owner (keep the one with the latest id)
DELETE FROM public.wheel_users a
USING public.wheel_users b
WHERE a.email = b.email
  AND a.owner_id IS NOT DISTINCT FROM b.owner_id
  AND a.id < b.id;

-- Now add unique constraints
ALTER TABLE public.wheel_users
ADD CONSTRAINT wheel_users_account_owner_unique
UNIQUE (account_id, owner_id);

ALTER TABLE public.wheel_users
ADD CONSTRAINT wheel_users_email_owner_unique
UNIQUE (email, owner_id);
