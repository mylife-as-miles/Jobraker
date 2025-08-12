-- Migration: Add factor_id column to security_settings
alter table if exists public.security_settings
  add column if not exists factor_id text;

-- no policy changes needed
