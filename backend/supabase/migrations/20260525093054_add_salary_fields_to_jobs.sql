ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS salary_min integer,
  ADD COLUMN IF NOT EXISTS salary_max integer,
  ADD COLUMN IF NOT EXISTS salary_currency text;

COMMENT ON COLUMN public.jobs.salary_min IS
  'Lower bound of salary range extracted from official job detail pages, when stated.';

COMMENT ON COLUMN public.jobs.salary_max IS
  'Upper bound of salary range extracted from official job detail pages, when stated.';

COMMENT ON COLUMN public.jobs.salary_currency IS
  'ISO-like currency code for extracted salary values, for example USD, GBP, EUR, NGN.';
