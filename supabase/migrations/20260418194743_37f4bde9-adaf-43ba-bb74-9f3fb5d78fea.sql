
ALTER TABLE public.operator_permissions
  ADD COLUMN IF NOT EXISTS inscritos boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auth boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS history boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS analytics boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS msg_analytics boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notificacoes boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS configuracoes boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS painel_casa boolean NOT NULL DEFAULT true;

ALTER TABLE public.operator_permissions_defaults
  ADD COLUMN IF NOT EXISTS inscritos boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auth boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS history boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS analytics boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS msg_analytics boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notificacoes boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS configuracoes boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS painel_casa boolean NOT NULL DEFAULT true;
