-- Security settings per user
create table if not exists public.security_settings (
  id uuid primary key references auth.users(id) on delete cascade,
  two_factor_enabled boolean default false,
  sign_in_alerts boolean default true,
  factor_id text,
  updated_at timestamptz default now()
);

alter table public.security_settings enable row level security;

create policy if not exists "Read own security settings"
  on public.security_settings for select
  using (auth.uid() = id);

create policy if not exists "Insert own security settings"
  on public.security_settings for insert
  with check (auth.uid() = id);

create policy if not exists "Update own security settings"
  on public.security_settings for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy if not exists "Delete own security settings"
  on public.security_settings for delete
  using (auth.uid() = id);
