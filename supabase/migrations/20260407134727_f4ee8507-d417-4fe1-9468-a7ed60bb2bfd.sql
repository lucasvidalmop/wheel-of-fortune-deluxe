
-- Add clone_code column
ALTER TABLE public.wheel_configs ADD COLUMN IF NOT EXISTS clone_code text;

-- Generate unique codes for existing rows
UPDATE public.wheel_configs SET clone_code = upper(substr(md5(random()::text || id::text), 1, 8)) WHERE clone_code IS NULL;

-- Make it unique and not null
ALTER TABLE public.wheel_configs ALTER COLUMN clone_code SET NOT NULL;
ALTER TABLE public.wheel_configs ALTER COLUMN clone_code SET DEFAULT upper(substr(md5(random()::text), 1, 8));
CREATE UNIQUE INDEX IF NOT EXISTS idx_wheel_configs_clone_code ON public.wheel_configs (clone_code);

-- Allow admins to update any wheel_config (needed for cloning)
CREATE POLICY "Admins can update any config"
ON public.wheel_configs
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
