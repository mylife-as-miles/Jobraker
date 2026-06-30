-- Migration: Add portfolio cache columns (github_data, linkedin_data, portfolio_sync_meta) to profiles table
alter table if exists public.profiles
add column if not exists github_data jsonb not null default '{}'::jsonb,
add column if not exists linkedin_data jsonb not null default '{}'::jsonb,
add column if not exists portfolio_sync_meta jsonb not null default '{}'::jsonb;

-- Safety checks to backfill and set NOT NULL if they somehow pre-existed as nullable
update public.profiles set github_data = '{}'::jsonb where github_data is null;
update public.profiles set linkedin_data = '{}'::jsonb where linkedin_data is null;
update public.profiles set portfolio_sync_meta = '{}'::jsonb where portfolio_sync_meta is null;

alter table public.profiles
alter column github_data set default '{}'::jsonb,
alter column linkedin_data set default '{}'::jsonb,
alter column portfolio_sync_meta set default '{}'::jsonb;

alter table public.profiles
alter column github_data set not null,
alter column linkedin_data set not null,
alter column portfolio_sync_meta set not null;
