-- Charge job searches by the number of billable job_search_results rows that
-- were actually saved for the run, not by a fixed request/reservation amount.

DO $$
BEGIN
  IF to_regclass('public.credit_holds') IS NULL THEN
    RAISE NOTICE '[settle_job_search_by_saved_results] public.credit_holds is missing; skipping constraint update. The V2 billing migrations must run before job-search settlement can use overflow billing.';
  ELSE
    ALTER TABLE public.credit_holds
      DROP CONSTRAINT IF EXISTS credit_holds_settled_le_reserved;
  END IF;
END;
$$;

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
  v_billable_count    integer;
  v_actual_cost       integer;
  v_capture_amount    integer;
  v_extra_amount      integer;
  v_unused_amount     integer;
  v_final_available   integer;
  v_final_reserved    integer;
  v_capture_entry_id  uuid;
  v_release_entry_id  uuid;
  v_extra_entry_id    uuid;
  v_extra_legacy_tx_id uuid;
  v_run               record;
BEGIN
  SELECT * INTO v_run
  FROM public.job_search_runs
  WHERE agent_run_id = p_agent_run_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'job_search_run_not_found',
      'agent_run_id', p_agent_run_id
    );
  END IF;

  IF v_run.status IN ('settled', 'cancelled') THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'agent_run_id', p_agent_run_id,
      'status', v_run.status
    );
  END IF;

  SELECT * INTO v_hold
  FROM public.credit_holds
  WHERE id = v_run.hold_id
  FOR UPDATE;

  IF NOT FOUND THEN
    UPDATE public.job_search_runs
    SET status = 'settled', settled_at = now(), updated_at = now()
    WHERE agent_run_id = p_agent_run_id;

    RETURN jsonb_build_object(
      'success', true,
      'agent_run_id', p_agent_run_id,
      'status', 'settled',
      'hold_found', false,
      'billable_results', 0,
      'actual_cost', 0
    );
  END IF;

  IF v_hold.status IN ('settled', 'released', 'expired') THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'hold_id', v_hold.id,
      'hold_status', v_hold.status
    );
  END IF;

  SELECT COUNT(*)::integer INTO v_billable_count
  FROM public.job_search_results jsr
  WHERE jsr.agent_run_id = p_agent_run_id
    AND jsr.displayable = true
    AND jsr.billable = true
    AND jsr.is_new_to_user = true;

  IF p_status = 'failed' THEN
    v_billable_count := 0;
  END IF;

  SELECT * INTO v_balance
  FROM public.credit_balances
  WHERE user_id = v_hold.user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'credit_balances row not found for user %', v_hold.user_id
      USING ERRCODE = 'P0002';
  END IF;

  v_capture_amount := LEAST(v_billable_count, v_hold.amount_reserved);
  v_extra_amount := GREATEST(0, v_billable_count - v_hold.amount_reserved);
  v_unused_amount := GREATEST(0, v_hold.amount_reserved - v_capture_amount);

  IF v_extra_amount > v_balance.available THEN
    v_extra_amount := GREATEST(0, v_balance.available);
  END IF;

  v_actual_cost := v_capture_amount + v_extra_amount;
  v_final_available := v_balance.available + v_unused_amount - v_extra_amount;
  v_final_reserved := GREATEST(0, v_balance.reserved - v_hold.amount_reserved);

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
      p_description      := 'Captured job-search credits for saved results',
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
      p_description      := 'Released unused job-search credits',
      p_reference_type   := 'agent_run',
      p_reference_id     := p_agent_run_id,
      p_metadata         := jsonb_build_object(
        'unused_amount', v_unused_amount,
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
      p_description    := 'Additional job-search credits for saved results above reservation',
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
      p_idempotency_key  := p_settlement_idempotency_key || ':extra-charge',
      p_description      := 'Additional job-search credits for saved results above reservation',
      p_reference_type   := 'agent_run',
      p_reference_id     := p_agent_run_id,
      p_metadata         := jsonb_build_object(
        'billable_result_count', v_billable_count,
        'reserved_amount', v_hold.amount_reserved,
        'extra_amount', v_extra_amount
      ) || COALESCE(p_metadata, '{}'::jsonb)
    );
  END IF;

  UPDATE public.credit_balances
  SET
    available = v_final_available,
    reserved = v_final_reserved,
    lifetime_spent = lifetime_spent + v_actual_cost,
    updated_at = now()
  WHERE user_id = v_hold.user_id;

  UPDATE public.credit_holds
  SET
    status = 'settled',
    amount_settled = v_actual_cost,
    amount_released = v_unused_amount,
    settled_at = now(),
    metadata = metadata || jsonb_build_object(
      'settled_via', 'settle_search_run_v2',
      'billable_result_count', v_billable_count,
      'reserved_amount', v_hold.amount_reserved,
      'captured_from_hold', v_capture_amount,
      'extra_charged', v_extra_amount,
      'run_status', p_status
    ) || COALESCE(p_metadata, '{}'::jsonb)
  WHERE id = v_hold.id;

  UPDATE public.agent_runs
  SET
    status = p_status,
    credits_used = v_actual_cost,
    credits_refunded = v_unused_amount,
    overflow_credits = v_extra_amount,
    settlement_idempotency_key = p_settlement_idempotency_key,
    receipt = jsonb_build_object(
      'jobs_billable', v_billable_count,
      'credits_charged', v_actual_cost,
      'credits_reserved', v_hold.amount_reserved,
      'credits_released', v_unused_amount,
      'extra_charged', v_extra_amount
    ) || COALESCE(p_metadata, '{}'::jsonb),
    settled_at = now(),
    updated_at = now()
  WHERE id = p_agent_run_id;

  UPDATE public.job_search_runs
  SET
    status = 'settled',
    settled_at = now(),
    updated_at = now()
  WHERE agent_run_id = p_agent_run_id;

  RETURN jsonb_build_object(
    'success', true,
    'agent_run_id', p_agent_run_id,
    'hold_id', v_hold.id,
    'billable_results', v_billable_count,
    'actual_cost', v_actual_cost,
    'reserved_amount', v_hold.amount_reserved,
    'captured_from_hold', v_capture_amount,
    'extra_charged', v_extra_amount,
    'unused_amount', v_unused_amount,
    'run_status', p_status,
    'capture_entry_id', v_capture_entry_id,
    'release_entry_id', v_release_entry_id,
    'extra_entry_id', v_extra_entry_id
  );
END;
$$;

COMMENT ON FUNCTION public.settle_search_run_v2(uuid, text, text, jsonb) IS
  'Settles job-search billing from saved billable job_search_results rows. Captures held credits, releases unused credits, and charges overflow results from available credits.';

GRANT EXECUTE ON FUNCTION public.settle_search_run_v2(uuid, text, text, jsonb) TO service_role;
