DO $$
BEGIN
  -- Only proceed if table exists (guards environments missing parsed_resumes)
  IF to_regclass('public.parsed_resumes') IS NOT NULL THEN
    -- Try HNSW first
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
  ELSE
    RAISE NOTICE 'Table public.parsed_resumes not found; skipping embedding index creation.';
  END IF;
END $$;
