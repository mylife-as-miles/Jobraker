-- Work eligibility answers used by auto-apply.
--
-- apply-to-jobs treats these as critical screening answers. Without a stored
-- value every Autopilot request was downgraded to a draft ("Missing required
-- critical answers"). Users answer once; the runner reads them from here.
--
-- Additive and nullable: NULL means "not answered yet" and keeps the existing
-- behaviour (the application is saved as a draft for review).
-- Existing profiles RLS policies (own row) cover the new columns.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS work_authorized boolean,
  ADD COLUMN IF NOT EXISTS requires_visa_sponsorship boolean,
  ADD COLUMN IF NOT EXISTS desired_salary text,
  ADD COLUMN IF NOT EXISTS has_security_clearance boolean,
  ADD COLUMN IF NOT EXISTS willing_to_relocate boolean,
  ADD COLUMN IF NOT EXISTS work_eligibility_updated_at timestamptz;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_desired_salary_length;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_desired_salary_length
  CHECK (desired_salary IS NULL OR char_length(desired_salary) <= 120);

COMMENT ON COLUMN public.profiles.work_authorized IS
  'Auto-apply answer: legally authorized to work where the user applies. NULL = not answered.';
COMMENT ON COLUMN public.profiles.requires_visa_sponsorship IS
  'Auto-apply answer: requires visa sponsorship now or in future. NULL = not answered.';
COMMENT ON COLUMN public.profiles.desired_salary IS
  'Auto-apply answer: target or minimum compensation, free text (for example "90000 USD per year").';
COMMENT ON COLUMN public.profiles.has_security_clearance IS
  'Auto-apply answer: holds an active security clearance. NULL = not answered.';
COMMENT ON COLUMN public.profiles.willing_to_relocate IS
  'Auto-apply answer: willing to relocate if required. NULL = not answered.';
COMMENT ON COLUMN public.profiles.work_eligibility_updated_at IS
  'When the user last saved their work eligibility answers.';
