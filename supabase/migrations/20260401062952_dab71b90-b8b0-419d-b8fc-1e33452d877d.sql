INSERT INTO public.wheel_configs (user_id, slug, config)
SELECT ur.user_id,
       'roleta-' || substring(replace(ur.user_id::text, '-', '') from 1 for 8),
       '{}'::jsonb
FROM public.user_roles ur
WHERE ur.role = 'user'
  AND NOT EXISTS (
    SELECT 1
    FROM public.wheel_configs wc
    WHERE wc.user_id = ur.user_id
  );

WITH latest_owner AS (
  SELECT DISTINCT ON (wu.account_id)
    wu.account_id,
    wu.owner_id
  FROM public.wheel_users wu
  WHERE wu.owner_id IS NOT NULL
  ORDER BY wu.account_id, wu.created_at DESC NULLS LAST, wu.id DESC
)
UPDATE public.spin_results sr
SET owner_id = lo.owner_id
FROM latest_owner lo
WHERE sr.owner_id IS NULL
  AND sr.account_id = lo.account_id;