-- Migration: Add security_settings table with RLS policies
create table if not exists public.security_settings (
  id uuid primary key references auth.users(id) on delete cascade,
  two_factor_enabled boolean default false,
  sign_in_alerts boolean default true,
  updated_at timestamptz default now()
);

alter table public.security_settings enable row level security;

drop policy if exists "Read own security settings" on public.security_settings;
drop policy if exists "Insert own security settings" on public.security_settings;
drop policy if exists "Update own security settings" on public.security_settings;
drop policy if exists "Delete own security settings" on public.security_settings;

create policy "Read own security settings"
  on public.security_settings for select using (auth.uid() = id);
create policy "Insert own security settings"
  on public.security_settings for insert with check (auth.uid() = id);
create policy "Update own security settings"
  on public.security_settings for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "Delete own security settings"
  on public.security_settings for delete using (auth.uid() = id);
