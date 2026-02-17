-- Enable the pgvector extension for similarity search
CREATE EXTENSION IF NOT EXISTS vector;
-- Stores structured data from user resumes
CREATE TABLE IF NOT EXISTS public.candidate_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    full_name TEXT,
    location TEXT,
    years_of_experience NUMERIC,
    core_skills TEXT[],
    work_experience JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
-- Stores scraped job listings and their vector embeddings
CREATE TABLE IF NOT EXISTS public.job_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_title TEXT,
    company_name TEXT,
    location TEXT,
    work_type TEXT,
    experience_level TEXT,
    required_skills TEXT[],
    full_job_description TEXT,
    description_embedding VECTOR(384), -- Stores the vector for semantic search
    source_url TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);
-- SQL function to perform vector similarity search
CREATE OR REPLACE FUNCTION match_jobs (
  query_embedding VECTOR(384),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  job_title TEXT,
  company_name TEXT,
  location TEXT,
  work_type TEXT,
  experience_level TEXT,
  required_skills TEXT[],
  full_job_description TEXT,
  source_url TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    jl.id,
    jl.job_title,
    jl.company_name,
    jl.location,
    jl.work_type,
    jl.experience_level,
    jl.required_skills,
    jl.full_job_description,
    jl.source_url,
    1 - (jl.description_embedding <=> query_embedding) AS similarity
  FROM
    job_listings AS jl
  WHERE 1 - (jl.description_embedding <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT match_count;
END;
$$;
-- Add Row Level Security (example policies)
ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own profiles." ON public.candidate_profiles FOR ALL USING (auth.uid() = user_id);
ALTER TABLE public.job_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read jobs." ON public.job_listings FOR SELECT USING (auth.role() = 'authenticated');
