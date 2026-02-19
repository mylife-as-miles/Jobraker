-- Add data column to resumes table
alter table public.resumes 
add column if not exists data jsonb default '{}'::jsonb;
