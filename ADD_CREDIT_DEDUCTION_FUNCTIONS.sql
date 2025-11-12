-- Drop the functions if they already exist
DROP FUNCTION IF EXISTS deduct_job_search_credits(UUID, INTEGER);
DROP FUNCTION IF EXISTS deduct_auto_apply_credits(UUID, INTEGER);
DROP FUNCTION IF EXISTS check_credits_available(UUID, TEXT, INTEGER);

-- Create a function to deduct credits for job searches
CREATE OR REPLACE FUNCTION deduct_job_search_credits(p_user_id UUID, p_jobs_count INTEGER)
RETURNS JSON AS $$
DECLARE
    v_cost_per_job INTEGER;
    v_total_cost INTEGER;
    v_current_balance INTEGER;
    v_new_balance INTEGER;
    v_transaction_id UUID;
BEGIN
    -- Get the cost for a single job search
    SELECT cost INTO v_cost_per_job
    FROM credit_costs
    WHERE feature_type = 'job' AND feature_name = 'search';

    -- If no cost is defined, raise an exception
    IF v_cost_per_job IS NULL THEN
        RAISE EXCEPTION 'Credit cost for job search not found';
    END IF;

    -- Calculate the total cost
    v_total_cost := v_cost_per_job * p_jobs_count;

    -- Get the user's current credit balance
    SELECT balance INTO v_current_balance FROM user_credits WHERE user_id = p_user_id FOR UPDATE;

    -- If user credits not found, raise an exception
    IF v_current_balance IS NULL THEN
        RAISE EXCEPTION 'User credits not found';
    END IF;

    -- Check if the user has enough credits
    IF v_current_balance < v_total_cost THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Insufficient credits for job search',
            'required', v_total_cost,
            'available', v_current_balance
        );
    END IF;

    -- Deduct the credits
    v_new_balance := v_current_balance - v_total_cost;
    UPDATE user_credits
    SET
        balance = v_new_balance,
        lifetime_spent = lifetime_spent + v_total_cost,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Create a transaction record
    INSERT INTO credit_transactions (user_id, amount, transaction_type, description, balance_after, metadata)
    VALUES (
        p_user_id,
        -v_total_cost,
        'deduction',
        format('Used %s credits for searching %s jobs', v_total_cost, p_jobs_count),
        v_new_balance,
        jsonb_build_object('jobs_count', p_jobs_count)
    )
    RETURNING id INTO v_transaction_id;

    -- Return a success response
    RETURN json_build_object(
        'success', true,
        'credits_deducted', v_total_cost,
        'remaining_balance', v_new_balance,
        'transaction_id', v_transaction_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to deduct credits for auto-applying to jobs
CREATE OR REPLACE FUNCTION deduct_auto_apply_credits(p_user_id UUID, p_jobs_count INTEGER)
RETURNS JSON AS $$
DECLARE
    v_cost_per_job INTEGER;
    v_total_cost INTEGER;
    v_current_balance INTEGER;
    v_new_balance INTEGER;
    v_transaction_id UUID;
BEGIN
    -- Get the cost for a single job application
    SELECT cost INTO v_cost_per_job
    FROM credit_costs
    WHERE feature_type = 'job' AND feature_name = 'application';

    -- If no cost is defined, raise an exception
    IF v_cost_per_job IS NULL THEN
        RAISE EXCEPTION 'Credit cost for job application not found';
    END IF;

    -- Calculate the total cost
    v_total_cost := v_cost_per_job * p_jobs_count;

    -- Get the user's current credit balance
    SELECT balance INTO v_current_balance FROM user_credits WHERE user_id = p_user_id FOR UPDATE;

    -- If user credits not found, raise an exception
    IF v_current_balance IS NULL THEN
        RAISE EXCEPTION 'User credits not found';
    END IF;

    -- Check if the user has enough credits
    IF v_current_balance < v_total_cost THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Insufficient credits for auto apply',
            'required', v_total_cost,
            'available', v_current_balance
        );
    END IF;

    -- Deduct the credits
    v_new_balance := v_current_balance - v_total_cost;
    UPDATE user_credits
    SET
        balance = v_new_balance,
        lifetime_spent = lifetime_spent + v_total_cost,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Create a transaction record
    INSERT INTO credit_transactions (user_id, amount, transaction_type, description, balance_after, metadata)
    VALUES (
        p_user_id,
        -v_total_cost,
        'deduction',
        format('Used %s credits for auto-applying to %s jobs', v_total_cost, p_jobs_count),
        v_new_balance,
        jsonb_build_object('jobs_count', p_jobs_count)
    )
    RETURNING id INTO v_transaction_id;

    -- Return a success response
    RETURN json_build_object(
        'success', true,
        'credits_deducted', v_total_cost,
        'remaining_balance', v_new_balance,
        'transaction_id', v_transaction_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if a user has enough credits for a given feature
CREATE OR REPLACE FUNCTION check_credits_available(p_user_id UUID, p_feature_type TEXT, p_quantity INTEGER)
RETURNS JSONB AS $$
DECLARE
    v_cost_per_item INTEGER;
    v_total_cost INTEGER;
    v_current_balance INTEGER;
    v_feature_name TEXT;
BEGIN
    -- Determine the feature name based on feature type
    IF p_feature_type = 'job_search' THEN
        v_feature_name := 'search';
    ELSIF p_feature_type = 'auto_apply' THEN
        v_feature_name := 'application';
    ELSE
        RETURN jsonb_build_object('available', false, 'message', 'Invalid feature type');
    END IF;

    -- Get the cost for the specified feature
    SELECT cost INTO v_cost_per_item
    FROM credit_costs
    WHERE feature_type = 'job' AND feature_name = v_feature_name;

    -- If cost is not defined, return an error
    IF v_cost_per_item IS NULL THEN
        RETURN jsonb_build_object('available', false, 'message', 'Credit cost for ' || v_feature_name || ' not found');
    END IF;

    -- Calculate the total cost
    v_total_cost := v_cost_per_item * p_quantity;

    -- Get the user's current credit balance
    SELECT balance INTO v_current_balance
    FROM user_credits
    WHERE user_id = p_user_id;

    -- If user credits not found, they have 0 credits
    v_current_balance := COALESCE(v_current_balance, 0);

    -- Check if the user has enough credits
    IF v_current_balance >= v_total_cost THEN
        RETURN jsonb_build_object(
            'available', true,
            'required', v_total_cost,
            'current_balance', v_current_balance
        );
    ELSE
        RETURN jsonb_build_object(
            'available', false,
            'required', v_total_cost,
            'current_balance', v_current_balance,
            'shortfall', v_total_cost - v_current_balance
        );
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;
