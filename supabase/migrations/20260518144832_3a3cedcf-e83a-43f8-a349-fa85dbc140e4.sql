
create table if not exists public.registration_update_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  wheel_user_id uuid,
  user_email text not null default '',
  user_name text not null default '',
  account_id text not null default '',
  changed_fields jsonb not null default '[]'::jsonb,
  before_data jsonb not null default '{}'::jsonb,
  after_data jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  device_type text,
  os text,
  browser text,
  city text,
  region text,
  country text,
  referrer text,
  page_url text,
  session_id text,
  created_at timestamptz not null default now()
);

create index if not exists registration_update_logs_owner_idx on public.registration_update_logs(owner_id, created_at desc);
create index if not exists registration_update_logs_email_idx on public.registration_update_logs(owner_id, user_email);

alter table public.registration_update_logs enable row level security;

create policy "Owners read own update logs"
  on public.registration_update_logs for select to authenticated
  using ((owner_id = auth.uid()) or has_role(auth.uid(), 'admin'::app_role));

create policy "Owners delete own update logs"
  on public.registration_update_logs for delete to authenticated
  using ((owner_id = auth.uid()) or has_role(auth.uid(), 'admin'::app_role));

create policy "Service role manages update logs"
  on public.registration_update_logs for all
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
