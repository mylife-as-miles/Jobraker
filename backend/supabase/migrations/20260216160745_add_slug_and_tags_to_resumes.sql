-- Add slug and tags to resumes table
alter table public.resumes 
add column if not exists slug text unique,
add column if not exists tags text[] default '{}';

-- Create index on slug for fast lookups
create index if not exists resumes_slug_idx on public.resumes(slug);
