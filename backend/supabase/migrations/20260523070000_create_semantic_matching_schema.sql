-- Migration: Setup pgvector schema, tables, indexes, and search functions
-- Created at: 2026-05-23

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create Job Chunks Table
CREATE TABLE IF NOT EXISTS public.job_chunks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  section text NOT NULL,
  chunk_text text NOT NULL,
  embedding vector(768),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_chunks_job_idx ON public.job_chunks (job_id);

ALTER TABLE public.job_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view job chunks" ON public.job_chunks;
CREATE POLICY "Anyone can view job chunks"
  ON public.job_chunks FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage job chunks" ON public.job_chunks;
CREATE POLICY "Admins can manage job chunks"
  ON public.job_chunks FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3. Create Profile Evidence Chunks Table
CREATE TABLE IF NOT EXISTS public.profile_evidence_chunks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  evidence_id uuid REFERENCES public.profile_evidence_items(id) ON DELETE CASCADE,
  section text NOT NULL,
  chunk_text text NOT NULL,
  embedding vector(768),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_evidence_chunks_user_idx ON public.profile_evidence_chunks (user_id);

ALTER TABLE public.profile_evidence_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own profile evidence chunks" ON public.profile_evidence_chunks;
CREATE POLICY "Users can manage own profile evidence chunks"
  ON public.profile_evidence_chunks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Create Candidate Memory Chunks Table
CREATE TABLE IF NOT EXISTS public.candidate_memory_chunks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_text text NOT NULL,
  embedding vector(768),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS candidate_memory_chunks_user_idx ON public.candidate_memory_chunks (user_id);

ALTER TABLE public.candidate_memory_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own candidate memory chunks" ON public.candidate_memory_chunks;
CREATE POLICY "Users can manage own candidate memory chunks"
  ON public.candidate_memory_chunks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Create Application Note Chunks Table
CREATE TABLE IF NOT EXISTS public.application_note_chunks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id uuid REFERENCES public.applications(id) ON DELETE CASCADE,
  chunk_text text NOT NULL,
  embedding vector(768),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_note_chunks_user_idx ON public.application_note_chunks (user_id);

ALTER TABLE public.application_note_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own application note chunks" ON public.application_note_chunks;
CREATE POLICY "Users can manage own application note chunks"
  ON public.application_note_chunks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Create Chat Memory Chunks Table
CREATE TABLE IF NOT EXISTS public.chat_memory_chunks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_text text NOT NULL,
  embedding vector(768),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_memory_chunks_user_idx ON public.chat_memory_chunks (user_id);

ALTER TABLE public.chat_memory_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own chat memory chunks" ON public.chat_memory_chunks;
CREATE POLICY "Users can manage own chat memory chunks"
  ON public.chat_memory_chunks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. Add HNSW Indexes for Cosine Distance (vector_cosine_ops)
CREATE INDEX IF NOT EXISTS job_chunks_embedding_hnsw_idx ON public.job_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS profile_evidence_chunks_embedding_hnsw_idx ON public.profile_evidence_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS candidate_memory_chunks_embedding_hnsw_idx ON public.candidate_memory_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS application_note_chunks_embedding_hnsw_idx ON public.application_note_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS chat_memory_chunks_embedding_hnsw_idx ON public.chat_memory_chunks USING hnsw (embedding vector_cosine_ops);

-- 8. Cosine Similarity Matching RPC for Profile Evidence
CREATE OR REPLACE FUNCTION public.match_profile_evidence_chunks(
  query_embedding vector(768),
  match_threshold double precision,
  match_count integer,
  owner_id uuid
)
RETURNS TABLE (
  id uuid,
  evidence_id uuid,
  section text,
  chunk_text text,
  similarity double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Enforce security: users can only query their own data
  IF auth.uid() IS NOT NULL AND auth.uid() <> owner_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot query another user''s data';
  END IF;

  RETURN QUERY
  SELECT
    pec.id,
    pec.evidence_id,
    pec.section,
    pec.chunk_text,
    (1 - (pec.embedding <=> query_embedding)) AS similarity
  FROM public.profile_evidence_chunks pec
  WHERE pec.user_id = owner_id
    AND (1 - (pec.embedding <=> query_embedding)) > match_threshold
  ORDER BY pec.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 9. Cosine Similarity Matching RPC for Candidate Memory
CREATE OR REPLACE FUNCTION public.match_candidate_memory_chunks(
  query_embedding vector(768),
  match_threshold double precision,
  match_count integer,
  owner_id uuid
)
RETURNS TABLE (
  id uuid,
  chunk_text text,
  similarity double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Enforce security: users can only query their own data
  IF auth.uid() IS NOT NULL AND auth.uid() <> owner_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot query another user''s data';
  END IF;

  RETURN QUERY
  SELECT
    cmc.id,
    cmc.chunk_text,
    (1 - (cmc.embedding <=> query_embedding)) AS similarity
  FROM public.candidate_memory_chunks cmc
  WHERE cmc.user_id = owner_id
    AND (1 - (cmc.embedding <=> query_embedding)) > match_threshold
  ORDER BY cmc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 10. Cross-Similarity Matching RPC for Job-to-Profile Chunks
CREATE OR REPLACE FUNCTION public.match_job_to_profile(
  p_job_id uuid,
  p_user_id uuid,
  p_threshold double precision DEFAULT 0.7,
  p_limit integer DEFAULT 5
)
RETURNS TABLE (
  job_chunk_section text,
  job_chunk_text text,
  evidence_chunk_text text,
  evidence_id uuid,
  similarity double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Enforce security: users can only query their own data
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot query another user''s data';
  END IF;

  RETURN QUERY
  WITH matched AS (
    SELECT
      jc.section AS j_section,
      jc.chunk_text AS j_text,
      pec.chunk_text AS e_text,
      pec.evidence_id AS e_id,
      (1 - (jc.embedding <=> pec.embedding)) AS sim,
      ROW_NUMBER() OVER(PARTITION BY jc.id ORDER BY jc.embedding <=> pec.embedding) as rn
    FROM public.job_chunks jc
    JOIN public.profile_evidence_chunks pec ON pec.user_id = p_user_id
    WHERE jc.job_id = p_job_id
      AND (1 - (jc.embedding <=> pec.embedding)) >= p_threshold
  )
  SELECT j_section, j_text, e_text, e_id, sim
  FROM matched
  WHERE rn <= p_limit
  ORDER BY sim DESC;
END;
$$;

-- Grants
GRANT ALL ON TABLE public.job_chunks TO authenticated, service_role;
GRANT ALL ON TABLE public.profile_evidence_chunks TO authenticated, service_role;
GRANT ALL ON TABLE public.candidate_memory_chunks TO authenticated, service_role;
GRANT ALL ON TABLE public.application_note_chunks TO authenticated, service_role;
GRANT ALL ON TABLE public.chat_memory_chunks TO authenticated, service_role;
