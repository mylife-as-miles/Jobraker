-- Create agent_runs and agent_run_events tables, functions and triggers for run-based billing

-- 1. Create agent_runs table
CREATE TABLE IF NOT EXISTS public.agent_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_type TEXT NOT NULL CHECK (run_type IN ('auto_apply', 'job_search', 'direct_apply', 'company_outreach', 'resume_tailor', 'interview_prep', 'recruiter_sourcing')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reserved', 'running', 'settling', 'completed', 'failed', 'cancelled', 'expired')),
    credits_estimated INTEGER NOT NULL DEFAULT 0,
    credits_reserved INTEGER NOT NULL DEFAULT 0,
    credits_used INTEGER DEFAULT 0,
    credits_refunded INTEGER DEFAULT 0,
    overflow_credits INTEGER NOT NULL DEFAULT 0,
    idempotency_key TEXT UNIQUE,
    settlement_idempotency_key TEXT UNIQUE,
    failure_reason TEXT,
    receipt JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    settled_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create agent_run_events table
CREATE TABLE IF NOT EXISTS public.agent_run_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_run_events_run_id ON public.agent_run_events(agent_run_id);

-- 3. Alter credit_transactions table
ALTER TABLE public.credit_transactions 
ADD COLUMN IF NOT EXISTS agent_run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_credit_transactions_agent_run_id 
ON public.credit_transactions(agent_run_id);

-- 4. Alter applications table
ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS agent_run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_applications_agent_run_id
ON public.applications(agent_run_id);

-- Enable RLS on new tables
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_run_events ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Select own agent_runs" ON public.agent_runs;
CREATE POLICY "Select own agent_runs" ON public.agent_runs
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Insert own agent_runs" ON public.agent_runs;
CREATE POLICY "Insert own agent_runs" ON public.agent_runs
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Update own agent_runs" ON public.agent_runs;
CREATE POLICY "Update own agent_runs" ON public.agent_runs
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Delete own agent_runs" ON public.agent_runs;
CREATE POLICY "Delete own agent_runs" ON public.agent_runs
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Select own agent_run_events" ON public.agent_run_events;
CREATE POLICY "Select own agent_run_events" ON public.agent_run_events
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.agent_runs 
            WHERE agent_runs.id = agent_run_events.agent_run_id 
              AND agent_runs.user_id = auth.uid()
        )
    );

-- Grants
GRANT ALL ON TABLE public.agent_runs TO anon;
GRANT ALL ON TABLE public.agent_runs TO authenticated;
GRANT ALL ON TABLE public.agent_runs TO service_role;

GRANT ALL ON TABLE public.agent_run_events TO anon;
GRANT ALL ON TABLE public.agent_run_events TO authenticated;
GRANT ALL ON TABLE public.agent_run_events TO service_role;


-- 5. Helper Function: log_agent_run_event
CREATE OR REPLACE FUNCTION public.log_agent_run_event(
    p_agent_run_id UUID,
    p_event_type TEXT,
    p_message TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.agent_run_events (agent_run_id, event_type, message, metadata)
    VALUES (p_agent_run_id, p_event_type, p_message, p_metadata);
    
    UPDATE public.agent_runs
    SET last_activity_at = NOW(),
        updated_at = NOW()
    WHERE id = p_agent_run_id;
END;
$$;


-- 6. RPC Function: reserve_credits_for_run
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
    v_new_balance INTEGER;
    v_agent_run_id UUID;
    
    v_has_type_col BOOLEAN;
    v_has_transaction_type BOOLEAN;
    v_has_balance_before BOOLEAN;
    v_has_metadata BOOLEAN;
BEGIN
    -- Idempotency check
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

    -- Validate input
    IF p_estimated_credits IS NULL OR p_estimated_credits < 0 THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Estimated credits must be non-negative'
        );
    END IF;

    -- Row lock user credits
    SELECT balance INTO v_current_balance
    FROM public.user_credits
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.user_credits (user_id, balance, lifetime_spent, total_consumed)
        VALUES (p_user_id, 0, 0, 0)
        RETURNING balance INTO v_current_balance;
    END IF;

    -- Check balance
    IF v_current_balance < p_estimated_credits THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Insufficient credits',
            'current_balance', v_current_balance,
            'required_credits', p_estimated_credits
        );
    END IF;

    -- Deduct estimated credits upfront
    UPDATE public.user_credits
    SET balance = balance - p_estimated_credits,
        lifetime_spent = COALESCE(lifetime_spent, 0) + p_estimated_credits,
        total_consumed = COALESCE(total_consumed, 0) + p_estimated_credits,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_balance;

    -- Create agent run row
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

    -- Identify transaction table columns dynamically
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'type'
    ) INTO v_has_type_col;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'transaction_type'
    ) INTO v_has_transaction_type;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'balance_before'
    ) INTO v_has_balance_before;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'metadata'
    ) INTO v_has_metadata;

    -- Insert upfront deduction (as a negative transaction sign)
    IF v_has_type_col THEN
        IF v_has_balance_before THEN
            IF v_has_metadata THEN
                INSERT INTO public.credit_transactions (
                    user_id, type, amount, balance_before, balance_after,
                    description, reference_type, reference_id, agent_run_id, metadata
                ) VALUES (
                    p_user_id, 'deduction', -p_estimated_credits, v_new_balance + p_estimated_credits, v_new_balance,
                    'Reservation for agent run ' || p_run_type, p_run_type, v_agent_run_id, v_agent_run_id, p_metadata
                );
            ELSE
                INSERT INTO public.credit_transactions (
                    user_id, type, amount, balance_before, balance_after,
                    description, reference_type, reference_id, agent_run_id
                ) VALUES (
                    p_user_id, 'deduction', -p_estimated_credits, v_new_balance + p_estimated_credits, v_new_balance,
                    'Reservation for agent run ' || p_run_type, p_run_type, v_agent_run_id, v_agent_run_id
                );
            END IF;
        ELSE
            IF v_has_metadata THEN
                INSERT INTO public.credit_transactions (
                    user_id, type, amount, balance_after,
                    description, reference_type, reference_id, agent_run_id, metadata
                ) VALUES (
                    p_user_id, 'deduction', -p_estimated_credits, v_new_balance,
                    'Reservation for agent run ' || p_run_type, p_run_type, v_agent_run_id, v_agent_run_id, p_metadata
                );
            ELSE
                INSERT INTO public.credit_transactions (
                    user_id, type, amount, balance_after,
                    description, reference_type, reference_id, agent_run_id
                ) VALUES (
                    p_user_id, 'deduction', -p_estimated_credits, v_new_balance,
                    'Reservation for agent run ' || p_run_type, p_run_type, v_agent_run_id, v_agent_run_id
                );
            END IF;
        END IF;
    ELSIF v_has_transaction_type THEN
        IF v_has_balance_before THEN
            IF v_has_metadata THEN
                INSERT INTO public.credit_transactions (
                    user_id, transaction_type, amount, balance_before, balance_after,
                    description, reference_type, reference_id, agent_run_id, metadata
                ) VALUES (
                    p_user_id, 'deduction', -p_estimated_credits, v_new_balance + p_estimated_credits, v_new_balance,
                    'Reservation for agent run ' || p_run_type, p_run_type, v_agent_run_id, v_agent_run_id, p_metadata
                );
            ELSE
                INSERT INTO public.credit_transactions (
                    user_id, transaction_type, amount, balance_before, balance_after,
                    description, reference_type, reference_id, agent_run_id
                ) VALUES (
                    p_user_id, 'deduction', -p_estimated_credits, v_new_balance + p_estimated_credits, v_new_balance,
                    'Reservation for agent run ' || p_run_type, p_run_type, v_agent_run_id, v_agent_run_id
                );
            END IF;
        ELSE
            IF v_has_metadata THEN
                INSERT INTO public.credit_transactions (
                    user_id, transaction_type, amount, balance_after,
                    description, reference_type, reference_id, agent_run_id, metadata
                ) VALUES (
                    p_user_id, 'deduction', -p_estimated_credits, v_new_balance,
                    'Reservation for agent run ' || p_run_type, p_run_type, v_agent_run_id, v_agent_run_id, p_metadata
                );
            ELSE
                INSERT INTO public.credit_transactions (
                    user_id, transaction_type, amount, balance_after,
                    description, reference_type, reference_id, agent_run_id
                ) VALUES (
                    p_user_id, 'deduction', -p_estimated_credits, v_new_balance,
                    'Reservation for agent run ' || p_run_type, p_run_type, v_agent_run_id, v_agent_run_id
                );
            END IF;
        END IF;
    END IF;

    -- Log run event
    PERFORM public.log_agent_run_event(v_agent_run_id, 'reservation_created', 'Reserved ' || p_estimated_credits || ' credits');

    RETURN json_build_object(
        'success', true,
        'agent_run_id', v_agent_run_id,
        'credits_reserved', p_estimated_credits,
        'current_balance', v_new_balance
    );
END;
$$;


-- 7. RPC Function: settle_run_credits
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
    v_run RECORD;
    v_current_balance INTEGER;
    v_new_balance INTEGER;
    v_capped_actual_cost INTEGER;
    v_overflow_credits INTEGER;
    v_refund_amount INTEGER;
    
    v_has_type_col BOOLEAN;
    v_has_transaction_type BOOLEAN;
    v_has_balance_before BOOLEAN;
    v_has_metadata BOOLEAN;
BEGIN
    -- Lock agent run row
    SELECT * INTO v_run
    FROM public.agent_runs
    WHERE id = p_agent_run_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Agent run not found'
        );
    END IF;

    -- Double settlement check
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

    -- Idempotency check for settlement
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

    -- Cap actual cost at reserved amount to prevent silent overcharges
    v_capped_actual_cost := LEAST(p_actual_credits, v_run.credits_reserved);
    v_overflow_credits := GREATEST(p_actual_credits - v_run.credits_reserved, 0);
    v_refund_amount := v_run.credits_reserved - v_capped_actual_cost;

    -- Lock and update user credits
    SELECT balance INTO v_current_balance
    FROM public.user_credits
    WHERE user_id = v_run.user_id
    FOR UPDATE;

    UPDATE public.user_credits
    SET balance = balance + v_refund_amount,
        lifetime_spent = GREATEST(COALESCE(lifetime_spent, 0) - v_refund_amount, 0),
        total_consumed = GREATEST(COALESCE(total_consumed, 0) - v_refund_amount, 0),
        updated_at = NOW()
    WHERE user_id = v_run.user_id
    RETURNING balance INTO v_new_balance;

    -- Update agent run status and settlement fields
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

    -- Identify transaction table columns dynamically
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'type'
    ) INTO v_has_type_col;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'transaction_type'
    ) INTO v_has_transaction_type;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'balance_before'
    ) INTO v_has_balance_before;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'metadata'
    ) INTO v_has_metadata;

    -- Write refund transaction if there is any refund (positive sign)
    IF v_refund_amount > 0 THEN
        IF v_has_type_col THEN
            IF v_has_balance_before THEN
                IF v_has_metadata THEN
                    INSERT INTO public.credit_transactions (
                        user_id, type, amount, balance_before, balance_after,
                        description, reference_type, reference_id, agent_run_id, metadata
                    ) VALUES (
                        v_run.user_id, 'refunded', v_refund_amount, v_new_balance - v_refund_amount, v_new_balance,
                        'Refund for agent run ' || v_run.run_type, v_run.run_type, p_agent_run_id, p_agent_run_id, p_receipt
                    );
                ELSE
                    INSERT INTO public.credit_transactions (
                        user_id, type, amount, balance_before, balance_after,
                        description, reference_type, reference_id, agent_run_id
                    ) VALUES (
                        v_run.user_id, 'refunded', v_refund_amount, v_new_balance - v_refund_amount, v_new_balance,
                        'Refund for agent run ' || v_run.run_type, v_run.run_type, p_agent_run_id, p_agent_run_id
                    );
                END IF;
            ELSE
                IF v_has_metadata THEN
                    INSERT INTO public.credit_transactions (
                        user_id, type, amount, balance_after,
                        description, reference_type, reference_id, agent_run_id, metadata
                    ) VALUES (
                        v_run.user_id, 'refunded', v_refund_amount, v_new_balance,
                        'Refund for agent run ' || v_run.run_type, v_run.run_type, p_agent_run_id, p_agent_run_id, p_receipt
                    );
                ELSE
                    INSERT INTO public.credit_transactions (
                        user_id, type, amount, balance_after,
                        description, reference_type, reference_id, agent_run_id
                    ) VALUES (
                        v_run.user_id, 'refunded', v_refund_amount, v_new_balance,
                        'Refund for agent run ' || v_run.run_type, v_run.run_type, p_agent_run_id, p_agent_run_id
                    );
                END IF;
            END IF;
        ELSIF v_has_transaction_type THEN
            IF v_has_balance_before THEN
                IF v_has_metadata THEN
                    INSERT INTO public.credit_transactions (
                        user_id, transaction_type, amount, balance_before, balance_after,
                        description, reference_type, reference_id, agent_run_id, metadata
                    ) VALUES (
                        v_run.user_id, 'refund', v_refund_amount, v_new_balance - v_refund_amount, v_new_balance,
                        'Refund for agent run ' || v_run.run_type, v_run.run_type, p_agent_run_id, p_agent_run_id, p_receipt
                    );
                ELSE
                    INSERT INTO public.credit_transactions (
                        user_id, transaction_type, amount, balance_before, balance_after,
                        description, reference_type, reference_id, agent_run_id
                    ) VALUES (
                        v_run.user_id, 'refund', v_refund_amount, v_new_balance - v_refund_amount, v_new_balance,
                        'Refund for agent run ' || v_run.run_type, v_run.run_type, p_agent_run_id, p_agent_run_id
                    );
                END IF;
            ELSE
                IF v_has_metadata THEN
                    INSERT INTO public.credit_transactions (
                        user_id, transaction_type, amount, balance_after,
                        description, reference_type, reference_id, agent_run_id, metadata
                    ) VALUES (
                        v_run.user_id, 'refund', v_refund_amount, v_new_balance,
                        'Refund for agent run ' || v_run.run_type, v_run.run_type, p_agent_run_id, p_agent_run_id, p_receipt
                    );
                ELSE
                    INSERT INTO public.credit_transactions (
                        user_id, transaction_type, amount, balance_after,
                        description, reference_type, reference_id, agent_run_id
                    ) VALUES (
                        v_run.user_id, 'refund', v_refund_amount, v_new_balance,
                        'Refund for agent run ' || v_run.run_type, v_run.run_type, p_agent_run_id, p_agent_run_id
                    );
                END IF;
            END IF;
        END IF;
    END IF;

    -- Log run settled event
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
END;
$$;


-- 8. RPC Function: check_and_settle_agent_run
CREATE OR REPLACE FUNCTION public.check_and_settle_agent_run(
    p_agent_run_id UUID
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_apps INTEGER;
    v_terminal_apps INTEGER;
    v_successful_apps INTEGER;
    v_actual_credits INTEGER;
    v_status TEXT;
    v_result JSON;
BEGIN
    -- Count total apps
    SELECT COUNT(*) INTO v_total_apps
    FROM public.applications
    WHERE agent_run_id = p_agent_run_id;

    -- If no applications are linked, do not settle yet (or return early)
    IF v_total_apps = 0 THEN
        RETURN json_build_object(
            'success', false,
            'message', 'No applications found for this run'
        );
    END IF;

    -- Count terminal apps and successful apps
    -- canonical_stage IN ('submitted', 'failed', 'terminated', 'interview', 'offer', 'rejected', 'withdrawn')
    SELECT 
        COUNT(*), 
        COUNT(*) FILTER (WHERE canonical_stage NOT IN ('failed', 'terminated', 'draft_ready', 'queued'))
    INTO v_terminal_apps, v_successful_apps
    FROM public.applications
    WHERE agent_run_id = p_agent_run_id
      AND canonical_stage IN ('submitted', 'failed', 'terminated', 'interview', 'offer', 'rejected', 'withdrawn');

    -- If all applications are terminal
    IF v_terminal_apps = v_total_apps THEN
        v_actual_credits := v_successful_apps * 5;
        
        -- Determine status
        IF v_successful_apps = v_total_apps THEN
            v_status := 'completed';
        ELSIF v_successful_apps = 0 THEN
            v_status := 'failed';
        ELSE
            v_status := 'completed'; -- Partial completion
        END IF;

        -- Settle run credits
        v_result := public.settle_run_credits(
            p_agent_run_id := p_agent_run_id,
            p_actual_credits := v_actual_credits,
            p_status := v_status,
            p_failure_reason := CASE WHEN v_successful_apps = 0 THEN 'All applications failed' ELSE NULL END,
            p_receipt := jsonb_build_object(
                'total_applications', v_total_apps,
                'successful_applications', v_successful_apps,
                'failed_applications', v_total_apps - v_successful_apps
            )
        );
        
        RETURN v_result;
    END IF;

    RETURN json_build_object(
        'success', false,
        'message', 'Not all applications are terminal',
        'total_applications', v_total_apps,
        'terminal_applications', v_terminal_apps
    );
END;
$$;


-- 9. Function: check_and_expire_stale_agent_runs
CREATE OR REPLACE FUNCTION public.check_and_expire_stale_agent_runs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stale_run RECORD;
BEGIN
    FOR v_stale_run IN 
        SELECT id, user_id, run_type
        FROM public.agent_runs
        WHERE status IN ('pending', 'reserved', 'running', 'settling')
          AND last_activity_at < NOW() - INTERVAL '2 hours'
          AND settled_at IS NULL
    LOOP
        -- Log stale expiration event
        PERFORM public.log_agent_run_event(
            v_stale_run.id,
            'stale_expired',
            'Run expired due to inactivity for more than 2 hours'
        );

        -- Settle with 0 actual cost, status = 'expired'
        PERFORM public.settle_run_credits(
            p_agent_run_id := v_stale_run.id,
            p_actual_credits := 0,
            p_status := 'expired',
            p_failure_reason := 'Stale run timed out after 2 hours of inactivity',
            p_receipt := jsonb_build_object('timeout', true)
        );
    END LOOP;
END;
$$;


-- 10. Trigger: on_application_activity
CREATE OR REPLACE FUNCTION public.on_application_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.agent_run_id IS NOT NULL THEN
        IF TG_OP = 'INSERT' THEN
            PERFORM public.log_agent_run_event(
                NEW.agent_run_id,
                'application_linked',
                'Application linked: ' || NEW.company || ' - ' || NEW.job_title,
                jsonb_build_object('application_id', NEW.id, 'canonical_stage', NEW.canonical_stage)
            );
        ELSIF TG_OP = 'UPDATE' AND (OLD.canonical_stage IS DISTINCT FROM NEW.canonical_stage OR OLD.status IS DISTINCT FROM NEW.status) THEN
            PERFORM public.log_agent_run_event(
                NEW.agent_run_id,
                'application_status_changed',
                'Application status updated to ' || COALESCE(NEW.canonical_stage, NEW.status) || ': ' || NEW.company || ' - ' || NEW.job_title,
                jsonb_build_object(
                    'application_id', NEW.id,
                    'old_canonical_stage', OLD.canonical_stage,
                    'new_canonical_stage', NEW.canonical_stage,
                    'old_status', OLD.status,
                    'new_status', NEW.status
                )
            );
            
            -- Settle the run if this application went into a terminal stage
            IF NEW.canonical_stage IN ('submitted', 'failed', 'terminated', 'interview', 'offer', 'rejected', 'withdrawn') THEN
                PERFORM public.check_and_settle_agent_run(NEW.agent_run_id);
            END IF;
        ELSE
            -- Touch last activity time on run
            UPDATE public.agent_runs
            SET last_activity_at = NOW(),
                updated_at = NOW()
            WHERE id = NEW.agent_run_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_application_activity ON public.applications;
CREATE TRIGGER trigger_application_activity
    AFTER INSERT OR UPDATE ON public.applications
    FOR EACH ROW EXECUTE FUNCTION public.on_application_activity();


-- 11. Schedule the stale expiration cron job
do $$
begin
  perform cron.unschedule('expire-stale-agent-runs');
exception when others then
  null;
end;$$;

select cron.schedule(
  'expire-stale-agent-runs',
  '*/5 * * * *', -- every 5 minutes
  $$ select public.check_and_expire_stale_agent_runs(); $$
);


-- 12. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.reserve_credits_for_run(UUID, TEXT, INTEGER, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_run_credits(UUID, INTEGER, TEXT, TEXT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_settle_agent_run(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_credits_for_run(UUID, TEXT, INTEGER, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_run_credits(UUID, INTEGER, TEXT, TEXT, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_and_settle_agent_run(UUID) TO service_role;
