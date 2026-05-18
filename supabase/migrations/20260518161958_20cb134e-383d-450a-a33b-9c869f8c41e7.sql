create table if not exists public.auth_notice_configs (
  owner_id uuid primary key,
  enabled boolean not null default false,
  title text not null default '',
  message text not null default '',
  cta_text text not null default '',
  cta_url text not null default '',
  bg_color text not null default '#fef3c7',
  text_color text not null default '#78350f',
  cta_bg_color text not null default '#f59e0b',
  cta_text_color text not null default '#ffffff',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.auth_notice_configs enable row level security;

create policy "Owners read own auth_notice" on public.auth_notice_configs
  for select to authenticated using (owner_id = auth.uid() or has_role(auth.uid(),'admin'::app_role));
create policy "Owners insert own auth_notice" on public.auth_notice_configs
  for insert to authenticated with check (owner_id = auth.uid() or has_role(auth.uid(),'admin'::app_role));
create policy "Owners update own auth_notice" on public.auth_notice_configs
  for update to authenticated using (owner_id = auth.uid() or has_role(auth.uid(),'admin'::app_role));
create policy "Owners delete own auth_notice" on public.auth_notice_configs
  for delete to authenticated using (owner_id = auth.uid() or has_role(auth.uid(),'admin'::app_role));
create policy "Service role manages auth_notice" on public.auth_notice_configs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create or replace function public.get_auth_notice(p_owner_id uuid)
returns table (
  enabled boolean, title text, message text, cta_text text, cta_url text,
  bg_color text, text_color text, cta_bg_color text, cta_text_color text
)
language sql stable security definer set search_path = public as $$
  select enabled, title, message, cta_text, cta_url, bg_color, text_color, cta_bg_color, cta_text_color
  from public.auth_notice_configs where owner_id = p_owner_id limit 1
$$;

grant execute on function public.get_auth_notice(uuid) to anon, authenticated;