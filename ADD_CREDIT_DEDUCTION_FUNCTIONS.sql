-- Add credit deduction functions for job search and auto apply actions
-- This ensures credits are properly deducted when users perform actions

-- Function to deduct credits for job search
-- Returns JSON with success status and remaining balance
CREATE OR REPLACE FUNCTION "public"."deduct_job_search_credits"(
    p_user_id uuid,
    p_jobs_count integer DEFAULT 1
) RETURNS jsonb AS $$
DECLARE
    v_cost_per_job integer := 1; -- 1 credit per job searched
    v_total_cost integer;
    v_current_balance integer;
    v_feature_description text := 'Job search';
BEGIN
    -- Calculate total cost
    v_total_cost := v_cost_per_job * p_jobs_count;
    
    -- Get current balance
    SELECT balance INTO v_current_balance
    FROM user_credits 
    WHERE user_id = p_user_id;
    
    IF v_current_balance IS NULL THEN
        -- Initialize credits if not exists (should not happen, but safety check)
        INSERT INTO user_credits (user_id, balance, total_earned, last_reset_at)
        VALUES (p_user_id, 0, 0, timezone('utc'::text, now()));
        v_current_balance := 0;
    END IF;
    
    IF v_current_balance < v_total_cost THEN
        -- Insufficient credits
        RETURN jsonb_build_object(
            'success', false,
            'error', 'insufficient_credits',
            'required', v_total_cost,
            'available', v_current_balance,
            'message', format('Insufficient credits. Need %s but only have %s.', v_total_cost, v_current_balance)
        );
    END IF;
    
    -- Deduct credits
    UPDATE user_credits 
    SET 
        balance = balance - v_total_cost,
        total_consumed = total_consumed + v_total_cost,
        updated_at = timezone('utc'::text, now())
    WHERE user_id = p_user_id;
    
    -- Record transaction
    INSERT INTO credit_transactions (
        user_id,
        type,
        amount,
        balance_before,
        balance_after,
        description,
        reference_type,
        metadata
    ) VALUES (
        p_user_id,
        'consumed',
        v_total_cost,
        v_current_balance,
        v_current_balance - v_total_cost,
        format('%s (%s job%s)', v_feature_description, p_jobs_count, CASE WHEN p_jobs_count > 1 THEN 's' ELSE '' END),
        'job_search',
        jsonb_build_object('jobs_count', p_jobs_count, 'cost_per_job', v_cost_per_job)
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'credits_deducted', v_total_cost,
        'remaining_balance', v_current_balance - v_total_cost,
        'jobs_count', p_jobs_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deduct credits for auto apply
-- Returns JSON with success status and remaining balance
CREATE OR REPLACE FUNCTION "public"."deduct_auto_apply_credits"(
    p_user_id uuid,
    p_jobs_count integer DEFAULT 1
) RETURNS jsonb AS $$
DECLARE
    v_cost_per_job integer := 5; -- 5 credits per auto apply (from credit_costs table)
    v_total_cost integer;
    v_current_balance integer;
    v_feature_description text := 'Auto apply to job';
BEGIN
    -- Calculate total cost
    v_total_cost := v_cost_per_job * p_jobs_count;
    
    -- Get current balance
    SELECT balance INTO v_current_balance
    FROM user_credits 
    WHERE user_id = p_user_id;
    
    IF v_current_balance IS NULL THEN
        -- Initialize credits if not exists (should not happen, but safety check)
        INSERT INTO user_credits (user_id, balance, total_earned, last_reset_at)
        VALUES (p_user_id, 0, 0, timezone('utc'::text, now()));
        v_current_balance := 0;
    END IF;
    
    IF v_current_balance < v_total_cost THEN
        -- Insufficient credits
        RETURN jsonb_build_object(
            'success', false,
            'error', 'insufficient_credits',
            'required', v_total_cost,
            'available', v_current_balance,
            'message', format('Insufficient credits. Need %s but only have %s.', v_total_cost, v_current_balance)
        );
    END IF;
    
    -- Deduct credits
    UPDATE user_credits 
    SET 
        balance = balance - v_total_cost,
        total_consumed = total_consumed + v_total_cost,
        updated_at = timezone('utc'::text, now())
    WHERE user_id = p_user_id;
    
    -- Record transaction
    INSERT INTO credit_transactions (
        user_id,
        type,
        amount,
        balance_before,
        balance_after,
        description,
        reference_type,
        metadata
    ) VALUES (
        p_user_id,
        'consumed',
        v_total_cost,
        v_current_balance,
        v_current_balance - v_total_cost,
        format('%s (%s application%s)', v_feature_description, p_jobs_count, CASE WHEN p_jobs_count > 1 THEN 's' ELSE '' END),
        'auto_apply',
        jsonb_build_object('jobs_count', p_jobs_count, 'cost_per_job', v_cost_per_job)
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'credits_deducted', v_total_cost,
        'remaining_balance', v_current_balance - v_total_cost,
        'jobs_count', p_jobs_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has enough credits before action
CREATE OR REPLACE FUNCTION "public"."check_credits_available"(
    p_user_id uuid,
    p_feature_type text, -- 'job_search' or 'auto_apply'
    p_quantity integer DEFAULT 1
) RETURNS jsonb AS $$
DECLARE
    v_cost_per_item integer;
    v_total_cost integer;
    v_current_balance integer;
BEGIN
    -- Determine cost based on feature type
    IF p_feature_type = 'job_search' THEN
        v_cost_per_item := 1;
    ELSIF p_feature_type = 'auto_apply' THEN
        v_cost_per_item := 5;
    ELSE
        RETURN jsonb_build_object(
            'available', false,
            'error', 'invalid_feature_type',
            'message', format('Invalid feature type: %s', p_feature_type)
        );
    END IF;
    
    v_total_cost := v_cost_per_item * p_quantity;
    
    -- Get current balance
    SELECT balance INTO v_current_balance
    FROM user_credits 
    WHERE user_id = p_user_id;
    
    IF v_current_balance IS NULL THEN
        v_current_balance := 0;
    END IF;
    
    RETURN jsonb_build_object(
        'available', v_current_balance >= v_total_cost,
        'current_balance', v_current_balance,
        'required', v_total_cost,
        'cost_per_item', v_cost_per_item,
        'quantity', p_quantity,
        'feature_type', p_feature_type
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION "public"."deduct_job_search_credits"(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."deduct_auto_apply_credits"(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."check_credits_available"(uuid, text, integer) TO authenticated;

-- Comments for documentation
COMMENT ON FUNCTION "public"."deduct_job_search_credits"(uuid, integer) IS 'Deducts 1 credit per job searched. Returns success status and remaining balance.';
COMMENT ON FUNCTION "public"."deduct_auto_apply_credits"(uuid, integer) IS 'Deducts 5 credits per auto apply. Returns success status and remaining balance.';
COMMENT ON FUNCTION "public"."check_credits_available"(uuid, text, integer) IS 'Checks if user has enough credits before performing an action. Does not deduct credits.';
