-- Add location_scope to profiles for controlling job search geographic scope.
-- Values: 'city' (exact location match), 'country' (country-level), 'global' (worldwide / remote).
-- Defaults to 'city' to preserve existing behaviour for current users.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'profiles'
      AND column_name  = 'location_scope'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN location_scope text NOT NULL DEFAULT 'city';

    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_location_scope_check
      CHECK (location_scope IN ('city', 'country', 'global'));

    COMMENT ON COLUMN public.profiles.location_scope IS
      'Geographic scope for job search: city (exact), country (country-level), global (worldwide/remote)';
  END IF;
END
$$;
