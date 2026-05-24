-- Migration: Add missing pgvector similarity matching RPCs
-- Created at: 2026-05-24

-- 1. Job Chunks similarity search RPC
CREATE OR REPLACE FUNCTION public.match_job_chunks(
  query_embedding vector(768),
  match_threshold double precision,
  match_count integer,
  owner_id uuid
)
RETURNS TABLE (
  id uuid,
  job_id uuid,
  section text,
  chunk_text text,
  similarity double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> owner_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot query another user''s data';
  END IF;

  RETURN QUERY
  SELECT
    jc.id,
    jc.job_id,
    jc.section,
    jc.chunk_text,
    (1 - (jc.embedding <=> query_embedding)) AS similarity
  FROM public.job_chunks jc
  JOIN public.jobs j ON j.id = jc.job_id
  WHERE j.user_id = owner_id
    AND (1 - (jc.embedding <=> query_embedding)) > match_threshold
  ORDER BY jc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 2. Application Note Chunks similarity search RPC
CREATE OR REPLACE FUNCTION public.match_application_note_chunks(
  query_embedding vector(768),
  match_threshold double precision,
  match_count integer,
  owner_id uuid
)
RETURNS TABLE (
  id uuid,
  application_id uuid,
  chunk_text text,
  similarity double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> owner_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot query another user''s data';
  END IF;

  RETURN QUERY
  SELECT
    anc.id,
    anc.application_id,
    anc.chunk_text,
    (1 - (anc.embedding <=> query_embedding)) AS similarity
  FROM public.application_note_chunks anc
  WHERE anc.user_id = owner_id
    AND (1 - (anc.embedding <=> query_embedding)) > match_threshold
  ORDER BY anc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 3. Unified search RPC across all chunk tables
CREATE OR REPLACE FUNCTION public.match_all_chunks(
  query_embedding vector(768),
  match_threshold double precision,
  match_count integer,
  owner_id uuid
)
RETURNS TABLE (
  chunk_source text,
  source_id uuid, -- job_id, evidence_id, application_id, or answer_bank_id
  section text,
  chunk_text text,
  similarity double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> owner_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot query another user''s data';
  END IF;

  RETURN QUERY
  WITH combined AS (
    -- Profile Evidence Chunks
    SELECT 
      'profile_evidence'::text AS chunk_source,
      pec.evidence_id AS source_id,
      pec.section,
      pec.chunk_text,
      (1 - (pec.embedding <=> query_embedding)) AS similarity
    FROM public.profile_evidence_chunks pec
    WHERE pec.user_id = owner_id

    UNION ALL

    -- Candidate Memory Chunks (including Answer Bank)
    SELECT 
      'candidate_memory'::text AS chunk_source,
      CASE 
        WHEN cmc.metadata->>'type' = 'answer_bank' THEN (cmc.metadata->>'answer_bank_id')::uuid
        ELSE NULL
      END AS source_id,
      COALESCE(cmc.metadata->>'type', 'candidate_memory')::text AS section,
      cmc.chunk_text,
      (1 - (cmc.embedding <=> query_embedding)) AS similarity
    FROM public.candidate_memory_chunks cmc
    WHERE cmc.user_id = owner_id

    UNION ALL

    -- Application Note Chunks
    SELECT 
      'application_notes'::text AS chunk_source,
      anc.application_id AS source_id,
      'notes'::text AS section,
      anc.chunk_text,
      (1 - (anc.embedding <=> query_embedding)) AS similarity
    FROM public.application_note_chunks anc
    WHERE anc.user_id = owner_id

    UNION ALL

    -- Job Chunks
    SELECT 
      'jobs'::text AS chunk_source,
      jc.job_id AS source_id,
      jc.section,
      jc.chunk_text,
      (1 - (jc.embedding <=> query_embedding)) AS similarity
    FROM public.job_chunks jc
    JOIN public.jobs j ON j.id = jc.job_id
    WHERE j.user_id = owner_id
  )
  SELECT *
  FROM combined
  WHERE similarity > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.match_job_chunks TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_application_note_chunks TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_all_chunks TO authenticated, service_role;
