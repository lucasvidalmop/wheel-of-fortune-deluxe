-- Backup snapshots table
CREATE TABLE IF NOT EXISTS public.config_backups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  trigger TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'auto'
  wheel_configs JSONB NOT NULL DEFAULT '[]'::jsonb,
  referral_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  email_templates JSONB NOT NULL DEFAULT '[]'::jsonb,
  whatsapp_share_templates JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_config_backups_user_created
  ON public.config_backups(user_id, created_at DESC);

ALTER TABLE public.config_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own config_backups"
  ON public.config_backups FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own config_backups"
  ON public.config_backups FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own config_backups"
  ON public.config_backups FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Function to keep only the last 20 backups per user
CREATE OR REPLACE FUNCTION public.prune_config_backups()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.config_backups
  WHERE user_id = NEW.user_id
    AND id NOT IN (
      SELECT id FROM public.config_backups
      WHERE user_id = NEW.user_id
      ORDER BY created_at DESC
      LIMIT 20
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prune_config_backups ON public.config_backups;
CREATE TRIGGER trg_prune_config_backups
AFTER INSERT ON public.config_backups
FOR EACH ROW EXECUTE FUNCTION public.prune_config_backups();

-- Restore function (atomic, server-side)
CREATE OR REPLACE FUNCTION public.restore_config_backup(_backup_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _backup public.config_backups;
  _uid UUID := auth.uid();
  _wc JSONB;
  _rl JSONB;
  _et JSONB;
  _wt JSONB;
  _restored INT := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _backup FROM public.config_backups
  WHERE id = _backup_id AND (user_id = _uid OR has_role(_uid, 'admin'::app_role));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Backup not found or access denied';
  END IF;

  -- Restore wheel_configs (only rows belonging to the user)
  FOR _wc IN SELECT * FROM jsonb_array_elements(_backup.wheel_configs)
  LOOP
    UPDATE public.wheel_configs
    SET config = _wc->'config',
        slug = COALESCE(_wc->>'slug', slug),
        updated_at = now()
    WHERE id = (_wc->>'id')::uuid AND user_id = _backup.user_id;
    _restored := _restored + 1;
  END LOOP;

  -- Restore referral_links (page_config + key fields)
  FOR _rl IN SELECT * FROM jsonb_array_elements(_backup.referral_links)
  LOOP
    UPDATE public.referral_links
    SET page_config = COALESCE(_rl->'page_config', '{}'::jsonb),
        label = COALESCE(_rl->>'label', label),
        is_active = COALESCE((_rl->>'is_active')::boolean, is_active),
        spins_per_registration = COALESCE((_rl->>'spins_per_registration')::int, spins_per_registration),
        max_registrations = NULLIF(_rl->>'max_registrations','')::int,
        fixed_prize_pool = _rl->'fixed_prize_pool',
        fixed_prize_segments = _rl->'fixed_prize_segments',
        fixed_prize_plan = _rl->'fixed_prize_plan',
        fixed_prize_segment = NULLIF(_rl->>'fixed_prize_segment','')::int,
        auto_payment = COALESCE((_rl->>'auto_payment')::boolean, auto_payment),
        updated_at = now()
    WHERE id = (_rl->>'id')::uuid AND owner_id = _backup.user_id;
  END LOOP;

  -- Restore email templates (upsert by id)
  FOR _et IN SELECT * FROM jsonb_array_elements(_backup.email_templates)
  LOOP
    INSERT INTO public.email_templates (id, owner_id, name, blocks, created_at, updated_at)
    VALUES (
      (_et->>'id')::uuid,
      _backup.user_id,
      COALESCE(_et->>'name',''),
      COALESCE(_et->'blocks','{}'::jsonb),
      COALESCE((_et->>'created_at')::timestamptz, now()),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      blocks = EXCLUDED.blocks,
      updated_at = now()
    WHERE public.email_templates.owner_id = _backup.user_id;
  END LOOP;

  -- Restore whatsapp share templates
  FOR _wt IN SELECT * FROM jsonb_array_elements(_backup.whatsapp_share_templates)
  LOOP
    INSERT INTO public.whatsapp_share_templates (id, owner_id, name, message, created_at, updated_at)
    VALUES (
      (_wt->>'id')::uuid,
      _backup.user_id,
      COALESCE(_wt->>'name',''),
      COALESCE(_wt->>'message',''),
      COALESCE((_wt->>'created_at')::timestamptz, now()),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      message = EXCLUDED.message,
      updated_at = now()
    WHERE public.whatsapp_share_templates.owner_id = _backup.user_id;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'restored_at', now(), 'backup_id', _backup_id);
END;
$$;

-- Create snapshot helper function
CREATE OR REPLACE FUNCTION public.create_config_backup(_label TEXT DEFAULT '', _trigger TEXT DEFAULT 'manual')
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _id UUID;
  _wc JSONB;
  _rl JSONB;
  _et JSONB;
  _wt JSONB;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO _wc
  FROM (SELECT id, slug, config, clone_code, created_at, updated_at FROM public.wheel_configs WHERE user_id = _uid) t;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO _rl
  FROM (SELECT * FROM public.referral_links WHERE owner_id = _uid) t;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO _et
  FROM (SELECT * FROM public.email_templates WHERE owner_id = _uid) t;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO _wt
  FROM (SELECT * FROM public.whatsapp_share_templates WHERE owner_id = _uid) t;

  INSERT INTO public.config_backups (user_id, label, trigger, wheel_configs, referral_links, email_templates, whatsapp_share_templates)
  VALUES (_uid, COALESCE(_label,''), COALESCE(_trigger,'manual'), _wc, _rl, _et, _wt)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;