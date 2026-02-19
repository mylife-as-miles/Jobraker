-- Add 'data' column to store the full resume JSON structure for the builder
ALTER TABLE public.resumes 
ADD COLUMN IF NOT EXISTS "data" jsonb DEFAULT '{}'::jsonb;

-- Add 'slug' column for potential public sharing or cleaner URLs
ALTER TABLE public.resumes 
ADD COLUMN IF NOT EXISTS "slug" text;

-- Add index on slug for faster lookups
CREATE INDEX IF NOT EXISTS resumes_slug_idx ON public.resumes(slug);
