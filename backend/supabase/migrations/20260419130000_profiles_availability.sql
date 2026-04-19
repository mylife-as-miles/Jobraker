-- Candidate availability for scheduling and recruiter context
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS availability_start text,
  ADD COLUMN IF NOT EXISTS preferred_weekly_hours integer,
  ADD COLUMN IF NOT EXISTS work_timezone text,
  ADD COLUMN IF NOT EXISTS weekly_availability jsonb,
  ADD COLUMN IF NOT EXISTS availability_date_exceptions jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.availability_start IS 'When the candidate can start a new role (e.g. immediately, two_weeks).';
COMMENT ON COLUMN public.profiles.preferred_weekly_hours IS 'Ideal weekly hours (e.g. 40 for full-time).';
COMMENT ON COLUMN public.profiles.work_timezone IS 'IANA timezone for interpreting weekly availability.';
COMMENT ON COLUMN public.profiles.weekly_availability IS 'JSON map of day index 0=Sun..6=Sat to array of {start,end} in HH:MM.';
COMMENT ON COLUMN public.profiles.availability_date_exceptions IS 'Array of {id,date,unavailable,slots} for date-specific overrides.';
