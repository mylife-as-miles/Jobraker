-- Add embedding column safely
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'parsed_resumes') THEN
        -- Enable pgvector (assuming extension available)
        create extension if not exists vector;
        
        alter table public.parsed_resumes add column if not exists embedding vector(256);
    END IF;
END $$;
