-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 4 · job_search_runs
-- Migration: 20260623085000_phase4_job_search_runs.sql
--
-- Creates the canonical job_search_runs table. Every call to jobs-search that
-- successfully reserves credits must write one row here before the background
-- task is dispatched. The backend is the only authoritative source of these
-- records — they are never client-supplied.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.job_search_runs (
  -- Primary key: reuses the agent_runs primary key so 1-to-1 relationship is
  -- enforced without an extra column.
  agent_run_id        UUID          PRIMARY KEY
                                    REFERENCES public.agent_runs(id)
                                    ON DELETE CASCADE,

  -- The authenticated user who initiated this search.
  user_id             UUID          NOT NULL
                                    REFERENCES auth.users(id)
                                    ON DELETE CASCADE,

  -- Raw values as received from the client request body (before normalization).
  original_query      TEXT          NOT NULL,
  raw_location        TEXT          NOT NULL DEFAULT '',

  -- Canonical/normalized values produced by the search-normalization module.
  normalized_query    TEXT          NOT NULL,

  -- Scope produced by normalizeSearchScope():  country | city | remote | global
  location_scope      TEXT          NOT NULL
                                    CHECK (location_scope IN ('country','city','remote','global')),

  -- Canonical location key (e.g. "NG", "NG:lagos", "remote", "global")
  location_key        TEXT          NULL,

  -- ISO 3166-1 alpha-2 country code (e.g. "NG", "US", "GB")
  country_code        TEXT          NULL,

  -- Resolved city name when scope = 'city'
  city                TEXT          NULL,

  -- Human-friendly display location (e.g. "Lagos, Nigeria", "Remote")
  display_location    TEXT          NULL,

  -- SHA-256 fingerprint = SHA256(normalized_query + "|" + scope + "|" + location_key)
  -- Allows efficient deduplication / repeat-search detection.
  search_fingerprint  TEXT          NOT NULL,

  -- Credit reservation context
  hold_id             UUID          NULL
                                    REFERENCES public.credit_holds(id)
                                    ON DELETE SET NULL,

  estimated_credits   INTEGER       NOT NULL DEFAULT 0
                                    CHECK (estimated_credits >= 0),

  -- Lifecycle
  status              TEXT          NOT NULL DEFAULT 'running'
                                    CHECK (status IN (
                                      'running',
                                      'completed',
                                      'failed',
                                      'settled',
                                      'cancelled'
                                    )),

  settled_at          TIMESTAMPTZ   NULL,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.job_search_runs IS
  'Canonical record of every job-search agent run, including the normalised '
  'search scope. Written by jobs-search immediately after credit reservation. '
  'Billing settlement reads from job_search_results linked to this run.';

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Fast "user's recent searches" listing
CREATE INDEX IF NOT EXISTS job_search_runs_user_created_idx
  ON public.job_search_runs (user_id, created_at DESC);

-- Fingerprint index allows repeat-search detection without scanning all runs
CREATE INDEX IF NOT EXISTS job_search_runs_fingerprint_idx
  ON public.job_search_runs (user_id, search_fingerprint);

-- Status filter for background settlement worker
CREATE INDEX IF NOT EXISTS job_search_runs_status_idx
  ON public.job_search_runs (status)
  WHERE status IN ('running', 'failed');

-- ── updated_at auto-maintenance ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_set_updated_at_job_search_runs()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_search_runs_updated_at ON public.job_search_runs;

CREATE TRIGGER trg_job_search_runs_updated_at
  BEFORE UPDATE ON public.job_search_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_set_updated_at_job_search_runs();

-- ── Row-Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.job_search_runs ENABLE ROW LEVEL SECURITY;

-- Users can only read their own search runs
DROP POLICY IF EXISTS job_search_runs_user_select ON public.job_search_runs;
CREATE POLICY job_search_runs_user_select
  ON public.job_search_runs
  FOR SELECT
  USING (auth.uid() = user_id);

-- No direct INSERT / UPDATE / DELETE from client — service_role only
-- (The Edge Function uses the service_role key to insert.)
DROP POLICY IF EXISTS job_search_runs_service_all ON public.job_search_runs;
CREATE POLICY job_search_runs_service_all
  ON public.job_search_runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can read all runs for support/debugging
DROP POLICY IF EXISTS job_search_runs_admin_select ON public.job_search_runs;
CREATE POLICY job_search_runs_admin_select
  ON public.job_search_runs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin')
    )
  );

-- ── Helper RPC: insert_job_search_run ─────────────────────────────────────────
-- Called by the jobs-search Edge Function immediately after credit reservation.
-- Uses SECURITY DEFINER so the service-role JWT is not required for RPC callers.

CREATE OR REPLACE FUNCTION public.insert_job_search_run(
  p_agent_run_id       UUID,
  p_user_id            UUID,
  p_original_query     TEXT,
  p_raw_location       TEXT,
  p_normalized_query   TEXT,
  p_location_scope     TEXT,
  p_location_key       TEXT,
  p_country_code       TEXT,
  p_city               TEXT,
  p_display_location   TEXT,
  p_search_fingerprint TEXT,
  p_hold_id            UUID,
  p_estimated_credits  INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run job_search_runs;
BEGIN
  -- Validate scope enum value (guard against bad caller data)
  IF p_location_scope NOT IN ('country','city','remote','global') THEN
    RAISE EXCEPTION 'Invalid location_scope: %', p_location_scope
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.job_search_runs (
    agent_run_id,
    user_id,
    original_query,
    raw_location,
    normalized_query,
    location_scope,
    location_key,
    country_code,
    city,
    display_location,
    search_fingerprint,
    hold_id,
    estimated_credits,
    status
  ) VALUES (
    p_agent_run_id,
    p_user_id,
    p_original_query,
    p_raw_location,
    p_normalized_query,
    p_location_scope,
    p_location_key,
    p_country_code,
    p_city,
    p_display_location,
    p_search_fingerprint,
    p_hold_id,
    COALESCE(p_estimated_credits, 0),
    'running'
  )
  ON CONFLICT (agent_run_id) DO UPDATE
    SET
      -- Idempotent: if the same agent_run_id is re-inserted (retry), update
      -- only mutable fields and leave status/timestamps if already settled.
      normalized_query   = EXCLUDED.normalized_query,
      location_scope     = EXCLUDED.location_scope,
      location_key       = EXCLUDED.location_key,
      country_code       = EXCLUDED.country_code,
      city               = EXCLUDED.city,
      display_location   = EXCLUDED.display_location,
      search_fingerprint = EXCLUDED.search_fingerprint,
      hold_id            = COALESCE(EXCLUDED.hold_id, job_search_runs.hold_id),
      estimated_credits  = EXCLUDED.estimated_credits,
      updated_at         = now()
  RETURNING * INTO v_run;

  RETURN jsonb_build_object(
    'success',           true,
    'agent_run_id',      v_run.agent_run_id,
    'user_id',           v_run.user_id,
    'search_fingerprint',v_run.search_fingerprint,
    'status',            v_run.status,
    'created_at',        v_run.created_at
  );
END;
$$;

COMMENT ON FUNCTION public.insert_job_search_run IS
  'Idempotent writer for job_search_runs. Called by the jobs-search Edge '
  'Function after successful credit reservation. SECURITY DEFINER so callers '
  'without service_role may invoke it through Supabase RPC.';

-- ── Grant execute to authenticated & service_role ─────────────────────────────

GRANT EXECUTE ON FUNCTION public.insert_job_search_run TO authenticated, service_role;
