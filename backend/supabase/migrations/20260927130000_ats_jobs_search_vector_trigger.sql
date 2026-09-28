-- Replace the generated search_vector with a trigger-maintained column.
--
-- A STORED generated column is recomputed on every UPDATE of the row, so the
-- sync's "still open" stamp (last_seen_at) re-ran to_tsvector over long
-- descriptions for thousands of rows and hit the statement timeout. The
-- trigger only recomputes when a searchable column actually changes.

ALTER TABLE public.ats_jobs DROP COLUMN IF EXISTS search_vector;  -- also drops ats_jobs_search_idx
ALTER TABLE public.ats_jobs ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE public.ats_jobs ADD COLUMN IF NOT EXISTS content_hash text;

CREATE OR REPLACE FUNCTION public.ats_jobs_search_vector_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.company_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.location_text, '') || ' ' || coalesce(NEW.department, '')), 'C') ||
    setweight(to_tsvector('english', left(coalesce(NEW.description_text, ''), 20000)), 'D');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ats_jobs_search_vector_trg ON public.ats_jobs;
CREATE TRIGGER ats_jobs_search_vector_trg
  BEFORE INSERT OR UPDATE OF title, company_name, location_text, department, description_text
  ON public.ats_jobs
  FOR EACH ROW EXECUTE FUNCTION public.ats_jobs_search_vector_update();

-- Backfill existing rows (fires the trigger through UPDATE OF title).
UPDATE public.ats_jobs SET title = title;

CREATE INDEX IF NOT EXISTS ats_jobs_search_idx ON public.ats_jobs USING gin (search_vector);
