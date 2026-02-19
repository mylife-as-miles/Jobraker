-- Enforce job search limits based on subscription tier
-- Free: 10 jobs, Pro: 50 jobs, Ultimate: 100 jobs

-- Create a table to track job search usage per user
CREATE TABLE IF NOT EXISTS user_job_search_usage (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    search_count integer DEFAULT 0 NOT NULL,
    last_reset_at timestamp with time zone DEFAULT NOW() NOT NULL,
    created_at timestamp with time zone DEFAULT NOW() NOT NULL,
    updated_at timestamp with time zone DEFAULT NOW() NOT NULL,
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_job_search_usage ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own usage
CREATE POLICY "Users can view their own job search usage"
ON user_job_search_usage
FOR SELECT
USING (auth.uid() = user_id);

-- Function to get job search limit based on subscription tier
CREATE OR REPLACE FUNCTION get_job_search_limit(p_user_id uuid)
RETURNS integer AS $$
DECLARE
    v_tier text;
    v_limit integer;
BEGIN
    -- Get user's subscription tier
    SELECT sp.name INTO v_tier
    FROM user_subscriptions us
    JOIN subscription_plans sp ON sp.id = us.subscription_plan_id
    WHERE us.user_id = p_user_id 
    AND us.status = 'active'
    ORDER BY us.created_at DESC
    LIMIT 1;
    
    -- Default to Free tier if no subscription found
    v_tier := COALESCE(v_tier, 'Free');
    
    -- Set limit based on tier
    CASE v_tier
        WHEN 'Ultimate' THEN v_limit := 100;
        WHEN 'Pro' THEN v_limit := 50;
        ELSE v_limit := 10;  -- Free tier
    END CASE;
    
    RETURN v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can search for jobs
CREATE OR REPLACE FUNCTION can_search_jobs(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_current_count integer;
    v_limit integer;
    v_last_reset timestamp with time zone;
    v_can_search boolean;
    v_tier text;
BEGIN
    -- Get user's tier
    SELECT sp.name INTO v_tier
    FROM user_subscriptions us
    JOIN subscription_plans sp ON sp.id = us.subscription_plan_id
    WHERE us.user_id = p_user_id 
    AND us.status = 'active'
    ORDER BY us.created_at DESC
    LIMIT 1;
    
    v_tier := COALESCE(v_tier, 'Free');
    
    -- Get job search limit
    v_limit := get_job_search_limit(p_user_id);
    
    -- Get or create usage record
    SELECT search_count, last_reset_at INTO v_current_count, v_last_reset
    FROM user_job_search_usage
    WHERE user_id = p_user_id;
    
    -- If no record exists, create one
    IF v_current_count IS NULL THEN
        INSERT INTO user_job_search_usage (user_id, search_count, last_reset_at)
        VALUES (p_user_id, 0, NOW())
        RETURNING search_count, last_reset_at INTO v_current_count, v_last_reset;
    END IF;
    
    -- Reset count if it's been a month since last reset
    IF v_last_reset < NOW() - INTERVAL '1 month' THEN
        UPDATE user_job_search_usage
        SET search_count = 0, last_reset_at = NOW(), updated_at = NOW()
        WHERE user_id = p_user_id;
        v_current_count := 0;
    END IF;
    
    -- Check if user can search
    v_can_search := v_current_count < v_limit;
    
    RETURN jsonb_build_object(
        'can_search', v_can_search,
        'current_count', v_current_count,
        'limit', v_limit,
        'remaining', GREATEST(0, v_limit - v_current_count),
        'tier', v_tier,
        'reset_date', (v_last_reset + INTERVAL '1 month')::text
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment job search count
CREATE OR REPLACE FUNCTION increment_job_search_count(p_user_id uuid, p_job_count integer DEFAULT 1)
RETURNS jsonb AS $$
DECLARE
    v_new_count integer;
    v_limit integer;
BEGIN
    -- Get limit
    v_limit := get_job_search_limit(p_user_id);
    
    -- Increment count
    INSERT INTO user_job_search_usage (user_id, search_count, last_reset_at)
    VALUES (p_user_id, p_job_count, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        search_count = user_job_search_usage.search_count + p_job_count,
        updated_at = NOW()
    RETURNING search_count INTO v_new_count;
    
    RETURN jsonb_build_object(
        'success', true,
        'new_count', v_new_count,
        'limit', v_limit,
        'remaining', GREATEST(0, v_limit - v_new_count)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Initialize usage records for existing users
INSERT INTO user_job_search_usage (user_id, search_count, last_reset_at)
SELECT id, 0, NOW()
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Verification query
SELECT 
    'Setup complete!' as status,
    COUNT(*) as total_users,
    COUNT(CASE WHEN search_count = 0 THEN 1 END) as users_with_zero_searches
FROM user_job_search_usage;
