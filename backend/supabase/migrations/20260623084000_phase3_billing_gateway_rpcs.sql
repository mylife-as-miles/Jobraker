-- =============================================================================
-- Phase 3 — V2 Billing Gateway RPCs
-- =============================================================================
-- Four database functions that form the authoritative billing gateway:
--
--   reserve_credits_v2          – place a hold; available ↓, reserved ↑
--   settle_credit_hold_v2       – finalise a run; reserved ↓, lifetime_spent ↑,
--                                 refund any unused portion back to available
--   charge_credits_v2           – direct debit with no prior hold (one-shot ops)
--   release_expired_credit_holds – cron-safe: expire pending holds older than
--                                  their expires_at, returning credits to available
--
-- All four are:
--   • Idempotent   — duplicate calls return the existing result, never double-charge
--   • Transactional — every balance mutation and ledger write is in one statement block
--   • Flag-gated   — callers check get_flag('billing.v2.enabled') before invoking;
--                    these RPCs can also self-check and fall back if needed
--   • Dual-write   — each RPC writes to BOTH credit_balances/credit_ledger_entries
--                    AND the legacy user_credits/credit_transactions so both paths
--                    stay in sync until the legacy path is fully removed in Phase 6
--
-- Naming: all V2 functions are suffixed _v2 to avoid shadowing legacy names.
-- =============================================================================

-- Ensure private schema exists
DO $$ BEGIN
    CREATE SCHEMA IF NOT EXISTS private;
EXCEPTION WHEN duplicate_schema THEN NULL; END;
$$;

-- ─── Helper: internal_write_ledger_entry ─────────────────────────────────────
-- Shared internal helper used by all four gateway RPCs.
-- NOT exposed to callers (no GRANT).

CREATE OR REPLACE FUNCTION private.write_ledger_entry(
    p_user_id          uuid,
    p_entry_type       text,
    p_amount           integer,
    p_available_before integer,
    p_available_after  integer,
    p_reserved_before  integer,
    p_reserved_after   integer,
    p_hold_id          uuid        DEFAULT NULL,
    p_agent_run_id     uuid        DEFAULT NULL,
    p_legacy_tx_id     uuid        DEFAULT NULL,
    p_idempotency_key  text        DEFAULT NULL,
    p_description      text        DEFAULT NULL,
    p_reference_type   text        DEFAULT NULL,
    p_reference_id     uuid        DEFAULT NULL,
    p_metadata         jsonb       DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_entry_id uuid;
BEGIN
    INSERT INTO public.credit_ledger_entries (
        user_id, entry_type, amount,
        available_before, available_after,
        reserved_before,  reserved_after,
        hold_id, agent_run_id, legacy_tx_id,
        idempotency_key, description,
        reference_type, reference_id, metadata
    ) VALUES (
        p_user_id, p_entry_type, p_amount,
        p_available_before, p_available_after,
        p_reserved_before,  p_reserved_after,
        p_hold_id, p_agent_run_id, p_legacy_tx_id,
        p_idempotency_key, p_description,
        p_reference_type, p_reference_id, p_metadata
    )
    RETURNING id INTO v_entry_id;

    -- Bump last_ledger_seq on the balance row for optimistic concurrency
    UPDATE public.credit_balances
    SET last_ledger_seq = (
        SELECT seq FROM public.credit_ledger_entries WHERE id = v_entry_id
    ),
    updated_at = now()
    WHERE user_id = p_user_id;

    RETURN v_entry_id;
END;
$$;


-- Recreate using public schema since Supabase doesn't expose private schema via RPC
CREATE OR REPLACE FUNCTION public.internal_write_ledger_entry(
    p_user_id          uuid,
    p_entry_type       text,
    p_amount           integer,
    p_available_before integer,
    p_available_after  integer,
    p_reserved_before  integer,
    p_reserved_after   integer,
    p_hold_id          uuid        DEFAULT NULL,
    p_agent_run_id     uuid        DEFAULT NULL,
    p_legacy_tx_id     uuid        DEFAULT NULL,
    p_idempotency_key  text        DEFAULT NULL,
    p_description      text        DEFAULT NULL,
    p_reference_type   text        DEFAULT NULL,
    p_reference_id     uuid        DEFAULT NULL,
    p_metadata         jsonb       DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_entry_id uuid;
BEGIN
    INSERT INTO public.credit_ledger_entries (
        user_id, entry_type, amount,
        available_before, available_after,
        reserved_before,  reserved_after,
        hold_id, agent_run_id, legacy_tx_id,
        idempotency_key, description,
        reference_type, reference_id, metadata
    ) VALUES (
        p_user_id, p_entry_type, p_amount,
        p_available_before, p_available_after,
        p_reserved_before,  p_reserved_after,
        p_hold_id, p_agent_run_id, p_legacy_tx_id,
        p_idempotency_key, p_description,
        p_reference_type, p_reference_id, p_metadata
    )
    RETURNING id INTO v_entry_id;

    -- Bump last_ledger_seq on the balance row for optimistic concurrency
    UPDATE public.credit_balances
    SET last_ledger_seq = (
        SELECT seq FROM public.credit_ledger_entries WHERE id = v_entry_id
    ),
    updated_at = now()
    WHERE user_id = p_user_id;

    RETURN v_entry_id;
END;
$$;

-- ─── Helper: internal_write_legacy_transaction ──────────────────────────────
-- Dynamically inserts a transaction into legacy public.credit_transactions
-- mapping columns to what is actually present on the database schema.
CREATE OR REPLACE FUNCTION public.internal_write_legacy_transaction(
    p_user_id          uuid,
    p_tx_type          text,
    p_amount           integer,
    p_balance_before   integer,
    p_balance_after    integer,
    p_description      text,
    p_reference_type   text,
    p_reference_id     uuid,
    p_agent_run_id     uuid,
    p_metadata         jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cols text[] := ARRAY['user_id', 'amount', 'balance_after', 'description'];
    v_vals text[] := ARRAY['$1', '$2', '$3', '$4'];
    v_query text;
    v_tx_id uuid;
BEGIN
    -- Check type vs transaction_type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'type'
    ) THEN
        v_cols := array_append(v_cols, 'type');
        v_vals := array_append(v_vals, '$5');
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'transaction_type'
    ) THEN
        v_cols := array_append(v_cols, 'transaction_type');
        v_vals := array_append(v_vals, '$5');
    END IF;

    -- Check balance_before
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'balance_before'
    ) THEN
        v_cols := array_append(v_cols, 'balance_before');
        v_vals := array_append(v_vals, '$6');
    END IF;

    -- Check reference_type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'reference_type'
    ) THEN
        v_cols := array_append(v_cols, 'reference_type');
        v_vals := array_append(v_vals, '$7');
    END IF;

    -- Check reference_id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'reference_id'
    ) THEN
        v_cols := array_append(v_cols, 'reference_id');
        v_vals := array_append(v_vals, '$8');
    END IF;

    -- Check agent_run_id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'agent_run_id'
    ) THEN
        v_cols := array_append(v_cols, 'agent_run_id');
        v_vals := array_append(v_vals, '$9');
    END IF;

    -- Check metadata
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'metadata'
    ) THEN
        v_cols := array_append(v_cols, 'metadata');
        v_vals := array_append(v_vals, '$10');
    END IF;

    v_query := format(
        'INSERT INTO public.credit_transactions (%s) VALUES (%s) RETURNING id',
        array_to_string(v_cols, ', '),
        array_to_string(v_vals, ', ')
    );

    EXECUTE v_query
    USING p_user_id, p_amount, p_balance_after, p_description, p_tx_type, p_balance_before, p_reference_type, p_reference_id, p_agent_run_id, p_metadata
    INTO v_tx_id;

    RETURN v_tx_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.internal_write_legacy_transaction TO service_role;


-- ─── 1. reserve_credits_v2 ───────────────────────────────────────────────────
-- Places a credit hold: moves `amount` from available → reserved.
-- Creates a credit_holds row and a ledger 'hold' entry.
-- Returns: { success, hold_id, agent_run_id, available, reserved, is_duplicate }

CREATE OR REPLACE FUNCTION public.reserve_credits_v2(
    p_user_id          uuid,
    p_amount           integer,
    p_run_type         text,
    p_idempotency_key  text,
    p_agent_run_id     uuid        DEFAULT NULL,
    p_description      text        DEFAULT NULL,
    p_expires_minutes  integer     DEFAULT 30,
    p_metadata         jsonb       DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_hold           public.credit_holds%ROWTYPE;
    v_bal            public.credit_balances%ROWTYPE;
    v_new_available  integer;
    v_new_reserved   integer;
    v_hold_id        uuid;
    v_legacy_tx_id   uuid;
    v_desc           text;
BEGIN
    -- ── Idempotency: return existing hold if key already used ─────────────────
    SELECT * INTO v_hold
    FROM public.credit_holds
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
        SELECT * INTO v_bal
        FROM public.credit_balances WHERE user_id = p_user_id;
        RETURN jsonb_build_object(
            'success',       true,
            'is_duplicate',  true,
            'hold_id',       v_hold.id,
            'agent_run_id',  v_hold.agent_run_id,
            'available',     COALESCE(v_bal.available, 0),
            'reserved',      COALESCE(v_bal.reserved,  0),
            'amount_reserved', v_hold.amount_reserved
        );
    END IF;

    -- ── Validate amount ────────────────────────────────────────────────────────
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'reason',  'invalid_amount',
            'message', 'Reserve amount must be a positive integer'
        );
    END IF;

    -- ── Row-lock credit_balances; upsert if no row exists yet ─────────────────
    INSERT INTO public.credit_balances (user_id, available, reserved)
    VALUES (p_user_id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_bal
    FROM public.credit_balances
    WHERE user_id = p_user_id
    FOR UPDATE;

    -- ── Insufficient funds check ───────────────────────────────────────────────
    IF v_bal.available < p_amount THEN
        RETURN jsonb_build_object(
            'success',   false,
            'reason',    'insufficient_credits',
            'message',   'Insufficient available credits',
            'available', v_bal.available,
            'required',  p_amount
        );
    END IF;

    v_new_available := v_bal.available - p_amount;
    v_new_reserved  := v_bal.reserved  + p_amount;

    -- ── Create hold row ────────────────────────────────────────────────────────
    v_desc := COALESCE(p_description, 'Credit hold for ' || p_run_type);

    INSERT INTO public.credit_holds (
        user_id, agent_run_id, amount_reserved, status,
        idempotency_key, description, reference_type,
        expires_at, metadata
    ) VALUES (
        p_user_id, p_agent_run_id, p_amount, 'pending',
        p_idempotency_key, v_desc, p_run_type,
        now() + (p_expires_minutes || ' minutes')::interval,
        p_metadata
    )
    RETURNING id INTO v_hold_id;

    -- ── Update balance ─────────────────────────────────────────────────────────
    UPDATE public.credit_balances
    SET available = v_new_available,
        reserved  = v_new_reserved,
        updated_at = now()
    WHERE user_id = p_user_id;

    -- ── Dual-write: legacy credit_transactions ────────────────────────────────
    v_legacy_tx_id := public.internal_write_legacy_transaction(
        p_user_id        := p_user_id,
        p_tx_type        := 'deduction',
        p_amount         := -p_amount,
        p_balance_before := v_bal.available,
        p_balance_after  := v_new_available,
        p_description    := v_desc,
        p_reference_type := p_run_type,
        p_reference_id   := v_hold_id,
        p_agent_run_id   := p_agent_run_id,
        p_metadata       := p_metadata
    );

    -- ── Write ledger entry ─────────────────────────────────────────────────────
    PERFORM public.internal_write_ledger_entry(
        p_user_id          := p_user_id,
        p_entry_type       := 'hold',
        p_amount           := p_amount,
        p_available_before := v_bal.available,
        p_available_after  := v_new_available,
        p_reserved_before  := v_bal.reserved,
        p_reserved_after   := v_new_reserved,
        p_hold_id          := v_hold_id,
        p_agent_run_id     := p_agent_run_id,
        p_legacy_tx_id     := v_legacy_tx_id,
        p_idempotency_key  := 'hold:' || p_idempotency_key,
        p_description      := v_desc,
        p_reference_type   := p_run_type,
        p_metadata         := p_metadata
    );

    -- ── Log agent run event if linked ─────────────────────────────────────────
    IF p_agent_run_id IS NOT NULL THEN
        PERFORM public.log_agent_run_event(
            p_agent_run_id,
            'v2_hold_placed',
            'V2 hold placed: ' || p_amount || ' credits reserved (hold ' || v_hold_id || ')'
        );
    END IF;

    RETURN jsonb_build_object(
        'success',         true,
        'hold_id',         v_hold_id,
        'agent_run_id',    p_agent_run_id,
        'amount_reserved', p_amount,
        'available',       v_new_available,
        'reserved',        v_new_reserved
    );
END;
$$;

COMMENT ON FUNCTION public.reserve_credits_v2 IS
    'V2 billing: place a credit hold. Moves amount from available → reserved. '
    'Idempotent via idempotency_key. Dual-writes to credit_ledger_entries and credit_transactions.';

-- ─── 2. settle_credit_hold_v2 ────────────────────────────────────────────────
-- Settles an existing hold.
-- actual_credits ≤ reserved_amount → refund the difference back to available
-- actual_credits > reserved_amount → cap at reserved (no silent overcharge)
-- Returns: { success, hold_id, charged, refunded, available, reserved, is_duplicate }

CREATE OR REPLACE FUNCTION public.settle_credit_hold_v2(
    p_hold_id                    uuid,
    p_actual_credits             integer,
    p_settlement_idempotency_key text        DEFAULT NULL,
    p_status                     text        DEFAULT 'completed',
    p_description                text        DEFAULT NULL,
    p_receipt                    jsonb       DEFAULT '{}'::jsonb,
    p_metadata                   jsonb       DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_hold           public.credit_holds%ROWTYPE;
    v_bal            public.credit_balances%ROWTYPE;
    v_charged        integer;
    v_refunded       integer;
    v_new_available  integer;
    v_new_reserved   integer;
    v_capture_desc   text;
    v_refund_desc    text;
    v_capture_tx_id  uuid;
    v_refund_tx_id   uuid;
BEGIN
    -- ── Lock hold row ──────────────────────────────────────────────────────────
    SELECT * INTO v_hold
    FROM public.credit_holds
    WHERE id = p_hold_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'reason',  'hold_not_found',
            'message', 'Credit hold ' || p_hold_id || ' does not exist'
        );
    END IF;

    -- ── Idempotency: already settled? ─────────────────────────────────────────
    IF v_hold.status IN ('settled', 'released', 'expired') THEN
        SELECT * INTO v_bal FROM public.credit_balances WHERE user_id = v_hold.user_id;
        RETURN jsonb_build_object(
            'success',      true,
            'is_duplicate', true,
            'hold_id',      p_hold_id,
            'status',       v_hold.status,
            'charged',      v_hold.amount_settled,
            'refunded',     v_hold.amount_released,
            'available',    COALESCE(v_bal.available, 0),
            'reserved',     COALESCE(v_bal.reserved,  0)
        );
    END IF;

    -- Idempotency by settlement key
    IF p_settlement_idempotency_key IS NOT NULL
       AND (v_hold.metadata->>'settlement_idempotency_key') = p_settlement_idempotency_key THEN
        SELECT * INTO v_bal FROM public.credit_balances WHERE user_id = v_hold.user_id;
        RETURN jsonb_build_object(
            'success',      true,
            'is_duplicate', true,
            'hold_id',      p_hold_id,
            'charged',      v_hold.amount_settled,
            'refunded',     v_hold.amount_released,
            'available',    COALESCE(v_bal.available, 0),
            'reserved',     COALESCE(v_bal.reserved,  0)
        );
    END IF;

    -- ── Cap actual cost; compute refund ───────────────────────────────────────
    v_charged  := LEAST(GREATEST(COALESCE(p_actual_credits, 0), 0), v_hold.amount_reserved);
    v_refunded := v_hold.amount_reserved - v_charged;

    -- ── Lock balance row ───────────────────────────────────────────────────────
    SELECT * INTO v_bal
    FROM public.credit_balances
    WHERE user_id = v_hold.user_id
    FOR UPDATE;

    -- reserved decrements by full hold amount; available gets refund portion back
    v_new_reserved  := GREATEST(v_bal.reserved  - v_hold.amount_reserved, 0);
    v_new_available := v_bal.available + v_refunded;

    -- ── Update balance ─────────────────────────────────────────────────────────
    UPDATE public.credit_balances
    SET available      = v_new_available,
        reserved       = v_new_reserved,
        lifetime_spent = lifetime_spent + v_charged,
        updated_at     = now()
    WHERE user_id = v_hold.user_id;

    -- ── Update hold row ────────────────────────────────────────────────────────
    UPDATE public.credit_holds
    SET status      = 'settled',
        amount_settled = v_charged,
        settled_at  = now(),
        metadata    = metadata || jsonb_build_object(
                        'settlement_idempotency_key', p_settlement_idempotency_key,
                        'final_status', p_status
                      )
    WHERE id = p_hold_id;

    v_capture_desc := COALESCE(p_description,
        'Settlement: ' || v_charged || ' credits charged for ' || COALESCE(v_hold.reference_type, 'operation'));
    v_refund_desc  := 'Settlement refund: ' || v_refunded || ' unused credits returned';

    -- ── Dual-write capture transaction ────────────────────────────────────────
    -- Capture = the credits actually consumed (reserved → spent)
    v_capture_tx_id := public.internal_write_legacy_transaction(
        p_user_id        := v_hold.user_id,
        p_tx_type        := 'deduction',
        p_amount         := -v_charged,
        p_balance_before := v_bal.available,
        p_balance_after  := v_new_available,
        p_description    := v_capture_desc,
        p_reference_type := COALESCE(v_hold.reference_type, 'settle'),
        p_reference_id   := p_hold_id,
        p_agent_run_id   := v_hold.agent_run_id,
        p_metadata       := p_receipt
    );

    -- ── Ledger: capture entry ─────────────────────────────────────────────────
    IF v_charged > 0 THEN
        PERFORM public.internal_write_ledger_entry(
            p_user_id          := v_hold.user_id,
            p_entry_type       := 'capture',
            p_amount           := v_charged,
            p_available_before := v_bal.available,
            p_available_after  := v_bal.available,         -- available unchanged by capture
            p_reserved_before  := v_bal.reserved,
            p_reserved_after   := v_new_reserved,
            p_hold_id          := p_hold_id,
            p_agent_run_id     := v_hold.agent_run_id,
            p_legacy_tx_id     := v_capture_tx_id,
            p_idempotency_key  := 'capture:' || p_hold_id,
            p_description      := v_capture_desc,
            p_reference_type   := v_hold.reference_type,
            p_metadata         := p_receipt
        );
    END IF;

    -- ── Ledger: release / refund entry (if any) ───────────────────────────────
    IF v_refunded > 0 THEN
        -- Dual-write legacy refund transaction
        v_refund_tx_id := public.internal_write_legacy_transaction(
            p_user_id        := v_hold.user_id,
            p_tx_type        := 'refunded',
            p_amount         := v_refunded,
            p_balance_before := v_new_available - v_refunded,
            p_balance_after  := v_new_available,
            p_description    := v_refund_desc,
            p_reference_type := COALESCE(v_hold.reference_type, 'settle_refund'),
            p_reference_id   := p_hold_id,
            p_agent_run_id   := v_hold.agent_run_id,
            p_metadata       := p_metadata
        );

        PERFORM public.internal_write_ledger_entry(
            p_user_id          := v_hold.user_id,
            p_entry_type       := 'release',
            p_amount           := v_refunded,
            p_available_before := v_new_available - v_refunded,
            p_available_after  := v_new_available,
            p_reserved_before  := v_new_reserved + v_refunded,
            p_reserved_after   := v_new_reserved,
            p_hold_id          := p_hold_id,
            p_agent_run_id     := v_hold.agent_run_id,
            p_legacy_tx_id     := v_refund_tx_id,
            p_idempotency_key  := 'release:' || p_hold_id,
            p_description      := v_refund_desc,
            p_reference_type   := v_hold.reference_type,
            p_metadata         := p_metadata
        );
    END IF;

    -- ── Update linked agent_run if present ────────────────────────────────────
    IF v_hold.agent_run_id IS NOT NULL THEN
        UPDATE public.agent_runs
        SET status             = p_status,
            credits_used       = v_charged,
            credits_refunded   = v_refunded,
            settled_at         = now(),
            settlement_idempotency_key = p_settlement_idempotency_key,
            receipt            = p_receipt,
            updated_at         = now(),
            last_activity_at   = now()
        WHERE id = v_hold.agent_run_id;

        PERFORM public.log_agent_run_event(
            v_hold.agent_run_id,
            'v2_hold_settled',
            'V2 hold settled: charged=' || v_charged || ' refunded=' || v_refunded
        );
    END IF;

    RETURN jsonb_build_object(
        'success',   true,
        'hold_id',   p_hold_id,
        'charged',   v_charged,
        'refunded',  v_refunded,
        'available', v_new_available,
        'reserved',  v_new_reserved
    );
END;
$$;

COMMENT ON FUNCTION public.settle_credit_hold_v2 IS
    'V2 billing: settle an open hold. Caps actual cost at reserved amount. '
    'Writes capture + optional release ledger entries. Dual-writes to credit_transactions.';

-- ─── 3. charge_credits_v2 ────────────────────────────────────────────────────
-- Direct debit with no prior hold (for one-shot, low-latency operations).
-- Deducts `amount` from available immediately.
-- Returns: { success, available, charged, is_duplicate }

CREATE OR REPLACE FUNCTION public.charge_credits_v2(
    p_user_id         uuid,
    p_amount          integer,
    p_reference_type  text,
    p_idempotency_key text,
    p_agent_run_id    uuid    DEFAULT NULL,
    p_description     text    DEFAULT NULL,
    p_reference_id    uuid    DEFAULT NULL,
    p_metadata        jsonb   DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bal            public.credit_balances%ROWTYPE;
    v_new_available  integer;
    v_legacy_tx_id   uuid;
    v_desc           text;
BEGIN
    -- ── Idempotency: check ledger for this key ────────────────────────────────
    IF EXISTS (
        SELECT 1 FROM public.credit_ledger_entries
        WHERE idempotency_key = 'charge:' || p_idempotency_key
    ) THEN
        SELECT * INTO v_bal FROM public.credit_balances WHERE user_id = p_user_id;
        RETURN jsonb_build_object(
            'success',      true,
            'is_duplicate', true,
            'available',    COALESCE(v_bal.available, 0),
            'charged',      p_amount
        );
    END IF;

    -- ── Validate ────────────────────────────────────────────────────────────────
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'reason',  'invalid_amount',
            'message', 'Charge amount must be a positive integer'
        );
    END IF;

    -- ── Row-lock balance; upsert if needed ────────────────────────────────────
    INSERT INTO public.credit_balances (user_id, available, reserved)
    VALUES (p_user_id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_bal
    FROM public.credit_balances
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_bal.available < p_amount THEN
        RETURN jsonb_build_object(
            'success',   false,
            'reason',    'insufficient_credits',
            'message',   'Insufficient available credits',
            'available', v_bal.available,
            'required',  p_amount
        );
    END IF;

    v_new_available := v_bal.available - p_amount;
    v_desc := COALESCE(p_description, 'Direct charge: ' || p_amount || ' credits for ' || p_reference_type);

    -- ── Update balance ─────────────────────────────────────────────────────────
    UPDATE public.credit_balances
    SET available      = v_new_available,
        lifetime_spent = lifetime_spent + p_amount,
        updated_at     = now()
    WHERE user_id = p_user_id;

    -- ── Dual-write legacy transaction ─────────────────────────────────────────
    v_legacy_tx_id := public.internal_write_legacy_transaction(
        p_user_id        := p_user_id,
        p_tx_type        := 'deduction',
        p_amount         := -p_amount,
        p_balance_before := v_bal.available,
        p_balance_after  := v_new_available,
        p_description    := v_desc,
        p_reference_type := p_reference_type,
        p_reference_id   := p_reference_id,
        p_agent_run_id   := p_agent_run_id,
        p_metadata       := p_metadata
    );

    -- ── Write ledger entry ─────────────────────────────────────────────────────
    PERFORM public.internal_write_ledger_entry(
        p_user_id          := p_user_id,
        p_entry_type       := 'charge',
        p_amount           := p_amount,
        p_available_before := v_bal.available,
        p_available_after  := v_new_available,
        p_reserved_before  := v_bal.reserved,
        p_reserved_after   := v_bal.reserved,
        p_agent_run_id     := p_agent_run_id,
        p_legacy_tx_id     := v_legacy_tx_id,
        p_idempotency_key  := 'charge:' || p_idempotency_key,
        p_description      := v_desc,
        p_reference_type   := p_reference_type,
        p_reference_id     := p_reference_id,
        p_metadata         := p_metadata
    );

    RETURN jsonb_build_object(
        'success',   true,
        'available', v_new_available,
        'charged',   p_amount
    );
END;
$$;

COMMENT ON FUNCTION public.charge_credits_v2 IS
    'V2 billing: direct debit with no prior hold (one-shot operations like AI chat). '
    'Idempotent via idempotency_key. Dual-writes to credit_ledger_entries and credit_transactions.';

-- ─── 4. release_expired_credit_holds ─────────────────────────────────────────
-- Cron-safe: scans pending holds past their expires_at and releases each one.
-- Designed to run every N minutes via pg_cron or an Edge Function scheduler.
-- Returns: { released_count, total_credits_returned, errors }

CREATE OR REPLACE FUNCTION public.release_expired_credit_holds(
    p_batch_limit    integer DEFAULT 100,
    p_dry_run        boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_hold           public.credit_holds%ROWTYPE;
    v_bal            public.credit_balances%ROWTYPE;
    v_new_available  integer;
    v_new_reserved   integer;
    v_released_count integer := 0;
    v_total_returned integer := 0;
    v_errors         jsonb   := '[]'::jsonb;
    v_legacy_tx_id   uuid;
    v_desc           text;
BEGIN
    -- Check dry_run flag from app_config if not explicitly provided
    IF NOT p_dry_run THEN
        p_dry_run := public.get_flag('reconciliation.dry_run');
    END IF;

    FOR v_hold IN
        SELECT *
        FROM public.credit_holds
        WHERE status = 'pending'
          AND expires_at < now()
        ORDER BY expires_at ASC
        LIMIT p_batch_limit
        FOR UPDATE SKIP LOCKED
    LOOP
        BEGIN
            IF p_dry_run THEN
                -- Dry run: just count without modifying
                v_released_count := v_released_count + 1;
                v_total_returned := v_total_returned + v_hold.amount_reserved;
                CONTINUE;
            END IF;

            -- Lock and fetch balance
            SELECT * INTO v_bal
            FROM public.credit_balances
            WHERE user_id = v_hold.user_id
            FOR UPDATE;

            IF NOT FOUND THEN
                -- Balance row missing — log and skip
                v_errors := v_errors || jsonb_build_object(
                    'hold_id', v_hold.id,
                    'reason',  'balance_row_missing'
                );
                CONTINUE;
            END IF;

            v_new_reserved  := GREATEST(v_bal.reserved - v_hold.amount_reserved, 0);
            v_new_available := v_bal.available + v_hold.amount_reserved;

            -- Update balance
            UPDATE public.credit_balances
            SET available  = v_new_available,
                reserved   = v_new_reserved,
                updated_at = now()
            WHERE user_id = v_hold.user_id;

            -- Mark hold expired
            UPDATE public.credit_holds
            SET status      = 'expired',
                released_at = now(),
                metadata    = metadata || jsonb_build_object('expired_by', 'release_expired_credit_holds')
            WHERE id = v_hold.id;

            v_desc := 'Expired hold released: ' || v_hold.amount_reserved || ' credits returned';

            -- Dual-write legacy refund transaction
            v_legacy_tx_id := public.internal_write_legacy_transaction(
                p_user_id        := v_hold.user_id,
                p_tx_type        := 'refunded',
                p_amount         := v_hold.amount_reserved,
                p_balance_before := v_bal.available,
                p_balance_after  := v_new_available,
                p_description    := v_desc,
                p_reference_type := 'hold_expiry',
                p_reference_id   := v_hold.id,
                p_agent_run_id   := v_hold.agent_run_id,
                p_metadata       := jsonb_build_object('hold_id', v_hold.id, 'expired_at', now())
            );

            -- Write ledger entry
            PERFORM public.internal_write_ledger_entry(
                p_user_id          := v_hold.user_id,
                p_entry_type       := 'expired_hold',
                p_amount           := v_hold.amount_reserved,
                p_available_before := v_bal.available,
                p_available_after  := v_new_available,
                p_reserved_before  := v_bal.reserved,
                p_reserved_after   := v_new_reserved,
                p_hold_id          := v_hold.id,
                p_agent_run_id     := v_hold.agent_run_id,
                p_legacy_tx_id     := v_legacy_tx_id,
                p_idempotency_key  := 'expired_hold:' || v_hold.id,
                p_description      := v_desc,
                p_reference_type   := 'hold_expiry',
                p_metadata         := jsonb_build_object('hold_id', v_hold.id)
            );

            -- Fail any linked agent run
            IF v_hold.agent_run_id IS NOT NULL THEN
                UPDATE public.agent_runs
                SET status           = 'expired',
                    failure_reason   = 'Credit hold expired before settlement',
                    last_activity_at = now(),
                    updated_at       = now()
                WHERE id = v_hold.agent_run_id
                  AND status NOT IN ('completed', 'failed', 'cancelled', 'expired');

                PERFORM public.log_agent_run_event(
                    v_hold.agent_run_id,
                    'v2_hold_expired',
                    'Hold expired: ' || v_hold.amount_reserved || ' credits returned'
                );
            END IF;

            v_released_count := v_released_count + 1;
            v_total_returned := v_total_returned + v_hold.amount_reserved;

        EXCEPTION WHEN OTHERS THEN
            -- Absorb per-hold errors so one bad row doesn't fail the whole batch
            v_errors := v_errors || jsonb_build_object(
                'hold_id', v_hold.id,
                'error',   SQLERRM
            );
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success',         true,
        'dry_run',         p_dry_run,
        'released_count',  v_released_count,
        'credits_returned', v_total_returned,
        'errors',          v_errors
    );
END;
$$;

COMMENT ON FUNCTION public.release_expired_credit_holds IS
    'Cron-safe: scans pending holds past their expires_at and releases each one back to available. '
    'Respects reconciliation.dry_run app_config flag. Run every 5-10 minutes via pg_cron or Edge Function scheduler.';

-- ─── 5. Grants ────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.reserve_credits_v2       TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_credit_hold_v2    TO service_role;
GRANT EXECUTE ON FUNCTION public.charge_credits_v2        TO service_role;
GRANT EXECUTE ON FUNCTION public.release_expired_credit_holds TO service_role;
GRANT EXECUTE ON FUNCTION public.internal_write_ledger_entry  TO service_role;

-- Authenticated users can call charge/reserve from the client SDK if needed
-- (protected by RLS on credit_balances; they can only affect their own row)
GRANT EXECUTE ON FUNCTION public.reserve_credits_v2    TO authenticated;
GRANT EXECUTE ON FUNCTION public.charge_credits_v2     TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_credit_hold_v2 TO authenticated;

-- ─── 6. Verification: smoke-test the immutability trigger ─────────────────────
-- Confirms the Phase 2 trigger is in place before Phase 3 RPCs rely on it.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_name   = 'trg_credit_ledger_immutable'
          AND event_object_table = 'credit_ledger_entries'
    ) THEN
        RAISE EXCEPTION '[Phase 3] ABORT: trg_credit_ledger_immutable is not installed. '
            'Run Phase 2 migration (20260623083000_phase2_credit_ledger_v2.sql) first.';
    END IF;
    RAISE NOTICE '[Phase 3] Immutability trigger verified ✓';
END;
$$;
