
-- Add unique constraint to prevent duplicate wheel_users entries
ALTER TABLE public.wheel_users
ADD CONSTRAINT wheel_users_email_account_owner_unique
UNIQUE (email, account_id, owner_id);
