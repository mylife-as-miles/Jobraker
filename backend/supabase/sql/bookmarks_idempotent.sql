BEGIN;

-- Table
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_url text NOT NULL,
  job_title text,
  company text,
  location text,
  logo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Primary key (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookmarks_pkey'
  ) THEN
    ALTER TABLE public.bookmarks
      ADD CONSTRAINT bookmarks_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Unique per user+source (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='bookmarks' AND indexname='bookmarks_user_source_unique'
  ) THEN
    CREATE UNIQUE INDEX bookmarks_user_source_unique
      ON public.bookmarks (user_id, source_url);
  END IF;
END $$;

-- Foreign key to auth.users (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookmarks_user_id_fkey'
  ) THEN
    ALTER TABLE public.bookmarks
      ADD CONSTRAINT bookmarks_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Index for faster listing (idempotent)
CREATE INDEX IF NOT EXISTS bookmarks_user_created_idx
  ON public.bookmarks (user_id, created_at DESC);

-- RLS
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- Policies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bookmarks' AND policyname='Select own bookmarks') THEN
    CREATE POLICY "Select own bookmarks" ON public.bookmarks FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bookmarks' AND policyname='Insert own bookmarks') THEN
    CREATE POLICY "Insert own bookmarks" ON public.bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bookmarks' AND policyname='Delete own bookmarks') THEN
    CREATE POLICY "Delete own bookmarks" ON public.bookmarks FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Grants
GRANT ALL ON TABLE public.bookmarks TO anon;
GRANT ALL ON TABLE public.bookmarks TO authenticated;
GRANT ALL ON TABLE public.bookmarks TO service_role;

COMMIT;
