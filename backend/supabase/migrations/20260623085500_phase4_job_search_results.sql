-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 4 · job_search_results
-- Migration: 20260623085500_phase4_job_search_results.sql
--
-- Creates the canonical job_search_results table. Every job discovered during
-- a search run is linked here with billing eligibility flags.
-- settle_search_run_v2 (Phase 3) reads from this table to calculate the actual
-- credit charge for a completed run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.job_search_results (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which search run produced this result
  agent_run_id    UUID          NOT NULL
                                REFERENCES public.job_search_runs(agent_run_id)
                                ON DELETE CASCADE,

  -- Redundant denormalization for fast per-user queries without joining
  user_id         UUID          NOT NULL
                                REFERENCES auth.users(id)
                                ON DELETE CASCADE,

  -- The canonical job row this result links to
  job_id          UUID          NOT NULL
                                REFERENCES public.jobs(id)
                                ON DELETE CASCADE,

  -- Position in the ranked result list (1-based; NULL = unranked)
  rank            INTEGER       NULL CHECK (rank > 0),

  -- ── Billing eligibility flags (set during ingestion) ──────────────────────

  -- TRUE if the job should be visible to the user in the dashboard.
  -- A non-displayable result is hidden (e.g. spam filter, quality floor).
  displayable     BOOLEAN       NOT NULL DEFAULT true,

  -- TRUE if this result is a candidate for credit billing.
  -- displayable must also be true for a result to be billed.
  billable        BOOLEAN       NOT NULL DEFAULT false,

  -- TRUE if this job has never been linked to this user before this run.
  -- Returning the same job to the same user is not billable.
  is_new_to_user  BOOLEAN       NOT NULL DEFAULT false,

  -- If not billable, why? (e.g. "duplicate", "below_quality_floor", "apply_url_missing")
  duplicate_reason TEXT         NULL,

  -- ── Timestamps ────────────────────────────────────────────────────────────
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.job_search_results IS
  'Run-linked job result records. One row per (agent_run_id, job_id) pair. '
  'settle_search_run_v2 counts rows WHERE displayable AND billable AND is_new_to_user '
  'to compute the actual credit charge. Never queried using raw_data JSONB.';

-- ── Uniqueness constraint ─────────────────────────────────────────────────────
-- A single run cannot contain the same job twice.

ALTER TABLE public.job_search_results
  DROP CONSTRAINT IF EXISTS job_search_results_run_job_unique;

ALTER TABLE public.job_search_results
  ADD CONSTRAINT job_search_results_run_job_unique
  UNIQUE (agent_run_id, job_id);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Primary access pattern: "give me all results for this run in rank order"
CREATE INDEX IF NOT EXISTS job_search_results_run_idx
  ON public.job_search_results (agent_run_id, rank NULLS LAST);

-- Per-user history queries
CREATE INDEX IF NOT EXISTS job_search_results_user_idx
  ON public.job_search_results (user_id, created_at DESC);

-- Settlement query index: counting billable rows
CREATE INDEX IF NOT EXISTS job_search_results_billing_idx
  ON public.job_search_results (agent_run_id, displayable, billable, is_new_to_user)
  WHERE displayable = true AND billable = true AND is_new_to_user = true;

-- ── Row-Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.job_search_results ENABLE ROW LEVEL SECURITY;

-- Users can only read their own results
DROP POLICY IF EXISTS job_search_results_user_select ON public.job_search_results;
CREATE POLICY job_search_results_user_select
  ON public.job_search_results
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role has full access (used by process-task Edge Function)
DROP POLICY IF EXISTS job_search_results_service_all ON public.job_search_results;
CREATE POLICY job_search_results_service_all
  ON public.job_search_results
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can read all results for support/debugging
DROP POLICY IF EXISTS job_search_results_admin_select ON public.job_search_results;
CREATE POLICY job_search_results_admin_select
  ON public.job_search_results
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

-- ── RPC: insert_job_search_result ─────────────────────────────────────────────
-- Called by _shared/jobs.ts during result ingestion for each discovered job.
-- Returns the row, allowing the caller to build the full result list.

CREATE OR REPLACE FUNCTION public.insert_job_search_result(
  p_agent_run_id     UUID,
  p_user_id          UUID,
  p_job_id           UUID,
  p_rank             INTEGER  DEFAULT NULL,
  p_displayable      BOOLEAN  DEFAULT true,
  p_billable         BOOLEAN  DEFAULT false,
  p_is_new_to_user   BOOLEAN  DEFAULT false,
  p_duplicate_reason TEXT     DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result job_search_results;
BEGIN
  INSERT INTO public.job_search_results (
    agent_run_id,
    user_id,
    job_id,
    rank,
    displayable,
    billable,
    is_new_to_user,
    duplicate_reason
  ) VALUES (
    p_agent_run_id,
    p_user_id,
    p_job_id,
    p_rank,
    p_displayable,
    p_billable,
    p_is_new_to_user,
    p_duplicate_reason
  )
  ON CONFLICT (agent_run_id, job_id) DO UPDATE
    SET
      rank             = COALESCE(EXCLUDED.rank, job_search_results.rank),
      displayable      = EXCLUDED.displayable,
      billable         = EXCLUDED.billable,
      is_new_to_user   = EXCLUDED.is_new_to_user,
      duplicate_reason = EXCLUDED.duplicate_reason
  RETURNING * INTO v_result;

  RETURN jsonb_build_object(
    'id',               v_result.id,
    'agent_run_id',     v_result.agent_run_id,
    'job_id',           v_result.job_id,
    'rank',             v_result.rank,
    'displayable',      v_result.displayable,
    'billable',         v_result.billable,
    'is_new_to_user',   v_result.is_new_to_user
  );
END;
$$;

COMMENT ON FUNCTION public.insert_job_search_result IS
  'Idempotent writer for job_search_results. ON CONFLICT updates billing flags '
  'so that re-runs/retries do not create duplicate billing rows.';

GRANT EXECUTE ON FUNCTION public.insert_job_search_result TO authenticated, service_role;

-- ── RPC: get_job_search_results_for_run ──────────────────────────────────────
-- Frontend uses this to fetch all results for a completed run by agent_run_id.
-- Includes job data via join so the frontend doesn't need a second query.

CREATE OR REPLACE FUNCTION public.get_job_search_results_for_run(
  p_agent_run_id UUID
)
RETURNS TABLE (
  result_id        UUID,
  job_id           UUID,
  rank             INTEGER,
  displayable      BOOLEAN,
  is_new_to_user   BOOLEAN,
  title            TEXT,
  company          TEXT,
  location         TEXT,
  apply_url        TEXT,
  description      TEXT,
  salary_min       INTEGER,
  salary_max       INTEGER,
  salary_currency  TEXT,
  posted_at        TIMESTAMPTZ,
  source_kind      TEXT,
  lead_quality_score NUMERIC,
  created_at       TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- RLS: Only the run owner or admins may view results
  IF NOT EXISTS (
    SELECT 1 FROM public.job_search_runs jsr
    WHERE jsr.agent_run_id = p_agent_run_id
      AND (
        jsr.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'super_admin')
        )
      )
  ) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    jsr2.id           AS result_id,
    jsr2.job_id,
    jsr2.rank,
    jsr2.displayable,
    jsr2.is_new_to_user,
    j.title,
    j.company,
    j.location,
    j.apply_url,
    j.description,
    j.salary_min,
    j.salary_max,
    j.salary_currency,
    j.posted_at,
    j.source_kind::TEXT,
    j.lead_quality_score,
    jsr2.created_at
  FROM public.job_search_results jsr2
  JOIN public.jobs j ON j.id = jsr2.job_id
  WHERE jsr2.agent_run_id = p_agent_run_id
    AND jsr2.displayable = true
  ORDER BY jsr2.rank NULLS LAST, jsr2.created_at ASC;
END;
$$;

COMMENT ON FUNCTION public.get_job_search_results_for_run IS
  'Returns all displayable job results for a completed search run. '
  'Caller must own the run (or be an admin). Used by the frontend dashboard '
  'to replace JSONB-based raw_data.discovery filter queries.';

GRANT EXECUTE ON FUNCTION public.get_job_search_results_for_run TO authenticated, service_role;

-- ── Update settle_search_run_v2 to read from job_search_results ──────────────
-- The Phase 3 implementation of settle_search_run_v2 counted billable rows from
-- an inline subquery. This patch version replaces the placeholder logic with the
-- real query against job_search_results.
--
-- NOTE: settle_search_run_v2 was created in 20260623084000_phase3_billing_gateway_rpcs.sql.
-- We replace only the body here — the signature is identical.

CREATE OR REPLACE FUNCTION public.settle_search_run_v2(
  p_agent_run_id              UUID,
  p_settlement_idempotency_key TEXT,
  p_status                    TEXT   DEFAULT 'completed',
  p_metadata                  JSONB  DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold              credit_holds;
  v_balance           credit_balances;
  v_billable_count    INTEGER;
  v_actual_cost       INTEGER;
  v_unused_amount     INTEGER;
  v_capture_entry_id  UUID;
  v_release_entry_id  UUID;
  v_run               job_search_runs;
BEGIN
  -- ── 1. Resolve the search run ──────────────────────────────────────────────
  SELECT * INTO v_run
  FROM public.job_search_runs
  WHERE agent_run_id = p_agent_run_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Graceful degradation: if the run record doesn't exist yet (legacy path),
    -- fall back to the legacy settle_run_credits behaviour.
    RETURN jsonb_build_object(
      'success', false,
      'error', 'job_search_run_not_found',
      'agent_run_id', p_agent_run_id
    );
  END IF;

  IF v_run.status IN ('settled', 'cancelled') THEN
    RETURN jsonb_build_object(
      'success',          true,
      'idempotent',       true,
      'agent_run_id',     p_agent_run_id,
      'status',           v_run.status
    );
  END IF;

  -- ── 2. Resolve and lock the credit hold ───────────────────────────────────
  SELECT * INTO v_hold
  FROM public.credit_holds
  WHERE id = v_run.hold_id
  FOR UPDATE;

  -- If no hold is linked (e.g. legacy path or free search), just mark settled
  IF NOT FOUND THEN
    UPDATE public.job_search_runs
    SET status = 'settled', settled_at = now()
    WHERE agent_run_id = p_agent_run_id;

    RETURN jsonb_build_object(
      'success',          true,
      'agent_run_id',     p_agent_run_id,
      'status',           'settled',
      'hold_found',       false,
      'billable_results', 0,
      'actual_cost',      0
    );
  END IF;

  -- Idempotency guard: already settled
  IF v_hold.status IN ('settled', 'released', 'expired', 'cancelled') THEN
    RETURN jsonb_build_object(
      'success',    true,
      'idempotent', true,
      'hold_id',    v_hold.id,
      'hold_status',v_hold.status
    );
  END IF;

  -- ── 3. Count billable results from job_search_results ────────────────────
  -- CRITICAL RULE: The database determines the actual cost from verified
  -- result rows. The caller never supplies a credit amount.
  SELECT COUNT(*)::INTEGER INTO v_billable_count
  FROM public.job_search_results jsr
  WHERE jsr.agent_run_id = p_agent_run_id
    AND jsr.displayable   = true
    AND jsr.billable      = true
    AND jsr.is_new_to_user = true;

  -- On failure, charge nothing and return all held credits
  IF p_status = 'failed' THEN
    v_billable_count := 0;
  END IF;

  -- ── 4. Calculate settlement amounts ───────────────────────────────────────
  v_actual_cost    := LEAST(v_billable_count, v_hold.initial_amount);
  v_unused_amount  := v_hold.initial_amount - v_actual_cost;

  -- ── 5. Lock user balance ──────────────────────────────────────────────────
  SELECT * INTO v_balance
  FROM public.credit_balances
  WHERE user_id = v_hold.user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'credit_balances row not found for user %', v_hold.user_id
      USING ERRCODE = 'P0002';
  END IF;

  -- ── 6. Capture entry (deduct from reserved) ───────────────────────────────
  IF v_actual_cost > 0 THEN
    INSERT INTO public.credit_ledger_entries (
      id,
      user_id,
      hold_id,
      entry_type,
      available_delta,
      reserved_delta,
      reference_type,
      reference_id,
      idempotency_key,
      metadata
    ) VALUES (
      gen_random_uuid(),
      v_hold.user_id,
      v_hold.id,
      'capture',
      0,                        -- capture reduces reserved, not available
      -v_actual_cost,
      'agent_run',
      p_agent_run_id::TEXT,
      p_settlement_idempotency_key || ':capture',
      jsonb_build_object(
        'billable_result_count', v_billable_count,
        'actual_cost',           v_actual_cost,
        'run_status',            p_status
      ) || COALESCE(p_metadata, '{}')
    )
    ON CONFLICT (user_id, idempotency_key) DO NOTHING
    RETURNING id INTO v_capture_entry_id;
  END IF;

  -- ── 7. Release entry (return unused credits to available) ─────────────────
  IF v_unused_amount > 0 THEN
    INSERT INTO public.credit_ledger_entries (
      id,
      user_id,
      hold_id,
      entry_type,
      available_delta,
      reserved_delta,
      reference_type,
      reference_id,
      idempotency_key,
      metadata
    ) VALUES (
      gen_random_uuid(),
      v_hold.user_id,
      v_hold.id,
      'release',
      v_unused_amount,          -- unused credits return to available
      -v_unused_amount,         -- and leave reserved
      'agent_run',
      p_agent_run_id::TEXT,
      p_settlement_idempotency_key || ':release',
      jsonb_build_object(
        'unused_amount', v_unused_amount,
        'run_status',    p_status
      )
    )
    ON CONFLICT (user_id, idempotency_key) DO NOTHING
    RETURNING id INTO v_release_entry_id;
  END IF;

  -- ── 8. Update credit_balances ─────────────────────────────────────────────
  UPDATE public.credit_balances
  SET
    reserved_credits  = GREATEST(0, reserved_credits - v_hold.initial_amount),
    available_credits = available_credits + v_unused_amount,
    version           = version + 1,
    updated_at        = now()
  WHERE user_id = v_hold.user_id;

  -- ── 9. Settle the hold ────────────────────────────────────────────────────
  UPDATE public.credit_holds
  SET
    status                      = 'settled',
    captured_amount             = v_actual_cost,
    released_amount             = v_unused_amount,
    settlement_idempotency_key  = p_settlement_idempotency_key,
    settled_at                  = now(),
    updated_at                  = now(),
    metadata = metadata || jsonb_build_object(
      'settled_via',           'settle_search_run_v2',
      'billable_result_count', v_billable_count,
      'run_status',            p_status
    ) || COALESCE(p_metadata, '{}')
  WHERE id = v_hold.id;

  -- ── 10. Mark the search run settled ──────────────────────────────────────
  UPDATE public.job_search_runs
  SET
    status     = 'settled',
    settled_at = now(),
    updated_at = now()
  WHERE agent_run_id = p_agent_run_id;

  -- ── 11. Return settlement receipt ─────────────────────────────────────────
  RETURN jsonb_build_object(
    'success',            true,
    'agent_run_id',       p_agent_run_id,
    'hold_id',            v_hold.id,
    'billable_results',   v_billable_count,
    'actual_cost',        v_actual_cost,
    'unused_amount',      v_unused_amount,
    'run_status',         p_status,
    'capture_entry_id',   v_capture_entry_id,
    'release_entry_id',   v_release_entry_id
  );
END;
$$;

COMMENT ON FUNCTION public.settle_search_run_v2 IS
  'Phase 4 final version: counts billable results from job_search_results table '
  '(displayable AND billable AND is_new_to_user) to calculate actual credit cost. '
  'Never trusts a client-supplied credit amount.';

GRANT EXECUTE ON FUNCTION public.settle_search_run_v2 TO service_role;
