-- =============================================================================
-- Phase 2 — Canonical V2 Credit Ledger Foundation
-- =============================================================================
-- Creates three new tables that form the double-entry accounting backbone:
--
--   credit_balances      -- one row per user; available + reserved sub-buckets
--   credit_holds         -- one row per active reservation (open or settled)
--   credit_ledger_entries -- append-only immutable event log of every movement
--
-- Design constraints:
--   1. credit_ledger_entries is IMMUTABLE — no UPDATE or DELETE ever.
--      A trigger enforces this at the DB level.
--   2. credit_balances.available + credit_balances.reserved = total credits.
--      A check constraint enforces neither column goes negative.
--   3. Every ledger entry records available_before/after and reserved_before/after
--      so the full balance history is reconstructible from the ledger alone.
--   4. Idempotency keys on holds and ledger entries prevent double-charges.
--   5. This migration does NOT drop or modify user_credits or credit_transactions.
--      Legacy tables remain in place; V2 runs in parallel until Phase 3 migrates
--      the billing gateway to write here exclusively.
--   6. A backfill block seeds credit_balances from existing user_credits data so
--      both tables start in sync when Phase 3 flips the billing.v2.enabled flag.
-- =============================================================================

-- ─── 1. credit_balances ──────────────────────────────────────────────────────
-- Canonical balance record. One row per user.
-- available: credits the user can spend right now
-- reserved:  credits locked by open holds (not yet settled or released)

CREATE TABLE IF NOT EXISTS public.credit_balances (
    user_id             uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    available           integer     NOT NULL DEFAULT 0,
    reserved            integer     NOT NULL DEFAULT 0,
    lifetime_earned     integer     NOT NULL DEFAULT 0,
    lifetime_spent      integer     NOT NULL DEFAULT 0,
    last_ledger_seq     bigint      NOT NULL DEFAULT 0,  -- monotonic sequence for optimistic locking
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    -- Invariant: neither bucket goes negative
    CONSTRAINT credit_balances_available_nonneg CHECK (available >= 0),
    CONSTRAINT credit_balances_reserved_nonneg  CHECK (reserved  >= 0)
);

COMMENT ON TABLE public.credit_balances IS
    'Canonical V2 user credit balance. available + reserved = total credits held. '
    'Never modified by legacy RPCs — only by V2 billing gateway functions.';

COMMENT ON COLUMN public.credit_balances.available IS
    'Credits the user can spend immediately. Decremented by holds; incremented by grants/refunds/releases.';
COMMENT ON COLUMN public.credit_balances.reserved IS
    'Credits locked by open holds. Incremented when a hold is placed; decremented when settled or released.';
COMMENT ON COLUMN public.credit_balances.last_ledger_seq IS
    'Monotonically increasing sequence number of the last ledger entry that touched this row. '
    'Used for optimistic concurrency: RPCs check this before writing to detect concurrent modifications.';

CREATE INDEX IF NOT EXISTS idx_credit_balances_updated_at
    ON public.credit_balances (updated_at DESC);

-- ─── 2. credit_holds ─────────────────────────────────────────────────────────
-- One row per reservation. Tracks the lifecycle of a credit hold:
--   pending  → reserved but not yet settled
--   settled  → final charge applied (may be less than reserved)
--   released → operation cancelled; full hold returned to available
--   expired  → hold timeout elapsed; returned to available by cron

CREATE TABLE IF NOT EXISTS public.credit_holds (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_run_id        uuid        REFERENCES public.agent_runs(id) ON DELETE SET NULL,
    amount_reserved     integer     NOT NULL CHECK (amount_reserved > 0),
    amount_settled      integer     NOT NULL DEFAULT 0 CHECK (amount_settled >= 0),
    amount_released     integer     GENERATED ALWAYS AS (amount_reserved - amount_settled) STORED,
    status              text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'settled', 'released', 'expired')),
    idempotency_key     text        UNIQUE,
    description         text,
    reference_type      text,
    reference_id        uuid,
    metadata            jsonb       NOT NULL DEFAULT '{}'::jsonb,
    expires_at          timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
    created_at          timestamptz NOT NULL DEFAULT now(),
    settled_at          timestamptz,
    released_at         timestamptz,

    -- settled_amount can't exceed reserved_amount
    CONSTRAINT credit_holds_settled_le_reserved CHECK (amount_settled <= amount_reserved)
);

COMMENT ON TABLE public.credit_holds IS
    'Tracks every open or closed credit reservation. A hold moves credits from '
    'credit_balances.available → reserved. Settlement moves them to spent. '
    'Release or expiry moves them back to available.';

CREATE INDEX IF NOT EXISTS idx_credit_holds_user_id
    ON public.credit_holds (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_holds_agent_run_id
    ON public.credit_holds (agent_run_id) WHERE agent_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_holds_status_expires
    ON public.credit_holds (status, expires_at)
    WHERE status = 'pending';  -- only pending holds need expiry scanning

-- ─── 3. credit_ledger_entries ────────────────────────────────────────────────
-- Immutable append-only double-entry ledger.
-- Every credit movement writes exactly one row here.
-- The balance at any point in time equals the sum of all entries up to that moment.

-- Entry type semantics:
--   grant       → admin/subscription credit grant          → available ↑
--   bonus       → promotional bonus                        → available ↑
--   purchase    → one-time credit pack purchase            → available ↑
--   refund      → refund of a prior charge                 → available ↑
--   reversal    → reversal of a grant (admin correction)   → available ↓
--   hold        → reservation placed                       → available ↓, reserved ↑
--   capture     → hold settled (actual spend confirmed)    → reserved ↓, lifetime_spent ↑
--   release     → hold cancelled (operation aborted)       → reserved ↓, available ↑
--   expired_hold→ hold timed out and released by cron      → reserved ↓, available ↑
--   charge      → direct debit with no prior hold          → available ↓, lifetime_spent ↑
--   adjustment  → admin correction (positive or negative)  → available ↑ or ↓

CREATE TABLE IF NOT EXISTS public.credit_ledger_entries (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    seq                 bigserial   NOT NULL,              -- global monotonic ordering
    user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entry_type          text        NOT NULL CHECK (entry_type IN (
                            'grant', 'bonus', 'purchase', 'refund', 'reversal',
                            'hold', 'capture', 'release', 'expired_hold',
                            'charge', 'adjustment'
                        )),
    -- Amount is always positive; direction is encoded in entry_type
    amount              integer     NOT NULL CHECK (amount > 0),
    -- Balance snapshots at time of entry
    available_before    integer     NOT NULL CHECK (available_before >= 0),
    available_after     integer     NOT NULL CHECK (available_after  >= 0),
    reserved_before     integer     NOT NULL CHECK (reserved_before  >= 0),
    reserved_after      integer     NOT NULL CHECK (reserved_after   >= 0),
    -- Linkage
    hold_id             uuid        REFERENCES public.credit_holds(id) ON DELETE SET NULL,
    agent_run_id        uuid        REFERENCES public.agent_runs(id)   ON DELETE SET NULL,
    -- Bridge to legacy credit_transactions (populated when a legacy write also happens)
    legacy_tx_id        uuid,
    -- Idempotency: callers must supply a key; DB rejects duplicates
    idempotency_key     text        UNIQUE,
    description         text,
    reference_type      text,
    reference_id        uuid,
    metadata            jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),

    -- Consistency checks: after-values must be reachable from before-values
    CONSTRAINT cle_available_grant_check CHECK (
        entry_type NOT IN ('grant','bonus','purchase','refund','adjustment') OR available_after >= available_before OR entry_type = 'adjustment'
    ),
    CONSTRAINT cle_available_debit_check CHECK (
        entry_type NOT IN ('hold','charge','reversal') OR available_after <= available_before
    ),
    CONSTRAINT cle_reserved_hold_check CHECK (
        entry_type != 'hold' OR reserved_after >= reserved_before
    ),
    CONSTRAINT cle_reserved_release_check CHECK (
        entry_type NOT IN ('capture','release','expired_hold') OR reserved_after <= reserved_before
    )
);

COMMENT ON TABLE public.credit_ledger_entries IS
    'Immutable append-only credit event ledger. Every credit movement writes exactly one row. '
    'No UPDATE or DELETE is ever permitted — enforced by trigger. '
    'Full balance history is reconstructible from this table alone.';

COMMENT ON COLUMN public.credit_ledger_entries.seq IS
    'Global monotonically increasing integer. Use ORDER BY seq for correct chronological replay.';
COMMENT ON COLUMN public.credit_ledger_entries.idempotency_key IS
    'Caller-supplied key that prevents duplicate entries. Must be unique per operation. '
    'Recommended format: {run_type}:{user_id}:{action}:{action_specific_hash}';

-- Indexes for common query patterns
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_ledger_seq
    ON public.credit_ledger_entries (seq);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_seq
    ON public.credit_ledger_entries (user_id, seq DESC);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_type
    ON public.credit_ledger_entries (user_id, entry_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_hold_id
    ON public.credit_ledger_entries (hold_id) WHERE hold_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_ledger_agent_run
    ON public.credit_ledger_entries (agent_run_id) WHERE agent_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_ledger_idempotency
    ON public.credit_ledger_entries (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ─── 4. Immutability trigger on credit_ledger_entries ────────────────────────
-- No UPDATE or DELETE is ever permitted on the ledger.
-- Corrections must be made as new adjustment entries.

CREATE OR REPLACE FUNCTION public.credit_ledger_immutability_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'credit_ledger_entries is immutable. Row % cannot be % — issue a new adjustment entry instead.',
        OLD.id,
        TG_OP;
END;
$$;

COMMENT ON FUNCTION public.credit_ledger_immutability_guard() IS
    'Trigger function that rejects any UPDATE or DELETE on credit_ledger_entries. '
    'All corrections must be written as new entries with entry_type = adjustment.';

DROP TRIGGER IF EXISTS trg_credit_ledger_immutable ON public.credit_ledger_entries;
CREATE TRIGGER trg_credit_ledger_immutable
    BEFORE UPDATE OR DELETE ON public.credit_ledger_entries
    FOR EACH ROW EXECUTE FUNCTION public.credit_ledger_immutability_guard();

-- ─── 5. updated_at trigger for credit_balances ───────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_balances_updated_at ON public.credit_balances;
CREATE TRIGGER trg_credit_balances_updated_at
    BEFORE UPDATE ON public.credit_balances
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── 6. Row-Level Security ────────────────────────────────────────────────────

ALTER TABLE public.credit_balances      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_holds         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger_entries ENABLE ROW LEVEL SECURITY;

-- credit_balances: users read own; service_role and admins full access
DROP POLICY IF EXISTS "Users read own credit_balances"    ON public.credit_balances;
CREATE POLICY "Users read own credit_balances"
    ON public.credit_balances FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages credit_balances" ON public.credit_balances;
CREATE POLICY "Service role manages credit_balances"
    ON public.credit_balances FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins manage credit_balances" ON public.credit_balances;
CREATE POLICY "Admins manage credit_balances"
    ON public.credit_balances FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid()
                  AND ur.role IN ('admin', 'super_admin'))
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid()
                  AND ur.role IN ('admin', 'super_admin'))
    );

-- credit_holds: users read own; service_role full; users cannot insert/update directly
DROP POLICY IF EXISTS "Users read own credit_holds" ON public.credit_holds;
CREATE POLICY "Users read own credit_holds"
    ON public.credit_holds FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages credit_holds" ON public.credit_holds;
CREATE POLICY "Service role manages credit_holds"
    ON public.credit_holds FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins read credit_holds" ON public.credit_holds;
CREATE POLICY "Admins read credit_holds"
    ON public.credit_holds FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid()
                  AND ur.role IN ('admin', 'super_admin'))
    );

-- credit_ledger_entries: users read own; nobody can INSERT via client (only SECURITY DEFINER RPCs)
DROP POLICY IF EXISTS "Users read own ledger entries" ON public.credit_ledger_entries;
CREATE POLICY "Users read own ledger entries"
    ON public.credit_ledger_entries FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages ledger entries" ON public.credit_ledger_entries;
CREATE POLICY "Service role manages ledger entries"
    ON public.credit_ledger_entries FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins read ledger entries" ON public.credit_ledger_entries;
CREATE POLICY "Admins read ledger entries"
    ON public.credit_ledger_entries FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid()
                  AND ur.role IN ('admin', 'super_admin'))
    );

-- ─── 7. Grants ───────────────────────────────────────────────────────────────

GRANT SELECT ON public.credit_balances       TO authenticated;
GRANT SELECT ON public.credit_holds          TO authenticated;
GRANT SELECT ON public.credit_ledger_entries TO authenticated;

GRANT ALL ON public.credit_balances          TO service_role;
GRANT ALL ON public.credit_holds             TO service_role;
GRANT ALL ON public.credit_ledger_entries    TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.credit_ledger_entries_seq_seq TO service_role;

-- ─── 8. Read-model view: v_credit_balance ────────────────────────────────────
-- A unified view that merges V2 credit_balances with legacy user_credits
-- so the frontend can query ONE endpoint regardless of which backend is active.
-- When billing.v2.enabled is true, the V2 row is authoritative.
-- When false, we fall back to user_credits.

CREATE OR REPLACE VIEW public.v_credit_balance AS
SELECT
    COALESCE(cb.user_id, uc.user_id)       AS user_id,
    -- Available: prefer V2; fall back to legacy balance
    COALESCE(cb.available,  uc.balance)     AS available,
    -- Reserved: V2 only; legacy has no concept
    COALESCE(cb.reserved,   0)              AS reserved,
    -- Total = available + reserved
    COALESCE(cb.available, uc.balance) + COALESCE(cb.reserved, 0) AS total,
    -- Lifetime stats: prefer V2; fall back to legacy columns
    COALESCE(cb.lifetime_earned, uc.lifetime_earned, 0) AS lifetime_earned,
    COALESCE(cb.lifetime_spent,  uc.lifetime_spent,  0) AS lifetime_spent,
    -- Which source is active
    CASE WHEN cb.user_id IS NOT NULL THEN 'v2' ELSE 'legacy' END AS source,
    COALESCE(cb.updated_at, uc.updated_at) AS updated_at
FROM public.user_credits uc
FULL OUTER JOIN public.credit_balances cb ON cb.user_id = uc.user_id;

COMMENT ON VIEW public.v_credit_balance IS
    'Unified balance view merging V2 credit_balances with legacy user_credits. '
    'Use this for all frontend balance reads. When V2 is seeded, it is authoritative.';

GRANT SELECT ON public.v_credit_balance TO authenticated, service_role;

-- ─── 9. Read-model view: v_credit_history ────────────────────────────────────
-- Unified transaction history view that merges V2 ledger entries with legacy
-- credit_transactions, ordered by time, deduplicating via legacy_tx_id.
-- Frontend credit history pages query this view.

CREATE OR REPLACE VIEW public.v_credit_history AS
-- V2 ledger entries (authoritative when present)
SELECT
    le.id,
    le.user_id,
    le.entry_type                                   AS tx_type,
    le.amount,
    le.available_before                             AS balance_before,
    le.available_after                              AS balance_after,
    le.description,
    le.reference_type,
    le.reference_id,
    le.agent_run_id,
    le.hold_id,
    le.metadata,
    le.created_at,
    'v2'                                            AS source,
    le.legacy_tx_id                                 AS linked_legacy_id
FROM public.credit_ledger_entries le

UNION ALL

-- Legacy transactions NOT already covered by a V2 entry
SELECT
    ct.id,
    ct.user_id,
    COALESCE(ct.type, 'unknown')                    AS tx_type,
    ABS(ct.amount)                                  AS amount,
    ct.balance_before,
    ct.balance_after,
    ct.description,
    ct.reference_type,
    ct.reference_id,
    ct.agent_run_id,
    NULL::uuid                                      AS hold_id,
    COALESCE(ct.metadata, '{}'::jsonb)              AS metadata,
    ct.created_at,
    'legacy'                                        AS source,
    NULL::uuid                                      AS linked_legacy_id
FROM public.credit_transactions ct
WHERE NOT EXISTS (
    -- Exclude any legacy row that is already linked to a V2 ledger entry
    SELECT 1 FROM public.credit_ledger_entries le2
    WHERE le2.legacy_tx_id = ct.id
);

COMMENT ON VIEW public.v_credit_history IS
    'Merged credit history: V2 ledger entries unioned with legacy credit_transactions '
    '(excluding rows already linked to a V2 entry). Order by created_at DESC for display.';

GRANT SELECT ON public.v_credit_history TO authenticated, service_role;

-- ─── 10. Backfill credit_balances from user_credits (idempotent) ─────────────
-- Seeds one credit_balances row per existing user so both tables start in sync.
-- Rows already present are left untouched.

DO $$
DECLARE
    v_inserted integer;
BEGIN
    INSERT INTO public.credit_balances (
        user_id,
        available,
        reserved,
        lifetime_earned,
        lifetime_spent,
        created_at,
        updated_at
    )
    SELECT
        uc.user_id,
        GREATEST(COALESCE(uc.balance, 0), 0)           AS available,
        0                                               AS reserved,
        COALESCE(uc.lifetime_earned, 0)                AS lifetime_earned,
        COALESCE(uc.lifetime_spent,  0)                AS lifetime_spent,
        COALESCE(uc.updated_at, now())                 AS created_at,
        now()                                          AS updated_at
    FROM public.user_credits uc
    WHERE NOT EXISTS (
        SELECT 1 FROM public.credit_balances cb
        WHERE cb.user_id = uc.user_id
    );

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    RAISE NOTICE '[Phase 2] credit_balances backfill: % rows seeded from user_credits.', v_inserted;
END;
$$;

-- ─── 11. Helper: get_v2_credit_balance RPC ───────────────────────────────────
-- Returns a JSON balance object safe to call from Edge Functions and the frontend.
-- Reads credit_balances when available; falls back to user_credits.

CREATE OR REPLACE FUNCTION public.get_v2_credit_balance(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row  record;
BEGIN
    -- Prefer V2
    SELECT available, reserved, lifetime_earned, lifetime_spent, updated_at
    INTO v_row
    FROM public.credit_balances
    WHERE user_id = p_user_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'available',       v_row.available,
            'reserved',        v_row.reserved,
            'total',           v_row.available + v_row.reserved,
            'lifetime_earned', v_row.lifetime_earned,
            'lifetime_spent',  v_row.lifetime_spent,
            'source',          'v2',
            'updated_at',      v_row.updated_at
        );
    END IF;

    -- Fall back to legacy
    SELECT balance, lifetime_earned, lifetime_spent, updated_at
    INTO v_row
    FROM public.user_credits
    WHERE user_id = p_user_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'available',       COALESCE(v_row.balance, 0),
            'reserved',        0,
            'total',           COALESCE(v_row.balance, 0),
            'lifetime_earned', COALESCE(v_row.lifetime_earned, 0),
            'lifetime_spent',  COALESCE(v_row.lifetime_spent,  0),
            'source',          'legacy',
            'updated_at',      v_row.updated_at
        );
    END IF;

    -- No record at all
    RETURN jsonb_build_object(
        'available',       0,
        'reserved',        0,
        'total',           0,
        'lifetime_earned', 0,
        'lifetime_spent',  0,
        'source',          'none',
        'updated_at',      null
    );
END;
$$;

COMMENT ON FUNCTION public.get_v2_credit_balance(uuid) IS
    'Returns the authoritative credit balance for a user. Prefers V2 credit_balances; '
    'falls back to legacy user_credits. Safe to call from Edge Functions.';

GRANT EXECUTE ON FUNCTION public.get_v2_credit_balance(uuid) TO authenticated, service_role;

-- ─── 12. Helper: get_v2_credit_history RPC ───────────────────────────────────
-- Returns paginated credit history from v_credit_history for a given user.

CREATE OR REPLACE FUNCTION public.get_v2_credit_history(
    p_user_id  uuid,
    p_limit    integer DEFAULT 50,
    p_offset   integer DEFAULT 0
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
    -- Enforce caller can only fetch their own history (unless admin/service)
    IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('admin', 'super_admin')
        ) THEN
            RAISE EXCEPTION 'Access denied: you may only view your own credit history.';
        END IF;
    END IF;

    SELECT COUNT(*) INTO v_total
    FROM public.v_credit_history
    WHERE user_id = p_user_id;

    SELECT jsonb_agg(row_to_json(h.*) ORDER BY h.created_at DESC)
    INTO v_rows
    FROM (
        SELECT *
        FROM public.v_credit_history
        WHERE user_id = p_user_id
        ORDER BY created_at DESC
        LIMIT  p_limit
        OFFSET p_offset
    ) h;

    RETURN jsonb_build_object(
        'data',   COALESCE(v_rows, '[]'::jsonb),
        'total',  v_total,
        'limit',  p_limit,
        'offset', p_offset
    );
END;
$$;

COMMENT ON FUNCTION public.get_v2_credit_history(uuid, integer, integer) IS
    'Returns paginated credit history from v_credit_history. Merges V2 ledger '
    'entries and legacy credit_transactions with access-control enforcement.';

GRANT EXECUTE ON FUNCTION public.get_v2_credit_history(uuid, integer, integer)
    TO authenticated, service_role;

-- ─── 13. Post-migration snapshot (idempotent) ─────────────────────────────────
-- Capture a post-backfill balance snapshot so we can verify zero drift later.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.credit_balance_snapshots
        WHERE snapshot_label = 'post_v2_seed_20260623'
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
            'post_v2_seed_20260623',
            cb.user_id,
            cb.available,
            cb.lifetime_earned,
            cb.lifetime_spent,
            jsonb_build_object('note', 'Captured after V2 credit_balances backfill')
        FROM public.credit_balances cb;

        RAISE NOTICE '[Phase 2] Post-seed snapshot written: % rows.',
            (SELECT COUNT(*) FROM public.credit_balance_snapshots
             WHERE snapshot_label = 'post_v2_seed_20260623');
    ELSE
        RAISE NOTICE '[Phase 2] Post-seed snapshot already exists — skipping.';
    END IF;
END;
$$;
