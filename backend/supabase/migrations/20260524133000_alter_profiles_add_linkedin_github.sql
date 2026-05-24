-- Migration: Add linkedin_url and github_url columns to profiles table
alter table if exists public.profiles add column if not exists linkedin_url text;
alter table if exists public.profiles add column if not exists github_url text;
