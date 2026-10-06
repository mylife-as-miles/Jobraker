-- Shared email discovery cache. What we learn about a company's email setup
-- (its format, whether its mail server accepts every address) and which
-- recruiter addresses checked out is stored once and reused for every user,
-- so each company costs RTRVR and Reoon work only the first time.
-- Written and read by the scout-company function (service role) only.

CREATE TABLE IF NOT EXISTS public.company_email_profiles (
  domain text PRIMARY KEY CHECK (domain = lower(domain)),
  company text,
  mx_ok boolean,
  -- true when the mail server accepts any address, so checks prove nothing.
  catch_all boolean,
  email_pattern text,
  pattern_confidence numeric CHECK (pattern_confidence BETWEEN 0 AND 1),
  pattern_samples integer NOT NULL DEFAULT 0,
  checked_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shared_recruiter_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL CHECK (domain = lower(domain)),
  company text NOT NULL,
  full_name text NOT NULL,
  title text,
  role_kind text,
  linkedin_url text,
  email text NOT NULL CHECK (email = lower(email)),
  -- provider_verified: Reoon confirmed the mailbox. source_verified: the
  -- company published it. pattern_only: matches the company format but the
  -- server could not confirm it. bounced: a send to it failed.
  email_status text NOT NULL
    CHECK (email_status IN ('provider_verified', 'source_verified', 'pattern_only', 'bounced')),
  email_confidence numeric CHECK (email_confidence BETWEEN 0 AND 1),
  source_url text,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain, email)
);

CREATE INDEX IF NOT EXISTS shared_recruiter_contacts_domain_idx
  ON public.shared_recruiter_contacts (domain, email_status, last_checked_at DESC);

ALTER TABLE public.company_email_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_recruiter_contacts ENABLE ROW LEVEL SECURITY;

-- No policies: users never read these directly; results reach them through
-- scout-company, which copies them into their own recruiter_contacts rows.
REVOKE ALL ON public.company_email_profiles FROM anon, authenticated;
REVOKE ALL ON public.shared_recruiter_contacts FROM anon, authenticated;
GRANT ALL ON public.company_email_profiles TO service_role;
GRANT ALL ON public.shared_recruiter_contacts TO service_role;
