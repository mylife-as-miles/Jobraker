-- Add new columns to cover_letters table to match resumes table structure
alter table public.cover_letters
add column if not exists slug text unique,
add column if not exists tags text[],
add column if not exists data jsonb default '{}'::jsonb;

-- Add index on slug for faster lookups
create index if not exists cover_letters_slug_idx on public.cover_letters (slug);
