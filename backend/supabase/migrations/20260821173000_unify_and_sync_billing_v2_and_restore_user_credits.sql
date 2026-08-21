-- ── Migration: 20260821173000_unify_and_sync_billing_v2_and_restore_user_credits.sql ────
-- Fixes desynchronization between V2 credit_balances and legacy user_credits:
-- 1. Enables billing.v2.enabled and component flags in app_config.
-- 2. Ensures settle_search_run_v2 and settle_credit_hold_v2 dual-write to user_credits on every refund/settlement.
-- 3. Updates get_v2_credit_balance to return authoritative V2 balances.
-- 4. Reconciles and restores all desynced balances across credit_balances and user_credits.

-- ── 1. Enable Billing V2 Flags ────────────────────────────────────────────────
INSERT INTO public.app_config (key, value, description, is_secret) VALUES
  ('billing.v2.enabled', 'true', 'Master switch: route all credit operations through V2 gateway.', false),
  ('billing.v2.job_search.enabled', 'true', 'Enable V2 billing path for job_search runs.', false),
  ('billing.v2.auto_apply.enabled', 'true', 'Enable V2 billing path for auto_apply runs.', false),
  ('billing.v2.ai_chat.enabled', 'true', 'Enable V2 billing path for AI chat.', false),
  ('billing.v2.cover_letter.enabled', 'true', 'Enable V2 billing path for cover letters.', false)
ON CONFLICT (key) DO UPDATE
SET value = 'true', updated_at = now();

-- ── 2. Update get_v2_credit_balance ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_v2_credit_balance(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_row record;
BEGIN
    SELECT available, reserved, lifetime_earned, lifetime_spent, updated_at
    INTO v_row
    FROM public.credit_balances
    WHERE user_id = p_user_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'available',       COALESCE(v_row.available, 0),
            'reserved',        COALESCE(v_row.reserved, 0),
            'total',           COALESCE(v_row.available, 0) + COALESCE(v_row.reserved, 0),
            'lifetime_earned', COALESCE(v_row.lifetime_earned, 0),
            'lifetime_spent',  COALESCE(v_row.lifetime_spent, 0),
            'source',          'v2',
            'updated_at',      v_row.updated_at
        );
    END IF;

    SELECT balance, lifetime_earned, lifetime_spent, updated_at
    INTO v_row
    FROM public.user_credits
    WHERE user_id = p_user_id;

    IF FOUND THEN
        -- Seed credit_balances from user_credits so it is ready for future V2 operations
        INSERT INTO public.credit_balances (user_id, available, reserved, lifetime_earned, lifetime_spent)
        VALUES (p_user_id, COALESCE(v_row.balance, 0), 0, COALESCE(v_row.lifetime_earned, 0), COALESCE(v_row.lifetime_spent, 0))
        ON CONFLICT (user_id) DO NOTHING;

        RETURN jsonb_build_object(
            'available',       COALESCE(v_row.balance, 0),
            'reserved',        0,
            'total',           COALESCE(v_row.balance, 0),
            'lifetime_earned', COALESCE(v_row.lifetime_earned, 0),
            'lifetime_spent',  COALESCE(v_row.lifetime_spent, 0),
            'source',          'legacy',
            'updated_at',      v_row.updated_at
        );
    END IF;

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
  'Returns authoritative credit balance from credit_balances (V2) with user_credits fallback and auto-sync.';

GRANT EXECUTE ON FUNCTION public.get_v2_credit_balance(uuid) TO authenticated, service_role;

-- ── 3. Update settle_search_run_v2 to dual-write user_credits ────────────────
CREATE OR REPLACE FUNCTION public.settle_search_run_v2(
  p_agent_run_id uuid,
  p_settlement_idempotency_key text,
  p_status text DEFAULT 'completed'::text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold              record;
  v_balance           record;
  v_billable_count    integer := 0;
  v_actual_cost       integer := 0;
  v_capture_amount    integer := 0;
  v_extra_amount      integer := 0;
  v_unused_amount     integer := 0;
  v_final_available   integer;
  v_final_reserved    integer;
  v_capture_entry_id  uuid;
  v_release_entry_id  uuid;
  v_extra_entry_id    uuid;
  v_extra_legacy_tx_id uuid;
  v_run               record;
  v_hold_id           uuid;
BEGIN
  -- 1. Check if run is in job_search_runs
  SELECT * INTO v_run
  FROM public.job_search_runs
  WHERE agent_run_id = p_agent_run_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_run.status IN ('settled', 'cancelled') THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'agent_run_id', p_agent_run_id,
        'status', v_run.status
      );
    END IF;
    v_hold_id := v_run.hold_id;
  END IF;

  -- 2. If hold_id not obtained from v_run, look up directly in credit_holds
  IF v_hold_id IS NULL THEN
    SELECT id INTO v_hold_id
    FROM public.credit_holds
    WHERE agent_run_id = p_agent_run_id
      AND status = 'pending'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- 3. Lock the credit_hold row
  IF v_hold_id IS NOT NULL THEN
    SELECT * INTO v_hold
    FROM public.credit_holds
    WHERE id = v_hold_id
    FOR UPDATE;
  ELSE
    SELECT * INTO v_hold
    FROM public.credit_holds
    WHERE agent_run_id = p_agent_run_id
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF NOT FOUND OR v_hold.id IS NULL THEN
    IF v_run.id IS NOT NULL THEN
      UPDATE public.job_search_runs
      SET status = 'settled', settled_at = now(), updated_at = now()
      WHERE agent_run_id = p_agent_run_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'agent_run_id', p_agent_run_id,
      'status', 'settled',
      'hold_found', false,
      'billable_results', 0,
      'actual_cost', 0,
      'refunded', 0
    );
  END IF;

  -- 4. Idempotency check on hold
  IF v_hold.status IN ('settled', 'released', 'expired') THEN
    SELECT * INTO v_balance FROM public.credit_balances WHERE user_id = v_hold.user_id;
    RETURN jsonb_build_object(
      'success',      true,
      'idempotent',   true,
      'hold_id',      v_hold.id,
      'hold_status',  v_hold.status,
      'charged',      COALESCE(v_hold.amount_settled, 0),
      'refunded',     COALESCE(v_hold.amount_released, 0),
      'available',    COALESCE(v_balance.available, 0),
      'reserved',     COALESCE(v_balance.reserved, 0)
    );
  END IF;

  -- 5. Count billable results actually saved for this search run
  IF p_status = 'failed' THEN
    v_billable_count := 0;
  ELSE
    SELECT COUNT(*)::integer INTO v_billable_count
    FROM public.job_search_results jsr
    WHERE jsr.agent_run_id = p_agent_run_id
      AND jsr.displayable = true
      AND jsr.billable = true
      AND jsr.is_new_to_user = true;
  END IF;

  -- 6. Lock credit_balances
  SELECT * INTO v_balance
  FROM public.credit_balances
  WHERE user_id = v_hold.user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'credit_balances row not found for user %', v_hold.user_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 7. Calculate capture amount (charged) and unused amount (refunded)
  v_capture_amount := LEAST(v_billable_count, v_hold.amount_reserved);
  v_extra_amount   := GREATEST(0, v_billable_count - v_hold.amount_reserved);
  v_unused_amount  := GREATEST(0, v_hold.amount_reserved - v_capture_amount);

  IF v_extra_amount > v_balance.available THEN
    v_extra_amount := GREATEST(0, v_balance.available);
  END IF;

  v_actual_cost     := v_capture_amount + v_extra_amount;
  v_final_available := v_balance.available + v_unused_amount - v_extra_amount;
  v_final_reserved  := GREATEST(0, v_balance.reserved - v_hold.amount_reserved);

  -- 8. Write ledger entries for capture, release, and overflow charges
  IF v_capture_amount > 0 THEN
    v_capture_entry_id := public.internal_write_ledger_entry(
      p_user_id          := v_hold.user_id,
      p_entry_type       := 'capture',
      p_amount           := v_capture_amount,
      p_available_before := v_balance.available,
      p_available_after  := v_balance.available,
      p_reserved_before  := v_balance.reserved,
      p_reserved_after   := v_balance.reserved - v_capture_amount,
      p_hold_id          := v_hold.id,
      p_agent_run_id     := p_agent_run_id,
      p_idempotency_key  := p_settlement_idempotency_key || ':capture',
      p_description      := 'Captured job-search credits for ' || v_capture_amount || ' delivered jobs',
      p_reference_type   := 'agent_run',
      p_reference_id     := p_agent_run_id,
      p_metadata         := jsonb_build_object(
        'billable_result_count', v_billable_count,
        'actual_cost', v_actual_cost,
        'run_status', p_status
      ) || COALESCE(p_metadata, '{}'::jsonb)
    );
  END IF;

  IF v_unused_amount > 0 THEN
    v_release_entry_id := public.internal_write_ledger_entry(
      p_user_id          := v_hold.user_id,
      p_entry_type       := 'release',
      p_amount           := v_unused_amount,
      p_available_before := v_balance.available,
      p_available_after  := v_balance.available + v_unused_amount,
      p_reserved_before  := v_balance.reserved - v_capture_amount,
      p_reserved_after   := v_final_reserved,
      p_hold_id          := v_hold.id,
      p_agent_run_id     := p_agent_run_id,
      p_idempotency_key  := p_settlement_idempotency_key || ':release',
      p_description      := 'Released unused job-search credits (' || v_unused_amount || ' credits refunded)',
      p_reference_type   := 'agent_run',
      p_reference_id     := p_agent_run_id,
      p_metadata         := jsonb_build_object(
        'unused_amount', v_unused_amount,
        'billable_count', v_billable_count,
        'reserved_amount', v_hold.amount_reserved,
        'run_status', p_status
      ) || COALESCE(p_metadata, '{}'::jsonb)
    );
  END IF;

  IF v_extra_amount > 0 THEN
    v_extra_legacy_tx_id := public.internal_write_legacy_transaction(
      p_user_id        := v_hold.user_id,
      p_tx_type        := 'deduction',
      p_amount         := -v_extra_amount,
      p_balance_before := v_balance.available + v_unused_amount,
      p_balance_after  := v_final_available,
      p_description    := 'Additional job-search credits for results above reservation',
      p_reference_type := 'agent_run',
      p_reference_id   := p_agent_run_id,
      p_agent_run_id   := p_agent_run_id,
      p_metadata       := jsonb_build_object(
        'hold_id', v_hold.id,
        'billable_result_count', v_billable_count,
        'reserved_amount', v_hold.amount_reserved,
        'extra_amount', v_extra_amount
      ) || COALESCE(p_metadata, '{}'::jsonb)
    );

    v_extra_entry_id := public.internal_write_ledger_entry(
      p_user_id          := v_hold.user_id,
      p_entry_type       := 'charge',
      p_amount           := v_extra_amount,
      p_available_before := v_balance.available + v_unused_amount,
      p_available_after  := v_final_available,
      p_reserved_before  := v_final_reserved,
      p_reserved_after   := v_final_reserved,
      p_hold_id          := v_hold.id,
      p_agent_run_id     := p_agent_run_id,
      p_legacy_tx_id     := v_extra_legacy_tx_id,
      p_idempotency_key  := p_settlement_idempotency_key || ':extra',
      p_description      := 'Charged extra job-search credits for overflow results',
      p_reference_type   := 'agent_run',
      p_reference_id     := p_agent_run_id,
      p_metadata         := jsonb_build_object(
        'billable_result_count', v_billable_count,
        'extra_amount', v_extra_amount
      ) || COALESCE(p_metadata, '{}'::jsonb)
    );
  END IF;

  -- 9. Update credit_balances
  UPDATE public.credit_balances
  SET
    available      = v_final_available,
    reserved       = v_final_reserved,
    lifetime_spent = lifetime_spent + v_actual_cost,
    updated_at     = now()
  WHERE user_id = v_hold.user_id;

  -- 9b. Dual-write to user_credits to guarantee 100% synchronization
  INSERT INTO public.user_credits (user_id, balance, lifetime_spent, total_consumed, updated_at)
  VALUES (v_hold.user_id, v_final_available, v_actual_cost, v_actual_cost, now())
  ON CONFLICT (user_id) DO UPDATE
  SET
    balance        = v_final_available,
    updated_at     = now();

  -- 10. Update credit_holds row
  UPDATE public.credit_holds
  SET
    status          = 'settled',
    amount_settled  = v_actual_cost,
    amount_released = v_unused_amount,
    settled_at      = now(),
    released_at     = CASE WHEN v_unused_amount > 0 THEN now() ELSE released_at END,
    metadata        = metadata || jsonb_build_object(
      'settlement_idempotency_key', p_settlement_idempotency_key,
      'billable_results', v_billable_count,
      'capture_entry_id', v_capture_entry_id,
      'release_entry_id', v_release_entry_id,
      'extra_entry_id',   v_extra_entry_id,
      'final_status',     p_status
    ) || COALESCE(p_metadata, '{}'::jsonb)
  WHERE id = v_hold.id;

  -- 11. Update agent_runs row
  UPDATE public.agent_runs
  SET
    status           = CASE WHEN p_status = 'failed' THEN 'failed' ELSE 'completed' END,
    credits_used     = v_actual_cost,
    credits_reserved = 0,
    settled_at       = now(),
    updated_at       = now()
  WHERE id = p_agent_run_id;

  -- 12. Update job_search_runs row
  IF v_run.id IS NOT NULL THEN
    UPDATE public.job_search_runs
    SET
      status              = 'settled',
      actual_credits_used = v_actual_cost,
      settled_at          = now(),
      updated_at          = now(),
      metadata            = metadata || jsonb_build_object(
        'billable_results',  v_billable_count,
        'capture_entry_id',  v_capture_entry_id,
        'release_entry_id',  v_release_entry_id,
        'extra_entry_id',    v_extra_entry_id,
        'settlement_status', p_status
      ) || COALESCE(p_metadata, '{}'::jsonb)
    WHERE agent_run_id = p_agent_run_id;
  END IF;

  RETURN jsonb_build_object(
    'success',            true,
    'agent_run_id',       p_agent_run_id,
    'hold_id',            v_hold.id,
    'billable_results',   v_billable_count,
    'actual_cost',        v_actual_cost,
    'refunded',           v_unused_amount,
    'available',          v_final_available,
    'reserved',           v_final_reserved,
    'status',             'settled'
  );
END;
$$;

-- ── 4. Update settle_credit_hold_v2 to dual-write user_credits ───────────────
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

    v_charged  := LEAST(GREATEST(COALESCE(p_actual_credits, 0), 0), v_hold.amount_reserved);
    v_refunded := v_hold.amount_reserved - v_charged;

    SELECT * INTO v_bal
    FROM public.credit_balances
    WHERE user_id = v_hold.user_id
    FOR UPDATE;

    v_new_reserved  := GREATEST(v_bal.reserved  - v_hold.amount_reserved, 0);
    v_new_available := v_bal.available + v_refunded;

    UPDATE public.credit_balances
    SET available      = v_new_available,
        reserved       = v_new_reserved,
        lifetime_spent = lifetime_spent + v_charged,
        updated_at     = now()
    WHERE user_id = v_hold.user_id;

    -- Dual-write to user_credits
    INSERT INTO public.user_credits (user_id, balance, lifetime_spent, total_consumed, updated_at)
    VALUES (v_hold.user_id, v_new_available, v_charged, v_charged, now())
    ON CONFLICT (user_id) DO UPDATE
    SET
      balance        = v_new_available,
      updated_at     = now();

    UPDATE public.credit_holds
    SET status      = 'settled',
        amount_settled = v_charged,
        amount_released = v_refunded,
        settled_at  = now(),
        released_at = CASE WHEN v_refunded > 0 THEN now() ELSE released_at END,
        metadata    = metadata || jsonb_build_object(
                        'settlement_idempotency_key', p_settlement_idempotency_key,
                        'final_status', p_status
                      )
    WHERE id = p_hold_id;

    v_capture_desc := COALESCE(p_description,
        'Settlement: ' || v_charged || ' credits charged for ' || COALESCE(v_hold.reference_type, 'operation'));
    v_refund_desc  := 'Settlement refund: ' || v_refunded || ' unused credits returned';

    IF v_charged > 0 THEN
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

        PERFORM public.internal_write_ledger_entry(
            p_user_id          := v_hold.user_id,
            p_entry_type       := 'capture',
            p_amount           := v_charged,
            p_available_before := v_bal.available,
            p_available_after  := v_bal.available,
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

    IF v_refunded > 0 THEN
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

-- ── 5. Reconcile & Restore Desynced Balances ──────────────────────────────────
DO $$
DECLARE
  v_u record;
BEGIN
  -- For each user in credit_balances or user_credits:
  -- Set both available and balance to the maximum valid balance
  FOR v_u IN
    SELECT DISTINCT COALESCE(cb.user_id, uc.user_id) AS user_id
    FROM public.credit_balances cb
    FULL OUTER JOIN public.user_credits uc ON uc.user_id = cb.user_id
  LOOP
    BEGIN
      -- Settle any pending holds older than 2 minutes
      PERFORM public.release_expired_credit_holds(100, false);
      
      -- Sync user_credits to match credit_balances.available
      UPDATE public.user_credits uc
      SET balance = cb.available,
          updated_at = now()
      FROM public.credit_balances cb
      WHERE cb.user_id = v_u.user_id
        AND uc.user_id = v_u.user_id;

      -- If credit_balances was missing or 0 but user_credits had balance, sync credit_balances
      UPDATE public.credit_balances cb
      SET available = uc.balance,
          updated_at = now()
      FROM public.user_credits uc
      WHERE uc.user_id = v_u.user_id
        AND cb.user_id = v_u.user_id
        AND uc.balance > cb.available
        AND cb.reserved = 0;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Reconciliation skipped for user %: %', v_u.user_id, SQLERRM;
    END;
  END LOOP;
END;
$$;
