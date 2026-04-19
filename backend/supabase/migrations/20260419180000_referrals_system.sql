-- Referral program: codes, attribution, funnel sync, LinkedIn imports, AI match suggestions

-- ---------------------------------------------------------------------------
-- Profiles: referral code + who referred this user
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_lower_idx
  ON public.profiles (lower(referral_code))
  WHERE referral_code IS NOT NULL AND referral_code <> '';

COMMENT ON COLUMN public.profiles.referral_code IS 'Public share code for ?ref= signup attribution.';
COMMENT ON COLUMN public.profiles.referred_by_user_id IS 'Profile id of the user who referred this account, if any.';

-- ---------------------------------------------------------------------------
-- Referrals (one row per referred user)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_email text,
  funnel_stage text NOT NULL DEFAULT 'signed_up'
    CHECK (funnel_stage IN (
      'signed_up',
      'application_started',
      'application_completed',
      'offer_extended',
      'hired',
      'paid'
    )),
  signed_up_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS referrals_referred_user_id_key
  ON public.referrals (referred_user_id);

CREATE INDEX IF NOT EXISTS referrals_referrer_user_idx
  ON public.referrals (referrer_user_id, signed_up_at DESC);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view referrals they are part of" ON public.referrals;
CREATE POLICY "Users can view referrals they are part of"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

DROP POLICY IF EXISTS "Service manages referrals" ON public.referrals;
-- Inserts/updates via SECURITY DEFINER RPCs only; no direct client insert policy

-- ---------------------------------------------------------------------------
-- LinkedIn connection imports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.linkedin_connection_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_filename text,
  row_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS linkedin_imports_user_idx
  ON public.linkedin_connection_imports (user_id, created_at DESC);

ALTER TABLE public.linkedin_connection_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own linkedin imports" ON public.linkedin_connection_imports;
CREATE POLICY "Users manage own linkedin imports"
  ON public.linkedin_connection_imports FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.linkedin_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  import_id uuid NOT NULL REFERENCES public.linkedin_connection_imports(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  email text,
  company text,
  position text,
  connected_on date,
  profile_url text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  agent_scan_status text NOT NULL DEFAULT 'pending'
    CHECK (agent_scan_status IN ('pending', 'running', 'complete', 'error')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS linkedin_connections_user_idx
  ON public.linkedin_connections (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS linkedin_connections_import_idx
  ON public.linkedin_connections (import_id);

ALTER TABLE public.linkedin_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own linkedin connections" ON public.linkedin_connections;
CREATE POLICY "Users manage own linkedin connections"
  ON public.linkedin_connections FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- AI match suggestions (agent output)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_match_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.linkedin_connections(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  fit_score integer NOT NULL DEFAULT 0 CHECK (fit_score >= 0 AND fit_score <= 100),
  rationale text NOT NULL DEFAULT '',
  agent_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connection_id, job_id)
);

CREATE INDEX IF NOT EXISTS referral_match_suggestions_user_idx
  ON public.referral_match_suggestions (user_id, created_at DESC);

ALTER TABLE public.referral_match_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own referral match suggestions" ON public.referral_match_suggestions;
CREATE POLICY "Users view own referral match suggestions"
  ON public.referral_match_suggestions FOR SELECT
  USING (auth.uid() = user_id);

-- Inserts from edge function use service role (bypass RLS)

-- ---------------------------------------------------------------------------
-- Referral code generation + backfill
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._generate_referral_code_candidate()
RETURNS text
LANGUAGE sql
AS $$
  SELECT lower(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 10));
$$;

CREATE OR REPLACE FUNCTION public.ensure_profile_referral_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cand text;
  tries int := 0;
BEGIN
  IF NEW.referral_code IS NOT NULL AND length(trim(NEW.referral_code)) > 0 THEN
    RETURN NEW;
  END IF;
  LOOP
    cand := public._generate_referral_code_candidate();
    tries := tries + 1;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE lower(p.referral_code) = lower(cand)
    );
    EXIT WHEN tries > 50;
  END LOOP;
  IF tries > 50 THEN
    cand := replace(gen_random_uuid()::text, '-', '');
  END IF;
  NEW.referral_code := cand;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_referral_code ON public.profiles;
CREATE TRIGGER trg_profiles_referral_code
  BEFORE INSERT OR UPDATE OF referral_code ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_profile_referral_code();

-- Backfill referral_code for existing profiles
DO $$
DECLARE
  r RECORD;
  cand text;
  safety int;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    IF EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = r.id AND p.referral_code IS NOT NULL AND trim(p.referral_code) <> ''
    ) THEN
      CONTINUE;
    END IF;
    safety := 0;
    LOOP
      cand := public._generate_referral_code_candidate();
      safety := safety + 1;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.referral_code) = lower(cand));
      EXIT WHEN safety > 100;
    END LOOP;
    IF safety > 100 THEN
      cand := replace(gen_random_uuid()::text, '-', '');
    END IF;
    UPDATE public.profiles SET referral_code = cand WHERE id = r.id;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Funnel sync from applications
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.referral_stage_rank(p_stage text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_stage
    WHEN 'signed_up' THEN 1
    WHEN 'application_started' THEN 2
    WHEN 'application_completed' THEN 3
    WHEN 'offer_extended' THEN 4
    WHEN 'hired' THEN 5
    WHEN 'paid' THEN 6
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.sync_referral_funnel_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_stage text;
  cur_stage text;
  cur_rank int;
  new_rank int;
BEGIN
  SELECT funnel_stage INTO cur_stage
  FROM public.referrals
  WHERE referred_user_id = p_user_id
  LIMIT 1;

  IF cur_stage IS NULL THEN
    RETURN;
  END IF;

  -- Do not auto-change manual late stages
  IF cur_stage IN ('hired', 'paid') THEN
    RETURN;
  END IF;

  new_stage := 'signed_up';

  IF EXISTS (SELECT 1 FROM public.applications a WHERE a.user_id = p_user_id LIMIT 1) THEN
    new_stage := 'application_started';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.user_id = p_user_id
      AND a.canonical_stage IS NOT NULL
      AND a.canonical_stage IN ('submitted', 'interview', 'offer', 'rejected', 'withdrawn', 'failed')
  ) THEN
    new_stage := 'application_completed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.user_id = p_user_id
      AND (a.canonical_stage = 'offer' OR a.status = 'Offer')
  ) THEN
    new_stage := 'offer_extended';
  END IF;

  cur_rank := public.referral_stage_rank(cur_stage);
  new_rank := public.referral_stage_rank(new_stage);

  IF new_rank > cur_rank THEN
    UPDATE public.referrals
    SET funnel_stage = new_stage, updated_at = now()
    WHERE referred_user_id = p_user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_applications_sync_referral()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.sync_referral_funnel_for_user(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_applications_referral_sync ON public.applications;
CREATE TRIGGER trg_applications_referral_sync
  AFTER INSERT OR UPDATE OF canonical_stage, status ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_applications_sync_referral();

-- ---------------------------------------------------------------------------
-- Claim attribution (signup / first dashboard load)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_referral_attribution(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid uuid := auth.uid();
  ref_profile public.profiles%ROWTYPE;
  ref_email text;
  today_cnt int;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_code');
  END IF;

  SELECT * INTO ref_profile
  FROM public.profiles
  WHERE lower(trim(referral_code)) = lower(trim(p_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  IF ref_profile.id = uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_referral');
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND referred_by_user_id IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_attributed');
  END IF;

  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_user_id = uid) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'referral_row_exists');
  END IF;

  SELECT COUNT(*) INTO today_cnt
  FROM public.referrals r
  WHERE r.referrer_user_id = ref_profile.id
    AND r.signed_up_at::date = (now() AT TIME ZONE 'utc')::date;

  IF today_cnt >= 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'referrer_daily_cap');
  END IF;

  UPDATE public.profiles
  SET referred_by_user_id = ref_profile.id
  WHERE id = uid
    AND referred_by_user_id IS NULL;

  SELECT email INTO ref_email FROM auth.users WHERE id = uid LIMIT 1;

  INSERT INTO public.referrals (referrer_user_id, referred_user_id, referred_email, funnel_stage)
  VALUES (ref_profile.id, uid, ref_email, 'signed_up')
  ON CONFLICT (referred_user_id) DO NOTHING;

  PERFORM public.sync_referral_funnel_for_user(uid);

  RETURN jsonb_build_object('ok', true, 'referrer_id', ref_profile.id);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_referral_attribution(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_referral_attribution(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_referral_attribution(text) TO service_role;

REVOKE ALL ON FUNCTION public.sync_referral_funnel_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_referral_funnel_for_user(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Dashboard stats
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_referral_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  today_cnt int;
  funnel jsonb;
  code text;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT referral_code INTO code FROM public.profiles WHERE id = uid;

  SELECT COUNT(*) INTO today_cnt
  FROM public.referrals r
  WHERE r.referrer_user_id = uid
    AND r.signed_up_at::date = (now() AT TIME ZONE 'utc')::date;

  SELECT COALESCE(jsonb_object_agg(stage, cnt), '{}'::jsonb) INTO funnel
  FROM (
    SELECT funnel_stage AS stage, COUNT(*)::int AS cnt
    FROM public.referrals
    WHERE referrer_user_id = uid
    GROUP BY funnel_stage
  ) s;

  RETURN jsonb_build_object(
    'referral_code', code,
    'referrals_today', today_cnt,
    'referrals_today_cap', 100,
    'funnel', funnel
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_referral_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_referral_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_stats() TO service_role;

-- ---------------------------------------------------------------------------
-- Referrer can mark hired / paid (manual settlement)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.referrer_update_funnel_stage(
  p_referred_user_id uuid,
  p_stage text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  row_count int;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  IF p_stage IS NULL OR p_stage NOT IN ('hired', 'paid') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_stage');
  END IF;

  UPDATE public.referrals
  SET funnel_stage = p_stage, updated_at = now()
  WHERE referrer_user_id = uid
    AND referred_user_id = p_referred_user_id;

  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.referrer_update_funnel_stage(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referrer_update_funnel_stage(uuid, text) TO authenticated;
