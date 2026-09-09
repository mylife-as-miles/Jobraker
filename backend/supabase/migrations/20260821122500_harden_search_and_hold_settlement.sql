-- ── Migration: 20260821122500_harden_search_and_hold_settlement.sql ───────────
-- Guarantees:
-- 1. If 0 jobs are delivered or search fails, 0 credits are charged and 100% of held credits are refunded to available.
-- 2. If N jobs are delivered out of M reserved (e.g. 30 out of 50), exactly N credits are charged and M - N credits (20) are refunded to available.
-- 3. Robust hold resolution: looks up hold directly from credit_holds if job_search_runs is missing.
-- 4. Immediate reconciliation of any dangling/stale pending credit holds older than 5 minutes.

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

COMMENT ON FUNCTION public.settle_search_run_v2(uuid, text, text, jsonb) IS
  'Settles job search credits accurately based on actual new billable results saved, refunding 100% of held credits on 0 results or failure, and refunding unused credits on partial results.';

GRANT EXECUTE ON FUNCTION public.settle_search_run_v2(uuid, text, text, jsonb) TO service_role;

-- ── Stale Pending Holds Sweeper & Reconciliation ──────────────────────────────
-- Releases any pending holds created more than 5 minutes ago that were left un-settled by the old bug
DO $$
DECLARE
  v_rec record;
BEGIN
  FOR v_rec IN
    SELECT ch.id, ch.agent_run_id, ch.user_id, ch.amount_reserved
    FROM public.credit_holds ch
    WHERE ch.status = 'pending'
      AND (ch.created_at < now() - INTERVAL '5 minutes' OR ch.expires_at < now())
  LOOP
    BEGIN
      PERFORM public.settle_search_run_v2(
        p_agent_run_id := v_rec.agent_run_id,
        p_settlement_idempotency_key := 'reconcile:stale_hold:' || v_rec.id::text,
        p_status := 'completed',
        p_metadata := jsonb_build_object('source', 'reconciliation_migration')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to auto-settle stale hold %: %', v_rec.id, SQLERRM;
    END;
  END LOOP;
END;
$$;
