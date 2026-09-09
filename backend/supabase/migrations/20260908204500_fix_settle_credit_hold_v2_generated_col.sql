-- Fix settle_credit_hold_v2 generated column update and transaction_type check constraint
-- 1) credit_holds.amount_released is GENERATED ALWAYS AS (amount_reserved - amount_settled); it cannot be updated directly.
-- 2) credit_transactions_type_check allows 'refund', not 'refunded'.

CREATE OR REPLACE FUNCTION public.settle_credit_hold_v2(
    p_hold_id uuid,
    p_actual_credits integer,
    p_settlement_idempotency_key text DEFAULT NULL::text,
    p_status text DEFAULT 'completed'::text,
    p_description text DEFAULT NULL::text,
    p_receipt jsonb DEFAULT '{}'::jsonb,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    -- Notice: amount_released is omitted because it is a generated column (amount_reserved - amount_settled)
    UPDATE public.credit_holds
    SET status      = 'settled',
        amount_settled = v_charged,
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
            p_tx_type        := 'refund',
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
$function$;
