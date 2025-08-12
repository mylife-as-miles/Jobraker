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

-- Backup codes
create table if not exists public.security_backup_codes (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.security_backup_codes enable row level security;

create policy if not exists "Read own backup codes" on public.security_backup_codes for select using (auth.uid() = user_id);
create policy if not exists "Insert own backup codes" on public.security_backup_codes for insert with check (auth.uid() = user_id);
create policy if not exists "Update own backup codes" on public.security_backup_codes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "Delete own backup codes" on public.security_backup_codes for delete using (auth.uid() = user_id);

-- Trusted devices
create table if not exists public.security_trusted_devices (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_name text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, device_id)
);

alter table public.security_trusted_devices enable row level security;

create policy if not exists "Read own devices" on public.security_trusted_devices for select using (auth.uid() = user_id);
create policy if not exists "Insert own devices" on public.security_trusted_devices for insert with check (auth.uid() = user_id);
create policy if not exists "Update own devices" on public.security_trusted_devices for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "Delete own devices" on public.security_trusted_devices for delete using (auth.uid() = user_id);
