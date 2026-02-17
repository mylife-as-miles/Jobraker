-- Migration: add phone and avatar_url to profiles
alter table if exists public.profiles add column if not exists phone text;
alter table if exists public.profiles add column if not exists avatar_url text;
