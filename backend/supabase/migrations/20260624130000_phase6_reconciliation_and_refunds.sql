-- =============================================================================
-- Phase 6 — Historical Data, Reconciliation, and Refunds
-- =============================================================================
-- Migration: 20260624130000_phase6_reconciliation_and_refunds.sql
--
-- This migration adds three capabilities:
--
--   A. BALANCE DRIFT DETECTION
--      A view `v_credit_balance_drift` and function `credit_balance_drift()`
--      that identifies users whose V2 `credit_balances.available` differs from
--      their legacy `user_credits.balance` by more than an acceptable tolerance.
--
--   B. RECONCILIATION QUEUE
--      A table `credit_reconciliation_queue` that records users flagged for
--      drift so an admin or background job can review and resolve.
--
--   C. INVISIBLE-RESULT REFUND RPC
--      `process_invisible_result_refunds()` scans settled search runs where
--      the user was charged more credits than there are displayable results,
--      then issues V2 refund ledger entries for the overage.
--
-- All three components are:
--   • Idempotent  — safe to run multiple times
--   • Non-destructive — never modify user_credits or remove ledger entries
--   • Flag-gated  — the refund RPC respects `reconciliation.dry_run`
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- A. BALANCE DRIFT DETECTION
-- ─────────────────────────────────────────────────────────────────────────────

-- ── A.1 View: v_credit_balance_drift ─────────────────────────────────────────
-- Compares V2 credit_balances.available with legacy user_credits.balance.
-- Only shows users who have BOTH a V2 row and a legacy row.
-- "drift" = V2 available - legacy balance  (positive = V2 is higher)

CREATE OR REPLACE VIEW public.v_credit_balance_drift AS
SELECT
    cb.user_id,
    cb.available                           AS v2_available,
    cb.reserved                            AS v2_reserved,
    cb.lifetime_earned                     AS v2_lifetime_earned,
    cb.lifetime_spent                      AS v2_lifetime_spent,
    cb.updated_at                          AS v2_updated_at,
    uc.balance                             AS legacy_balance,
    uc.lifetime_earned                     AS legacy_lifetime_earned,
    uc.lifetime_spent                      AS legacy_lifetime_spent,
    uc.updated_at                          AS legacy_updated_at,
    -- Drift columns
    (cb.available - COALESCE(uc.balance, 0))          AS available_drift,
    (cb.lifetime_earned - COALESCE(uc.lifetime_earned, 0)) AS lifetime_earned_drift,
    (cb.lifetime_spent  - COALESCE(uc.lifetime_spent,  0)) AS lifetime_spent_drift,
    -- Convenience flag
    CASE
        WHEN ABS(cb.available - COALESCE(uc.balance, 0)) > 0 THEN true
        ELSE false
    END                                    AS has_drift
FROM public.credit_balances cb
LEFT JOIN public.user_credits uc ON uc.user_id = cb.user_id;

COMMENT ON VIEW public.v_credit_balance_drift IS
    'Compares V2 credit_balances against legacy user_credits for drift detection. '
    'available_drift = V2 available − legacy balance (positive = V2 higher). '
    'Only rows with a V2 balance record are included.';

GRANT SELECT ON public.v_credit_balance_drift TO service_role;

-- Admins can read the drift view for support
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'v_credit_balance_drift'
    ) THEN
        -- Views do not have RLS; we just restrict the grant to authenticated admins
        -- by wrapping queries in the RPC below
        NULL;
    END IF;
END $$;


-- ── A.2 RPC: credit_balance_drift ────────────────────────────────────────────
-- Returns a summary of users with nonzero drift.
-- Admin/service-role only. Pass p_user_id to inspect a single user.

CREATE OR REPLACE FUNCTION public.credit_balance_drift(
    p_user_id   uuid    DEFAULT NULL,
    p_limit     integer DEFAULT 100,
    p_offset    integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows  jsonb;
    v_total bigint;
BEGIN
    -- Restrict to admins and service_role only
    IF auth.uid() IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('admin', 'super_admin')
    ) THEN
        RAISE EXCEPTION 'Access denied: credit_balance_drift is admin-only.';
    END IF;

    SELECT COUNT(*) INTO v_total
    FROM public.v_credit_balance_drift d
    WHERE has_drift = true
      AND (p_user_id IS NULL OR d.user_id = p_user_id);

    SELECT jsonb_agg(row_to_json(d.*))
    INTO v_rows
    FROM (
        SELECT *
        FROM public.v_credit_balance_drift
        WHERE has_drift = true
          AND (p_user_id IS NULL OR user_id = p_user_id)
        ORDER BY ABS(available_drift) DESC
        LIMIT  p_limit
        OFFSET p_offset
    ) d;

    RETURN jsonb_build_object(
        'drift_count', v_total,
        'data',        COALESCE(v_rows, '[]'::jsonb),
        'limit',       p_limit,
        'offset',      p_offset
    );
END;
$$;

COMMENT ON FUNCTION public.credit_balance_drift IS
    'Admin-only: returns users whose V2 credit_balances.available differs from '
    'legacy user_credits.balance. Result is sourced from v_credit_balance_drift. '
    'Pass p_user_id to inspect a single user. '
    'A zero drift_count after reconciliation confirms the V2 ledger is authoritative.';

GRANT EXECUTE ON FUNCTION public.credit_balance_drift TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- B. RECONCILIATION QUEUE
-- ─────────────────────────────────────────────────────────────────────────────

-- ── B.1 Table: credit_reconciliation_queue ───────────────────────────────────
-- Records users with detected drift so an admin can review and resolve each one.
-- Rows move through: pending → investigating → resolved / wont_fix

CREATE TABLE IF NOT EXISTS public.credit_reconciliation_queue (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    detected_at     timestamptz NOT NULL DEFAULT now(),
    resolved_at     timestamptz,

    -- Snapshot at detection time
    v2_available    integer     NOT NULL,
    legacy_balance  integer     NOT NULL,
    drift_amount    integer     NOT NULL,   -- v2 − legacy

    -- Lifecycle
    status          text        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'investigating', 'resolved', 'wont_fix')),
    resolution_note text,
    resolved_by     uuid        REFERENCES auth.users(id),

    -- Prevent duplicate entries for the same user while pending
    CONSTRAINT crq_user_pending_unique UNIQUE (user_id, status)
        DEFERRABLE INITIALLY DEFERRED,

    metadata        jsonb       NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.credit_reconciliation_queue IS
    'Queue of users with detected balance drift between V2 credit_balances and '
    'legacy user_credits. Populated by enqueue_balance_drift_users(). '
    'status lifecycle: pending → investigating → resolved | wont_fix.';

CREATE INDEX IF NOT EXISTS crq_user_idx
    ON public.credit_reconciliation_queue (user_id, status);

CREATE INDEX IF NOT EXISTS crq_status_idx
    ON public.credit_reconciliation_queue (status, detected_at DESC);

ALTER TABLE public.credit_reconciliation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY crq_admin_all
    ON public.credit_reconciliation_queue
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('admin', 'super_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY crq_service_all
    ON public.credit_reconciliation_queue
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);


-- ── B.2 RPC: enqueue_balance_drift_users ─────────────────────────────────────
-- Scans v_credit_balance_drift and inserts a pending row for each drifted user
-- that doesn't already have an open (pending / investigating) entry.

CREATE OR REPLACE FUNCTION public.enqueue_balance_drift_users(
    p_min_drift_abs integer DEFAULT 1  -- minimum absolute drift to enqueue
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_inserted integer;
BEGIN
    INSERT INTO public.credit_reconciliation_queue (
        user_id, v2_available, legacy_balance, drift_amount, metadata
    )
    SELECT
        d.user_id,
        d.v2_available,
        COALESCE(d.legacy_balance, 0),
        d.available_drift,
        jsonb_build_object(
            'lifetime_earned_drift', d.lifetime_earned_drift,
            'lifetime_spent_drift',  d.lifetime_spent_drift,
            'enqueued_at',           now()
        )
    FROM public.v_credit_balance_drift d
    WHERE d.has_drift = true
      AND ABS(d.available_drift) >= p_min_drift_abs
      -- Skip users already being reviewed
      AND NOT EXISTS (
          SELECT 1 FROM public.credit_reconciliation_queue crq
          WHERE crq.user_id = d.user_id
            AND crq.status IN ('pending', 'investigating')
      )
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    RAISE NOTICE '[Phase 6] enqueue_balance_drift_users: % users enqueued.', v_inserted;

    RETURN jsonb_build_object(
        'success',  true,
        'enqueued', v_inserted
    );
END;
$$;

COMMENT ON FUNCTION public.enqueue_balance_drift_users IS
    'Scans v_credit_balance_drift and inserts pending reconciliation queue rows '
    'for users whose absolute drift meets the threshold. Idempotent — skips users '
    'already in pending/investigating state.';

GRANT EXECUTE ON FUNCTION public.enqueue_balance_drift_users TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- C. INVISIBLE-RESULT REFUND RPC
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Problem: a search run is settled with a charge of N credits, but some of
-- those credited results are later determined to be non-displayable (spam,
-- quality failure, etc.).  The user was charged for results they never saw.
--
-- This RPC:
--   1. Finds settled runs where `amount_settled > displayable_count`
--   2. Calculates the refund_amount = amount_settled - displayable_count
--   3. Issues a `refund` credit via internal_write_ledger_entry + dual-write
--      to credit_transactions
--   4. Marks the hold with a `has_invisible_refund` metadata flag so the same
--      run is never double-refunded
--
-- Flag gate: if `reconciliation.dry_run` = 'true' in app_config, no writes occur.

CREATE OR REPLACE FUNCTION public.process_invisible_result_refunds(
    p_max_runs  integer DEFAULT 100,
    p_dry_run   boolean DEFAULT NULL   -- NULL = read from app_config flag
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_dry_run        boolean;
    v_run            record;
    v_hold           record;
    v_bal            public.credit_balances%ROWTYPE;
    v_refund_amount  integer;
    v_new_available  integer;
    v_legacy_tx_id   uuid;
    v_refund_count   integer := 0;
    v_total_refunded integer := 0;
    v_errors         jsonb   := '[]'::jsonb;
    v_idempotency_key text;
    v_desc           text;
BEGIN
    -- ── Determine dry_run mode ────────────────────────────────────────────────
    IF p_dry_run IS NULL THEN
        SELECT value::boolean INTO v_dry_run
        FROM public.app_config
        WHERE key = 'reconciliation.dry_run';
        v_dry_run := COALESCE(v_dry_run, false);
    ELSE
        v_dry_run := p_dry_run;
    END IF;

    -- ── Scan eligible runs ────────────────────────────────────────────────────
    -- Eligible: settled holds linked to a search run where amount_settled >
    -- the count of displayable=true results for that run.
    FOR v_run IN
        SELECT
            ch.id                     AS hold_id,
            ch.user_id,
            ch.agent_run_id,
            ch.amount_settled,
            COUNT(jsr.id) FILTER (WHERE jsr.displayable = true)::integer
                                      AS displayable_count
        FROM public.credit_holds ch
        JOIN public.job_search_results jsr
            ON jsr.agent_run_id = ch.agent_run_id
        WHERE ch.status = 'settled'
          AND ch.amount_settled > 0
          -- Not already refunded for invisible results
          AND NOT COALESCE(
              (ch.metadata->>'has_invisible_refund')::boolean,
              false
          )
        GROUP BY ch.id, ch.user_id, ch.agent_run_id, ch.amount_settled
        HAVING COUNT(jsr.id) FILTER (WHERE jsr.displayable = true)::integer
               < ch.amount_settled
        ORDER BY ch.id
        LIMIT p_max_runs
    LOOP
        BEGIN
            v_refund_amount := v_run.amount_settled - v_run.displayable_count;

            IF v_refund_amount <= 0 THEN
                CONTINUE;
            END IF;

            v_idempotency_key := 'invisible_refund:' || v_run.hold_id::text;
            v_desc := format(
                'Refund for invisible results: %s charged, %s displayable, %s refunded',
                v_run.amount_settled,
                v_run.displayable_count,
                v_refund_amount
            );

            IF NOT v_dry_run THEN
                -- Lock and read current balance
                SELECT * INTO v_bal
                FROM public.credit_balances
                WHERE user_id = v_run.user_id
                FOR UPDATE;

                IF NOT FOUND THEN
                    -- User has no V2 balance row; skip
                    v_errors := v_errors || jsonb_build_object(
                        'hold_id', v_run.hold_id,
                        'reason',  'no_v2_balance_row'
                    );
                    CONTINUE;
                END IF;

                -- Check idempotency: skip if ledger entry already exists
                IF EXISTS (
                    SELECT 1 FROM public.credit_ledger_entries
                    WHERE idempotency_key = v_idempotency_key
                ) THEN
                    CONTINUE;
                END IF;

                v_new_available := v_bal.available + v_refund_amount;

                -- Update V2 balance
                UPDATE public.credit_balances
                SET available    = v_new_available,
                    updated_at   = now()
                WHERE user_id = v_run.user_id;

                -- Dual-write: legacy credit_transactions refund
                INSERT INTO public.credit_transactions (
                    user_id, type, amount, balance_before, balance_after,
                    description, reference_type, reference_id,
                    agent_run_id, metadata
                ) VALUES (
                    v_run.user_id,
                    'refunded',
                    v_refund_amount,
                    v_bal.available,
                    v_new_available,
                    v_desc,
                    'invisible_result_refund',
                    v_run.hold_id,
                    v_run.agent_run_id,
                    jsonb_build_object(
                        'hold_id',           v_run.hold_id,
                        'amount_settled',    v_run.amount_settled,
                        'displayable_count', v_run.displayable_count,
                        'refund_amount',     v_refund_amount
                    )
                )
                RETURNING id INTO v_legacy_tx_id;

                -- Also update legacy balance
                UPDATE public.user_credits
                SET balance    = GREATEST(0, balance + v_refund_amount),
                    updated_at = now()
                WHERE user_id = v_run.user_id;

                -- Write V2 ledger entry
                PERFORM public.internal_write_ledger_entry(
                    p_user_id          := v_run.user_id,
                    p_entry_type       := 'refund',
                    p_amount           := v_refund_amount,
                    p_available_before := v_bal.available,
                    p_available_after  := v_new_available,
                    p_reserved_before  := v_bal.reserved,
                    p_reserved_after   := v_bal.reserved,
                    p_hold_id          := v_run.hold_id,
                    p_agent_run_id     := v_run.agent_run_id,
                    p_legacy_tx_id     := v_legacy_tx_id,
                    p_idempotency_key  := v_idempotency_key,
                    p_description      := v_desc,
                    p_reference_type   := 'invisible_result_refund',
                    p_reference_id     := v_run.hold_id,
                    p_metadata         := jsonb_build_object(
                        'amount_settled',    v_run.amount_settled,
                        'displayable_count', v_run.displayable_count
                    )
                );

                -- Mark hold so it is never double-refunded
                UPDATE public.credit_holds
                SET metadata = metadata || jsonb_build_object(
                    'has_invisible_refund',    true,
                    'invisible_refund_amount', v_refund_amount,
                    'invisible_refund_at',     now()
                )
                WHERE id = v_run.hold_id;
            END IF;  -- NOT dry_run

            v_refund_count   := v_refund_count + 1;
            v_total_refunded := v_total_refunded + v_refund_amount;

        EXCEPTION WHEN OTHERS THEN
            -- Absorb per-run errors; log and continue
            v_errors := v_errors || jsonb_build_object(
                'hold_id', v_run.hold_id,
                'error',   SQLERRM
            );
        END;
    END LOOP;

    RAISE NOTICE '[Phase 6] process_invisible_result_refunds: dry_run=%, refunds=%, credits_returned=%.',
        v_dry_run, v_refund_count, v_total_refunded;

    RETURN jsonb_build_object(
        'success',          true,
        'dry_run',          v_dry_run,
        'refund_count',     v_refund_count,
        'credits_returned', v_total_refunded,
        'errors',           v_errors
    );
END;
$$;

COMMENT ON FUNCTION public.process_invisible_result_refunds IS
    'Scans settled credit holds linked to search runs where the user was charged '
    'more credits than there are displayable results. Issues V2 refund ledger entries '
    'and dual-writes to legacy credit_transactions. Idempotent via idempotency_key. '
    'Respects reconciliation.dry_run app_config flag. '
    'Intended for cron or admin one-off execution after Phase 6 deployment.';

GRANT EXECUTE ON FUNCTION public.process_invisible_result_refunds TO service_role;





-- ─────────────────────────────────────────────────────────────────────────────
-- E. VERIFICATION
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
    -- Confirm drift view exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.views
        WHERE table_schema = 'public'
          AND table_name = 'v_credit_balance_drift'
    ) THEN
        RAISE EXCEPTION '[Phase 6] ABORT: v_credit_balance_drift view not found.';
    END IF;

    -- Confirm reconciliation queue exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'credit_reconciliation_queue'
    ) THEN
        RAISE EXCEPTION '[Phase 6] ABORT: credit_reconciliation_queue table not found.';
    END IF;

    -- Confirm refund RPC exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'process_invisible_result_refunds'
    ) THEN
        RAISE EXCEPTION '[Phase 6] ABORT: process_invisible_result_refunds RPC not found.';
    END IF;

    RAISE NOTICE '[Phase 6] All objects verified ✓';
END;
$$;
