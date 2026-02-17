-- Migration: Backup codes table with RLS
create table if not exists public.security_backup_codes (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.security_backup_codes enable row level security;
drop policy if exists "Read own backup codes" on public.security_backup_codes;
create policy "Read own backup codes" on public.security_backup_codes for select using (auth.uid() = user_id);
drop policy if exists "Insert own backup codes" on public.security_backup_codes;
create policy "Insert own backup codes" on public.security_backup_codes for insert with check (auth.uid() = user_id);
drop policy if exists "Update own backup codes" on public.security_backup_codes;
create policy "Update own backup codes" on public.security_backup_codes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Delete own backup codes" on public.security_backup_codes;
create policy "Delete own backup codes" on public.security_backup_codes for delete using (auth.uid() = user_id);
