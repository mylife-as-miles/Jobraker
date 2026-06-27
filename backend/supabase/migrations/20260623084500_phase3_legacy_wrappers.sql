-- =============================================================================
-- Phase 3 — Legacy Billing RPC Wrappers
-- =============================================================================
-- Redefines the five legacy billing functions so they check billing.v2.enabled.
-- If the flag is true:
--   • They delegate execution to the V2 billing functions.
--   • They write to the V2 ledger (which also dual-writes to legacy credit_transactions).
--   • They preserve the original return type and schema structure to prevent breaking callers.
-- If the flag is false:
--   • They execute the pre-existing legacy/V1 path exactly as hotfixed.
-- =============================================================================

-- ─── 1. consume_credits ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.consume_credits(
    p_user_id uuid,
    p_feature_type text,
    p_feature_name text,
    p_reference_id uuid DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cost integer;
    v_feature_description text;
    v_idempotency_key text;
    v_res jsonb;

    -- Legacy path variables
    v_current_balance integer;
    v_user_tier text;
    v_tier_check boolean;
BEGIN
    IF public.get_flag('billing.v2.enabled') THEN
        RAISE WARNING '[billing.v2] consume_credits legacy wrapper invoked for user %, feature: %.%', p_user_id, p_feature_type, p_feature_name;

        -- 1. Check user tier and access limits (still valid validation step)
        v_user_tier := public.get_user_tier(p_user_id);

        IF p_feature_type = 'job_search' AND p_feature_name = 'job_match_analysis' THEN
            v_tier_check := public.check_tier_access(p_user_id, 'Basics');
            IF NOT v_tier_check THEN
                RAISE EXCEPTION 'Match score analysis requires Basics, Pro, or Ultimate subscription';
            END IF;
        END IF;

        IF p_feature_type = 'cover_letter' AND p_feature_name IN ('ai_generation', 'optimization') THEN
            v_tier_check := public.check_tier_access(p_user_id, 'Basics');
            IF NOT v_tier_check THEN
                RAISE EXCEPTION 'Cover letter AI features require Basics, Pro, or Ultimate subscription';
            END IF;
        END IF;

        IF p_feature_type = 'ai_chat' THEN
            v_tier_check := public.check_tier_access(p_user_id, 'Pro');
            IF NOT v_tier_check THEN
                RAISE EXCEPTION 'AI Chat assistant requires Pro or Ultimate subscription';
            END IF;
        END IF;

        -- 2. Fetch the feature cost
        SELECT cost, description
        INTO v_cost, v_feature_description
        FROM public.credit_costs
        WHERE feature_type = p_feature_type
          AND feature_name = p_feature_name
          AND is_active = true;

        IF v_cost IS NULL THEN
            RAISE EXCEPTION 'Feature not found or inactive: %.%', p_feature_type, p_feature_name;
        END IF;

        -- 3. Construct idempotency key (since consume_credits caller didn't pass one)
        v_idempotency_key := 'consume_credits:' || p_user_id || ':' || p_feature_type || ':' || p_feature_name || ':' || COALESCE(p_reference_id::text, gen_random_uuid()::text);

        -- 4. Delegate to charge_credits_v2
        v_res := public.charge_credits_v2(
            p_user_id         := p_user_id,
            p_amount          := v_cost,
            p_reference_type  := p_feature_type,
            p_idempotency_key := v_idempotency_key,
            p_agent_run_id     := NULL,
            p_description      := v_feature_description,
            p_reference_id     := p_reference_id,
            p_metadata         := jsonb_build_object('tier', v_user_tier) || p_metadata
        );

        RETURN COALESCE((v_res->>'success')::boolean, false);
    ELSE
        -- ── Legacy V1 Path ──
        v_user_tier := public.get_user_tier(p_user_id);

        IF p_feature_type = 'job_search' AND p_feature_name = 'job_match_analysis' THEN
            v_tier_check := public.check_tier_access(p_user_id, 'Basics');
            IF NOT v_tier_check THEN
                RAISE EXCEPTION 'Match score analysis requires Basics, Pro, or Ultimate subscription';
            END IF;
        END IF;

        IF p_feature_type = 'cover_letter' AND p_feature_name IN ('ai_generation', 'optimization') THEN
            v_tier_check := public.check_tier_access(p_user_id, 'Basics');
            IF NOT v_tier_check THEN
                RAISE EXCEPTION 'Cover letter AI features require Basics, Pro, or Ultimate subscription';
            END IF;
        END IF;

        IF p_feature_type = 'ai_chat' THEN
            v_tier_check := public.check_tier_access(p_user_id, 'Pro');
            IF NOT v_tier_check THEN
                RAISE EXCEPTION 'AI Chat assistant requires Pro or Ultimate subscription';
            END IF;
        END IF;

        SELECT cost, description INTO v_cost, v_feature_description
        FROM public.credit_costs
        WHERE feature_type = p_feature_type AND feature_name = p_feature_name AND is_active = true;

        IF v_cost IS NULL THEN
            RAISE EXCEPTION 'Feature not found or inactive: %.%', p_feature_type, p_feature_name;
        END IF;

        SELECT balance INTO v_current_balance FROM public.user_credits WHERE user_id = p_user_id FOR UPDATE;

        IF v_current_balance IS NULL OR v_current_balance < v_cost THEN
            RETURN false;
        END IF;

        UPDATE public.user_credits
        SET balance = balance - v_cost,
            lifetime_spent = COALESCE(lifetime_spent, 0) + v_cost,
            total_consumed = COALESCE(total_consumed, 0) + v_cost,
            updated_at = timezone('utc'::text, now())
        WHERE user_id = p_user_id;

        PERFORM public.internal_write_legacy_transaction(
            p_user_id        := p_user_id,
            p_tx_type        := 'deduction',
            p_amount         := v_cost,
            p_balance_before := v_current_balance,
            p_balance_after  := v_current_balance - v_cost,
            p_description    := v_feature_description,
            p_reference_type := p_feature_type,
            p_reference_id   := p_reference_id,
            p_agent_run_id   := NULL,
            p_metadata       := jsonb_build_object('tier', v_user_tier) || p_metadata
        );

        RETURN true;
    END IF;
END;
$$;

COMMENT ON FUNCTION public.consume_credits(uuid, text, text, uuid, jsonb) IS
    '[DEPRECATED] Consume credits legacy RPC. Delegates to V2 billing gateway when billing.v2.enabled = true.';

-- ─── 2. deduct_job_search_credits ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deduct_job_search_credits(
    p_user_id UUID,
    p_jobs_count INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_credits_to_deduct INTEGER;
    v_idempotency_key text;
    v_res jsonb;
    v_bal jsonb;

    -- Legacy path variables
    v_current_balance INTEGER;
    v_new_balance INTEGER;
BEGIN
    IF public.get_flag('billing.v2.enabled') THEN
        RAISE WARNING '[billing.v2] deduct_job_search_credits legacy wrapper invoked for user %, jobs: %', p_user_id, p_jobs_count;

        v_credits_to_deduct := LEAST(p_jobs_count, 10);
        IF v_credits_to_deduct <= 0 THEN
            v_bal := public.get_v2_credit_balance(p_user_id);
            RETURN json_build_object('success', true, 'credits_deducted', 0, 'remaining_balance', (v_bal->>'available')::integer);
        END IF;

        v_idempotency_key := 'deduct_job_search_credits:' || p_user_id || ':' || v_credits_to_deduct || ':' || gen_random_uuid()::text;

        v_res := public.charge_credits_v2(
            p_user_id         := p_user_id,
            p_amount          := v_credits_to_deduct,
            p_reference_type  := 'job_search',
            p_idempotency_key := v_idempotency_key,
            p_description      := 'Job search direct charge (legacy wrapper)',
            p_metadata         := jsonb_build_object('jobs_count', p_jobs_count)
        );

        IF (v_res->>'success')::boolean = true THEN
            RETURN json_build_object(
                'success', true,
                'credits_deducted', v_credits_to_deduct,
                'remaining_balance', (v_res->>'available')::integer
            );
        ELSE
            RETURN json_build_object(
                'success', false,
                'message', COALESCE(v_res->>'message', 'Insufficient credits'),
                'current_balance', (v_res->>'available')::integer
            );
        END IF;
    ELSE
        -- ── Legacy V1 Path ──
        v_credits_to_deduct := LEAST(p_jobs_count, 10);
        
        SELECT balance INTO v_current_balance FROM public.user_credits WHERE user_id = p_user_id FOR UPDATE;
        
        IF v_current_balance IS NULL THEN
            INSERT INTO public.user_credits (user_id, balance, lifetime_earned, lifetime_spent)
            VALUES (p_user_id, 0, 0, 0)
            RETURNING balance INTO v_current_balance;
        END IF;
        
        IF v_current_balance < v_credits_to_deduct THEN
            RETURN json_build_object('success', false, 'message', 'Insufficient credits', 'current_balance', v_current_balance);
        END IF;
        
        UPDATE public.user_credits 
        SET balance = balance - v_credits_to_deduct, 
            lifetime_spent = COALESCE(lifetime_spent, 0) + v_credits_to_deduct, 
            total_consumed = COALESCE(total_consumed, 0) + v_credits_to_deduct,
            updated_at = NOW()
        WHERE user_id = p_user_id 
        RETURNING balance INTO v_new_balance;
        
        PERFORM public.internal_write_legacy_transaction(
            p_user_id        := p_user_id,
            p_tx_type        := 'deduction',
            p_amount         := v_credits_to_deduct,
            p_balance_before := v_current_balance,
            p_balance_after  := v_new_balance,
            p_description    := 'Job search',
            p_reference_type := 'job_search',
            p_reference_id   := NULL,
            p_agent_run_id   := NULL,
            p_metadata       := '{}'::jsonb
        );
        
        RETURN json_build_object('success', true, 'credits_deducted', v_credits_to_deduct, 'remaining_balance', v_new_balance);
    END IF;
END;
$$;

COMMENT ON FUNCTION public.deduct_job_search_credits(uuid, integer) IS
    '[DEPRECATED] Deduct job search credits legacy RPC. Delegates to V2 billing gateway when billing.v2.enabled = true.';

-- ─── 3. deduct_auto_apply_credits ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deduct_auto_apply_credits(
    p_user_id UUID,
    p_jobs_count INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_credits_to_deduct INTEGER;
    v_idempotency_key text;
    v_res jsonb;

    -- Legacy path variables
    v_current_balance INTEGER;
    v_new_balance INTEGER;
    v_has_total_consumed BOOLEAN;
BEGIN
    IF public.get_flag('billing.v2.enabled') THEN
        RAISE WARNING '[billing.v2] deduct_auto_apply_credits legacy wrapper invoked for user %, jobs: %', p_user_id, p_jobs_count;

        IF p_jobs_count IS NULL OR p_jobs_count <= 0 THEN
            RETURN json_build_object('success', false, 'message', 'Invalid jobs count. Must be greater than 0.');
        END IF;

        v_credits_to_deduct := p_jobs_count * 5;
        v_idempotency_key := 'deduct_auto_apply_credits:' || p_user_id || ':' || v_credits_to_deduct || ':' || gen_random_uuid()::text;

        v_res := public.charge_credits_v2(
            p_user_id         := p_user_id,
            p_amount          := v_credits_to_deduct,
            p_reference_type  := 'auto_apply',
            p_idempotency_key := v_idempotency_key,
            p_description      := 'Auto apply direct charge (legacy wrapper)',
            p_metadata         := jsonb_build_object('jobs_count', p_jobs_count)
        );

        IF (v_res->>'success')::boolean = true THEN
            RETURN json_build_object(
                'success', true,
                'credits_deducted', v_credits_to_deduct,
                'remaining_balance', (v_res->>'available')::integer,
                'jobs_count', p_jobs_count
            );
        ELSE
            RETURN json_build_object(
                'success', false,
                'message', COALESCE(v_res->>'message', 'Insufficient credits'),
                'current_balance', (v_res->>'available')::integer,
                'required_credits', v_credits_to_deduct
            );
        END IF;
    ELSE
        -- ── Legacy V1 Path ──
        IF p_jobs_count IS NULL OR p_jobs_count <= 0 THEN
            RETURN json_build_object('success', false, 'message', 'Invalid jobs count. Must be greater than 0.');
        END IF;

        v_credits_to_deduct := p_jobs_count * 5;

        SELECT balance INTO v_current_balance FROM public.user_credits WHERE user_id = p_user_id FOR UPDATE;

        IF v_current_balance IS NULL THEN
            INSERT INTO public.user_credits (user_id, balance, lifetime_earned, lifetime_spent)
            VALUES (p_user_id, 0, 0, 0)
            RETURNING balance INTO v_current_balance;
        END IF;

        IF v_current_balance < v_credits_to_deduct THEN
            RETURN json_build_object(
                'success', false,
                'message', 'Insufficient credits',
                'current_balance', v_current_balance,
                'required_credits', v_credits_to_deduct
            );
        END IF;

        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_credits' AND column_name = 'total_consumed'
        ) INTO v_has_total_consumed;

        IF v_has_total_consumed THEN
            UPDATE public.user_credits
            SET balance = balance - v_credits_to_deduct,
                lifetime_spent = COALESCE(lifetime_spent, 0) + v_credits_to_deduct,
                total_consumed = COALESCE(total_consumed, 0) + v_credits_to_deduct,
                updated_at = NOW()
            WHERE user_id = p_user_id
            RETURNING balance INTO v_new_balance;
        ELSE
            UPDATE public.user_credits
            SET balance = balance - v_credits_to_deduct,
                lifetime_spent = COALESCE(lifetime_spent, 0) + v_credits_to_deduct,
                updated_at = NOW()
            WHERE user_id = p_user_id
            RETURNING balance INTO v_new_balance;
        END IF;

        PERFORM public.internal_write_legacy_transaction(
            p_user_id        := p_user_id,
            p_tx_type        := 'deduction',
            p_amount         := v_credits_to_deduct,
            p_balance_before := v_current_balance,
            p_balance_after  := v_new_balance,
            p_description    := 'Auto apply',
            p_reference_type := 'auto_apply',
            p_reference_id   := NULL,
            p_agent_run_id   := NULL,
            p_metadata       := '{}'::jsonb
        );

        RETURN json_build_object(
            'success', true,
            'credits_deducted', v_credits_to_deduct,
            'remaining_balance', v_new_balance,
            'jobs_count', p_jobs_count
        );
    END IF;
END;
$$;

COMMENT ON FUNCTION public.deduct_auto_apply_credits(uuid, integer) IS
    '[DEPRECATED] Deduct auto apply credits legacy RPC. Delegates to V2 billing gateway when billing.v2.enabled = true.';

-- ─── 4. reserve_credits_for_run ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reserve_credits_for_run(
    p_user_id UUID,
    p_run_type TEXT,
    p_estimated_credits INTEGER,
    p_idempotency_key TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing_run_id UUID;
    v_existing_status TEXT;
    v_existing_reserved INTEGER;
    v_current_balance INTEGER;
    v_res jsonb;
    v_agent_run_id UUID;

    -- Legacy path variables
    v_new_balance INTEGER;
BEGIN
    IF public.get_flag('billing.v2.enabled') THEN
        RAISE WARNING '[billing.v2] reserve_credits_for_run legacy wrapper invoked. User: %, Run type: %', p_user_id, p_run_type;

        -- Idempotency check on agent_runs
        SELECT id, status, credits_reserved INTO v_existing_run_id, v_existing_status, v_existing_reserved
        FROM public.agent_runs
        WHERE idempotency_key = p_idempotency_key;

        IF FOUND THEN
            SELECT available INTO v_current_balance FROM public.credit_balances WHERE user_id = p_user_id;
            RETURN json_build_object(
                'success', true,
                'agent_run_id', v_existing_run_id,
                'status', v_existing_status,
                'credits_reserved', v_existing_reserved,
                'current_balance', COALESCE(v_current_balance, 0),
                'is_duplicate', true
            );
        END IF;

        -- Create the agent run row first
        INSERT INTO public.agent_runs (
            user_id,
            run_type,
            status,
            credits_estimated,
            credits_reserved,
            idempotency_key,
            metadata
        ) VALUES (
            p_user_id,
            p_run_type,
            'reserved',
            p_estimated_credits,
            p_estimated_credits,
            p_idempotency_key,
            p_metadata
        ) RETURNING id INTO v_agent_run_id;

        -- Call reserve_credits_v2 to handle actual ledger/balance changes and legacy dual-writes
        v_res := public.reserve_credits_v2(
            p_user_id          := p_user_id,
            p_amount           := p_estimated_credits,
            p_run_type         := p_run_type,
            p_idempotency_key  := p_idempotency_key,
            p_agent_run_id     := v_agent_run_id,
            p_description      := 'Reservation for agent run ' || p_run_type,
            p_expires_minutes  := COALESCE((public.get_app_config('billing.v2.reserve_timeout_minutes'))::integer, 30),
            p_metadata         := p_metadata
        );

        IF (v_res->>'success')::boolean = true THEN
            RETURN json_build_object(
                'success', true,
                'agent_run_id', v_agent_run_id,
                'credits_reserved', p_estimated_credits,
                'current_balance', (v_res->>'available')::integer
            );
        ELSE
            -- Failed to reserve credits — rollback agent run creation
            DELETE FROM public.agent_runs WHERE id = v_agent_run_id;

            RETURN json_build_object(
                'success', false,
                'message', COALESCE(v_res->>'message', 'Insufficient credits'),
                'current_balance', (v_res->>'available')::integer,
                'required_credits', p_estimated_credits
            );
        END IF;
    ELSE
        -- ── Legacy V1 Path ──
        SELECT id, status, credits_reserved INTO v_existing_run_id, v_existing_status, v_existing_reserved
        FROM public.agent_runs
        WHERE idempotency_key = p_idempotency_key;

        IF FOUND THEN
            SELECT balance INTO v_current_balance FROM public.user_credits WHERE user_id = p_user_id;
            RETURN json_build_object(
                'success', true,
                'agent_run_id', v_existing_run_id,
                'status', v_existing_status,
                'credits_reserved', v_existing_reserved,
                'current_balance', COALESCE(v_current_balance, 0),
                'is_duplicate', true
            );
        END IF;

        IF p_estimated_credits IS NULL OR p_estimated_credits < 0 THEN
            RETURN json_build_object(
                'success', false,
                'message', 'Estimated credits must be non-negative'
            );
        END IF;

        SELECT balance INTO v_current_balance
        FROM public.user_credits
        WHERE user_id = p_user_id
        FOR UPDATE;

        IF NOT FOUND THEN
            INSERT INTO public.user_credits (user_id, balance, lifetime_spent, total_consumed)
            VALUES (p_user_id, 0, 0, 0)
            RETURNING balance INTO v_current_balance;
        END IF;

        IF v_current_balance < p_estimated_credits THEN
            RETURN json_build_object(
                'success', false,
                'message', 'Insufficient credits',
                'current_balance', v_current_balance,
                'required_credits', p_estimated_credits
            );
        END IF;

        UPDATE public.user_credits
        SET balance = balance - p_estimated_credits,
            lifetime_spent = COALESCE(lifetime_spent, 0) + p_estimated_credits,
            total_consumed = COALESCE(total_consumed, 0) + p_estimated_credits,
            updated_at = NOW()
        WHERE user_id = p_user_id
        RETURNING balance INTO v_new_balance;

        INSERT INTO public.agent_runs (
            user_id, run_type, status, credits_estimated, credits_reserved, idempotency_key, metadata
        ) VALUES (
            p_user_id, p_run_type, 'reserved', p_estimated_credits, p_estimated_credits, p_idempotency_key, p_metadata
        ) RETURNING id INTO v_agent_run_id;
        PERFORM public.internal_write_legacy_transaction(
            p_user_id        := p_user_id,
            p_tx_type        := 'deduction',
            p_amount         := -p_estimated_credits,
            p_balance_before := v_new_balance + p_estimated_credits,
            p_balance_after  := v_new_balance,
            p_description    := 'Reservation for agent run ' || p_run_type,
            p_reference_type := p_run_type,
            p_reference_id   := v_agent_run_id,
            p_agent_run_id   := v_agent_run_id,
            p_metadata       := p_metadata
        );

        PERFORM public.log_agent_run_event(v_agent_run_id, 'reservation_created', 'Reserved ' || p_estimated_credits || ' credits');

        RETURN json_build_object(
            'success', true,
            'agent_run_id', v_agent_run_id,
            'credits_reserved', p_estimated_credits,
            'current_balance', v_new_balance
        );
    END IF;
END;
$$;

COMMENT ON FUNCTION public.reserve_credits_for_run(uuid, text, integer, text, jsonb) IS
    '[DEPRECATED] Reserve credits for agent run legacy RPC. Delegates to V2 billing gateway when billing.v2.enabled = true.';

-- ─── 5. settle_run_credits ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.settle_run_credits(
    p_agent_run_id UUID,
    p_actual_credits INTEGER,
    p_status TEXT DEFAULT 'completed',
    p_failure_reason TEXT DEFAULT NULL,
    p_receipt JSONB DEFAULT '{}'::jsonb,
    p_settlement_idempotency_key TEXT DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_hold_id UUID;
    v_res jsonb;
    v_current_balance integer;
    v_run record;

    -- Legacy path variables
    v_new_balance INTEGER;
    v_capped_actual_cost INTEGER;
    v_overflow_credits INTEGER;
    v_refund_amount INTEGER;
BEGIN
    IF public.get_flag('billing.v2.enabled') THEN
        RAISE WARNING '[billing.v2] settle_run_credits legacy wrapper invoked. Run: %, actual: %', p_agent_run_id, p_actual_credits;

        SELECT * INTO v_run FROM public.agent_runs WHERE id = p_agent_run_id;
        IF NOT FOUND THEN
            RETURN json_build_object(
                'success', false,
                'message', 'Agent run not found'
            );
        END IF;

        -- Find the pending or settled hold for this run
        SELECT id INTO v_hold_id
        FROM public.credit_holds
        WHERE agent_run_id = p_agent_run_id
          AND status IN ('pending', 'settled')
        LIMIT 1;

        IF NOT FOUND THEN
            -- Check if run was already settled
            IF v_run.settled_at IS NOT NULL THEN
                SELECT available INTO v_current_balance FROM public.credit_balances WHERE user_id = v_run.user_id;
                RETURN json_build_object(
                    'success', true,
                    'agent_run_id', p_agent_run_id,
                    'message', 'Run already settled',
                    'current_balance', COALESCE(v_current_balance, 0),
                    'is_duplicate', true
                );
            END IF;

            RETURN json_build_object(
                'success', false,
                'message', 'No active hold found for agent run ' || p_agent_run_id
            );
        END IF;

        -- Call settle_credit_hold_v2
        v_res := public.settle_credit_hold_v2(
            p_hold_id                    := v_hold_id,
            p_actual_credits             := p_actual_credits,
            p_settlement_idempotency_key := p_settlement_idempotency_key,
            p_status                     := p_status,
            p_description                := 'Settlement via legacy wrapper: ' || p_actual_credits || ' credits',
            p_receipt                    := p_receipt,
            p_metadata                   := jsonb_build_object('failure_reason', p_failure_reason)
        );

        IF p_failure_reason IS NOT NULL THEN
            UPDATE public.agent_runs SET failure_reason = p_failure_reason WHERE id = p_agent_run_id;
        END IF;

        IF (v_res->>'success')::boolean = true THEN
            RETURN json_build_object(
                'success', true,
                'agent_run_id', p_agent_run_id,
                'credits_used', (v_res->>'charged')::integer,
                'credits_refunded', (v_res->>'refunded')::integer,
                'overflow_credits', GREATEST(p_actual_credits - v_run.credits_reserved, 0),
                'current_balance', (v_res->>'available')::integer
            );
        ELSE
            RETURN json_build_object(
                'success', false,
                'message', COALESCE(v_res->>'message', 'Settlement failed')
            );
        END IF;
    ELSE
        -- ── Legacy V1 Path ──
        SELECT * INTO v_run FROM public.agent_runs WHERE id = p_agent_run_id FOR UPDATE;

        IF NOT FOUND THEN
            RETURN json_build_object('success', false, 'message', 'Agent run not found');
        END IF;

        IF v_run.settled_at IS NOT NULL THEN
            SELECT balance INTO v_current_balance FROM public.user_credits WHERE user_id = v_run.user_id;
            RETURN json_build_object(
                'success', true,
                'agent_run_id', p_agent_run_id,
                'message', 'Run already settled',
                'current_balance', COALESCE(v_current_balance, 0),
                'is_duplicate', true
            );
        END IF;

        IF p_settlement_idempotency_key IS NOT NULL AND v_run.settlement_idempotency_key = p_settlement_idempotency_key THEN
            SELECT balance INTO v_current_balance FROM public.user_credits WHERE user_id = v_run.user_id;
            RETURN json_build_object(
                'success', true,
                'agent_run_id', p_agent_run_id,
                'message', 'Run already settled with this settlement key',
                'current_balance', COALESCE(v_current_balance, 0),
                'is_duplicate', true
            );
        END IF;

        v_capped_actual_cost := LEAST(p_actual_credits, v_run.credits_reserved);
        v_overflow_credits := GREATEST(p_actual_credits - v_run.credits_reserved, 0);
        v_refund_amount := v_run.credits_reserved - v_capped_actual_cost;

        SELECT balance INTO v_current_balance FROM public.user_credits WHERE user_id = v_run.user_id FOR UPDATE;

        UPDATE public.user_credits
        SET balance = balance + v_refund_amount,
            lifetime_spent = GREATEST(COALESCE(lifetime_spent, 0) - v_refund_amount, 0),
            total_consumed = GREATEST(COALESCE(total_consumed, 0) - v_refund_amount, 0),
            updated_at = NOW()
        WHERE user_id = v_run.user_id
        RETURNING balance INTO v_new_balance;

        UPDATE public.agent_runs
        SET status = p_status,
            credits_used = v_capped_actual_cost,
            credits_refunded = v_refund_amount,
            overflow_credits = v_overflow_credits,
            failure_reason = p_failure_reason,
            receipt = p_receipt,
            settled_at = NOW(),
            settlement_idempotency_key = p_settlement_idempotency_key,
            last_activity_at = NOW(),
            updated_at = NOW()
        WHERE id = p_agent_run_id;

        IF v_refund_amount > 0 THEN
            PERFORM public.internal_write_legacy_transaction(
                p_user_id        := v_run.user_id,
                p_tx_type        := 'refunded',
                p_amount         := v_refund_amount,
                p_balance_before := v_new_balance - v_refund_amount,
                p_balance_after  := v_new_balance,
                p_description    := 'Refund for agent run ' || v_run.run_type,
                p_reference_type := v_run.run_type,
                p_reference_id   := p_agent_run_id,
                p_agent_run_id   := p_agent_run_id,
                p_metadata       := p_receipt
            );
        END IF;

        PERFORM public.log_agent_run_event(
            p_agent_run_id, 
            'run_settled', 
            'Settled. Used: ' || v_capped_actual_cost || ', Refunded: ' || v_refund_amount || ', Overflow: ' || v_overflow_credits,
            jsonb_build_object('status', p_status, 'failure_reason', p_failure_reason)
        );

        RETURN json_build_object(
            'success', true,
            'agent_run_id', p_agent_run_id,
            'credits_used', v_capped_actual_cost,
            'credits_refunded', v_refund_amount,
            'overflow_credits', v_overflow_credits,
            'current_balance', v_new_balance
        );
    END IF;
END;
$$;

COMMENT ON FUNCTION public.settle_run_credits(uuid, integer, text, text, jsonb, text) IS
    '[DEPRECATED] Settle agent run credits legacy RPC. Delegates to V2 billing gateway when billing.v2.enabled = true.';
