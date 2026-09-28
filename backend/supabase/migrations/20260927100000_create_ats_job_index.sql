-- ATS job index (job search re-engineering, Phase 1).
--
-- A shared, global index of real job postings pulled from applicant tracking
-- system (ATS) public job-board APIs. Every row is a single posting with a
-- direct apply URL, so directory/listing pages cannot enter the index.
--
-- Additive only: the existing per-user public.jobs table is untouched.
-- Reads: any signed-in user. Writes: service role only (ats-sync function).

CREATE TABLE IF NOT EXISTS public.ats_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ats text NOT NULL CHECK (ats IN (
    'greenhouse', 'recruitee', 'ashby', 'lever', 'smartrecruiters',
    'workable', 'teamtailor', 'breezy', 'rippling', 'bamboohr'
  )),
  board_token text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  open_job_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ats, board_token)
);

CREATE TABLE IF NOT EXISTS public.ats_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.ats_companies(id) ON DELETE CASCADE,
  ats text NOT NULL,
  external_id text NOT NULL,
  title text NOT NULL,
  company_name text NOT NULL,
  location_text text,
  -- 'worldwide' | 'restricted' (remote within listed countries) | 'onsite' | 'hybrid' | 'unknown'
  remote_scope text NOT NULL DEFAULT 'unknown',
  countries text[] NOT NULL DEFAULT '{}',
  department text,
  employment_type text,
  apply_url text NOT NULL,
  job_url text,
  description_text text,
  salary_min numeric,
  salary_max numeric,
  salary_currency text,
  salary_period text,
  -- Normalized application questions when the ATS exposes them.
  questions jsonb,
  questions_known boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  posted_at timestamptz,
  source_updated_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  content_hash text,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(company_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(location_text, '') || ' ' || coalesce(department, '')), 'C') ||
    setweight(to_tsvector('english', left(coalesce(description_text, ''), 20000)), 'D')
  ) STORED,
  UNIQUE (company_id, external_id)
);

CREATE INDEX IF NOT EXISTS ats_jobs_open_idx ON public.ats_jobs (status, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS ats_jobs_search_idx ON public.ats_jobs USING gin (search_vector);
CREATE INDEX IF NOT EXISTS ats_jobs_countries_idx ON public.ats_jobs USING gin (countries);
CREATE INDEX IF NOT EXISTS ats_jobs_remote_scope_idx ON public.ats_jobs (remote_scope) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS ats_companies_sync_idx ON public.ats_companies (active, last_synced_at NULLS FIRST);

ALTER TABLE public.ats_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ats_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read ats companies" ON public.ats_companies;
CREATE POLICY "Authenticated can read ats companies" ON public.ats_companies
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can read ats jobs" ON public.ats_jobs;
CREATE POLICY "Authenticated can read ats jobs" ON public.ats_jobs
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.ats_companies, public.ats_jobs TO authenticated;
GRANT ALL ON public.ats_companies, public.ats_jobs TO service_role;

-- Seed: boards verified live on 2026-09-27 (docs/ATS_PLATFORM_RESEARCH.md).
INSERT INTO public.ats_companies (ats, board_token, name) VALUES
  ('greenhouse','airbnb','Airbnb'), ('greenhouse','stripe','Stripe'), ('greenhouse','gitlab','GitLab'),
  ('greenhouse','figma','Figma'), ('greenhouse','discord','Discord'), ('greenhouse','dropbox','Dropbox'),
  ('greenhouse','reddit','Reddit'), ('greenhouse','robinhood','Robinhood'), ('greenhouse','duolingo','Duolingo'),
  ('greenhouse','pinterest','Pinterest'), ('greenhouse','lyft','Lyft'), ('greenhouse','cloudflare','Cloudflare'),
  ('greenhouse','databricks','Databricks'), ('greenhouse','datadog','Datadog'), ('greenhouse','mongodb','MongoDB'),
  ('greenhouse','twilio','Twilio'), ('greenhouse','okta','Okta'), ('greenhouse','elastic','Elastic'),
  ('greenhouse','gusto','Gusto'), ('greenhouse','instacart','Instacart'), ('greenhouse','asana','Asana'),
  ('greenhouse','brex','Brex'), ('greenhouse','airtable','Airtable'), ('greenhouse','samsara','Samsara'),
  ('greenhouse','webflow','Webflow'), ('greenhouse','anthropic','Anthropic'), ('greenhouse','scaleai','Scale AI'),
  ('greenhouse','affirm','Affirm'), ('greenhouse','chime','Chime'), ('greenhouse','carta','Carta'),
  ('greenhouse','flexport','Flexport'), ('greenhouse','nextdoor','Nextdoor'), ('greenhouse','squarespace','Squarespace'),
  ('greenhouse','bitwarden','Bitwarden'), ('greenhouse','remotecom','Remote'), ('greenhouse','wikimedia','Wikimedia Foundation'),
  ('greenhouse','mozilla','Mozilla'), ('greenhouse','coursera','Coursera'), ('greenhouse','udemy','Udemy'),
  ('greenhouse','canonical','Canonical'),
  ('recruitee','anywhereworks','AnywhereWorks'), ('recruitee','timedoctor','Time Doctor'), ('recruitee','trafilea','Trafilea'),
  ('recruitee','mcdglobalhealth','MCD Global Health'), ('recruitee','holepunch','Holepunch'), ('recruitee','greatminds','Great Minds'),
  ('recruitee','ogcglobal','OGC Global'), ('recruitee','transperfect','TransPerfect'), ('recruitee','aikidosecurity','Aikido Security'),
  ('recruitee','miaplaza','Miaplaza')
ON CONFLICT (ats, board_token) DO NOTHING;
