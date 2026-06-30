-- =============================================================================
-- Phase 0 — Balance Snapshot & Pre-Remediation Audit Capture
-- =============================================================================
-- Creates a lightweight snapshot of:
--   1. Current user credit balances (for rollback reference)
--   2. Distribution of transaction type values (legacy vs canonical)
--
-- This migration is READ-ONLY with respect to live data.
-- It creates an audit table and populates it once with the pre-remediation state.
-- Safe to run multiple times — uses INSERT ... WHERE NOT EXISTS.
-- =============================================================================

-- ── 1. Snapshot table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.credit_balance_snapshots (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_label  text        NOT NULL,
    user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    balance         integer     NOT NULL,
    lifetime_earned integer     NOT NULL DEFAULT 0,
    lifetime_spent  integer     NOT NULL DEFAULT 0,
    snapshotted_at  timestamptz NOT NULL DEFAULT now(),
    metadata        jsonb       NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_credit_balance_snapshots_user_id
    ON public.credit_balance_snapshots (user_id);

CREATE INDEX IF NOT EXISTS idx_credit_balance_snapshots_label
    ON public.credit_balance_snapshots (snapshot_label);

-- RLS: only service-role and admins can read snapshots
ALTER TABLE public.credit_balance_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage balance snapshots"
    ON public.credit_balance_snapshots;

CREATE POLICY "Admins can manage balance snapshots"
    ON public.credit_balance_snapshots
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

-- ── 2. Transaction type audit table ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.credit_type_audit (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_label  text        NOT NULL,
    tx_type         text        NOT NULL,
    row_count       bigint      NOT NULL,
    total_amount    bigint      NOT NULL,
    snapshotted_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_type_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage type audit" ON public.credit_type_audit;

CREATE POLICY "Admins can manage type audit"
    ON public.credit_type_audit
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

-- ── 3. Populate pre-remediation balance snapshot (idempotent) ────────────────

DO $$
BEGIN
    -- Only insert if this label doesn't already exist
    IF NOT EXISTS (
        SELECT 1 FROM public.credit_balance_snapshots
        WHERE snapshot_label = 'pre_remediation_20260623'
        LIMIT 1
    ) THEN
        INSERT INTO public.credit_balance_snapshots (
            snapshot_label,
            user_id,
            balance,
            lifetime_earned,
            lifetime_spent,
            metadata
        )
        SELECT
            'pre_remediation_20260623',
            uc.user_id,
            COALESCE(uc.balance, 0),
            COALESCE(uc.lifetime_earned, 0),
            COALESCE(uc.lifetime_spent, 0),
            jsonb_build_object(
                'note', 'Captured before V2 credit ledger migration',
                'branch', 'fix/credit-ledger-search-visibility'
            )
        FROM public.user_credits uc;

        RAISE NOTICE '[Phase 0] Balance snapshot written: % rows',
            (SELECT COUNT(*) FROM public.credit_balance_snapshots
             WHERE snapshot_label = 'pre_remediation_20260623');
    ELSE
        RAISE NOTICE '[Phase 0] Balance snapshot already exists — skipping.';
    END IF;
END;
$$;

-- ── 4. Populate transaction type distribution audit (idempotent) ─────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.credit_type_audit
        WHERE snapshot_label = 'pre_remediation_20260623'
        LIMIT 1
    ) THEN
        INSERT INTO public.credit_type_audit (
            snapshot_label,
            tx_type,
            row_count,
            total_amount
        )
        SELECT
            'pre_remediation_20260623',
            COALESCE(ct.transaction_type, '(null)') AS tx_type,
            COUNT(*)                    AS row_count,
            SUM(ct.amount)              AS total_amount
        FROM public.credit_transactions ct
        GROUP BY ct.transaction_type;

        RAISE NOTICE '[Phase 0] Transaction type audit written: % type buckets',
            (SELECT COUNT(*) FROM public.credit_type_audit
             WHERE snapshot_label = 'pre_remediation_20260623');
    ELSE
        RAISE NOTICE '[Phase 0] Type audit already exists — skipping.';
    END IF;
END;
$$;

-- ── 5. Helper: compare a later snapshot vs pre-remediation ───────────────────
-- Usage: SELECT * FROM public.credit_balance_drift('post_v2_ledger_20260624');

CREATE OR REPLACE FUNCTION public.credit_balance_drift(p_compare_label text)
RETURNS TABLE (
    user_id         uuid,
    balance_before  integer,
    balance_after   integer,
    drift           integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT
        b.user_id,
        b.balance  AS balance_before,
        a.balance  AS balance_after,
        a.balance - b.balance AS drift
    FROM public.credit_balance_snapshots b
    JOIN public.credit_balance_snapshots a
        ON a.user_id = b.user_id
       AND a.snapshot_label = p_compare_label
    WHERE b.snapshot_label = 'pre_remediation_20260623'
      AND a.balance <> b.balance   -- only rows with drift
    ORDER BY ABS(a.balance - b.balance) DESC;
$$;

COMMENT ON FUNCTION public.credit_balance_drift(text) IS
    'Returns users whose credit balance changed between the pre-remediation snapshot and a named later snapshot.';
