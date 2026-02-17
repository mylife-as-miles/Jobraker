-- Migration: Trusted devices table with RLS
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
drop policy if exists "Read own devices" on public.security_trusted_devices;
create policy "Read own devices" on public.security_trusted_devices for select using (auth.uid() = user_id);
drop policy if exists "Insert own devices" on public.security_trusted_devices;
create policy "Insert own devices" on public.security_trusted_devices for insert with check (auth.uid() = user_id);
drop policy if exists "Update own devices" on public.security_trusted_devices;
create policy "Update own devices" on public.security_trusted_devices for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Delete own devices" on public.security_trusted_devices;
create policy "Delete own devices" on public.security_trusted_devices for delete using (auth.uid() = user_id);
