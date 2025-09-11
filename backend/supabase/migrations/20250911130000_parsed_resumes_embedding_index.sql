-- Add vector similarity index for parsed_resumes.embedding
-- Prefers HNSW if available, else falls back to IVFFLAT.
-- NOTE: Ensure pgvector >= 0.5.0 for HNSW support.

DO $$
BEGIN
  -- Try HNSW
  BEGIN
    EXECUTE 'create index if not exists parsed_resumes_embedding_hnsw_idx on public.parsed_resumes using hnsw (embedding vector_l2_ops)';
  EXCEPTION WHEN undefined_object OR syntax_error THEN
    -- Fallback to IVFFLAT (requires setting lists parameter after index build if desired)
    BEGIN
      EXECUTE 'create index if not exists parsed_resumes_embedding_ivfflat_idx on public.parsed_resumes using ivfflat (embedding vector_l2_ops)';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to create both HNSW and IVFFLAT indexes for parsed_resumes.embedding';
    END;
  END;
END $$;
