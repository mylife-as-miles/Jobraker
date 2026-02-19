-- Enable pgvector (assuming extension available)
create extension if not exists vector;
-- Add embedding column (1536 dims typical for text-embedding-3-small) adjust if needed
alter table public.parsed_resumes add column if not exists embedding vector(256);
-- Simple HNSW index (if supported) else fall back to ivfflat
-- create index if not exists parsed_resumes_embedding_idx on public.parsed_resumes using hnsw (embedding vector_l2_ops);;
