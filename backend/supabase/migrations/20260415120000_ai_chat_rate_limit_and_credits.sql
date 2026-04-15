-- AI Chat: rate limiting, credit metering, and quota provisioning
-- 1. Update ai_chat credit cost from 0 to 1 credit per message
-- 2. Add chat_monthly_limit column to subscription_plans
-- 3. Create check_chat_rate_limit RPC (per-minute abuse prevention)
-- 4. Create consume_chat_message RPC (free quota first, then credits)
-- 5. Create get_chat_quota_status RPC (frontend display)

-- ---------------------------------------------------------------------------
-- 1. Update ai_chat credit cost to 1 credit per message
-- ---------------------------------------------------------------------------
UPDATE public.credit_costs
SET cost = 1,
    description = 'AI chat message (1 credit after free monthly allowance)',
    updated_at = NOW()
WHERE feature_type = 'ai_chat' AND feature_name = 'chat_message';

-- ---------------------------------------------------------------------------
-- 2. Add chat monthly limit to subscription_plans
-- ---------------------------------------------------------------------------
ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS chat_monthly_limit integer NOT NULL DEFAULT 0;

UPDATE public.subscription_plans
SET chat_monthly_limit = CASE name
    WHEN 'Free' THEN 0
    WHEN 'Basics' THEN 0
    WHEN 'Pro' THEN 50
    WHEN 'Ultimate' THEN 200
    ELSE 0
END,
updated_at = NOW()
WHERE name IN ('Free', 'Basics', 'Pro', 'Ultimate');

-- ---------------------------------------------------------------------------
-- 3. Per-user rate limit check (sliding window, per-minute)
--    Returns JSON with allowed + metadata for the edge function.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_chat_rate_limit(
    p_user_id UUID,
    p_tier TEXT DEFAULT 'Pro'
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_per_minute_limit INT;
    v_daily_limit INT;
    v_minute_count INT;
    v_daily_count INT;
BEGIN
    IF p_tier = 'Ultimate' THEN
        v_per_minute_limit := 40;
        v_daily_limit := 500;
    ELSE
        v_per_minute_limit := 20;
        v_daily_limit := 200;
    END IF;

    SELECT COUNT(*) INTO v_minute_count
    FROM public.feature_usage_events
    WHERE user_id = p_user_id
      AND feature_key = 'ai_chat'
      AND created_at > NOW() - INTERVAL '1 minute';

    SELECT COUNT(*) INTO v_daily_count
    FROM public.feature_usage_events
    WHERE user_id = p_user_id
      AND feature_key = 'ai_chat'
      AND created_at > NOW() - INTERVAL '1 day';

    IF v_minute_count >= v_per_minute_limit THEN
        RETURN json_build_object(
            'allowed', false,
            'reason', 'rate_limit',
            'message', 'Too many messages. Please wait a moment before sending another.',
            'retry_after_seconds', 60
        );
    END IF;

    IF v_daily_count >= v_daily_limit THEN
        RETURN json_build_object(
            'allowed', false,
            'reason', 'daily_limit',
            'message', 'You have reached your daily message limit. Please try again tomorrow.',
            'retry_after_seconds', 3600
        );
    END IF;

    RETURN json_build_object(
        'allowed', true,
        'minute_count', v_minute_count,
        'daily_count', v_daily_count,
        'minute_limit', v_per_minute_limit,
        'daily_limit', v_daily_limit
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Consume a chat message: check free quota first, then deduct credits
--    Returns JSON with success status and remaining info.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_chat_message(
    p_user_id UUID
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_subscription RECORD;
    v_period_start TIMESTAMPTZ;
    v_period_end TIMESTAMPTZ;
    v_quota RECORD;
    v_remaining_free INT := 0;
    v_credit_balance INT := 0;
    v_new_balance INT;
BEGIN
    -- Look up active subscription with chat limit
    SELECT
        us.current_period_start,
        us.current_period_end,
        us.created_at,
        sp.name AS plan_name,
        COALESCE(sp.chat_monthly_limit, 0) AS chat_limit
    INTO v_subscription
    FROM public.user_subscriptions us
    JOIN public.subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = p_user_id
      AND us.status = 'active'
    ORDER BY us.created_at DESC
    LIMIT 1;

    IF NOT FOUND OR COALESCE(v_subscription.chat_limit, 0) <= 0 THEN
        -- No free quota available; go straight to credit deduction
        SELECT balance INTO v_credit_balance
        FROM public.user_credits
        WHERE user_id = p_user_id;

        IF v_credit_balance IS NULL OR v_credit_balance < 1 THEN
            RETURN json_build_object(
                'success', false,
                'reason', 'insufficient_credits',
                'message', 'You don''t have enough credits. Purchase more credits to continue chatting.',
                'balance', COALESCE(v_credit_balance, 0),
                'free_remaining', 0
            );
        END IF;

        UPDATE public.user_credits
        SET balance = balance - 1,
            total_consumed = COALESCE(total_consumed, 0) + 1,
            updated_at = NOW()
        WHERE user_id = p_user_id
        RETURNING balance INTO v_new_balance;

        INSERT INTO public.credit_transactions (
            user_id, type, amount, balance_before, balance_after,
            description, reference_type
        ) VALUES (
            p_user_id, 'consumed', 1, v_new_balance + 1, v_new_balance,
            'AI chat message', 'ai_chat'
        );

        INSERT INTO public.feature_usage_events (
            user_id, feature_key, quantity, reference_type, metadata
        ) VALUES (
            p_user_id, 'ai_chat', 1, 'credit',
            jsonb_build_object('source', 'credits')
        );

        RETURN json_build_object(
            'success', true,
            'source', 'credits',
            'credits_used', 1,
            'balance', v_new_balance,
            'free_remaining', 0
        );
    END IF;

    -- Has subscription with free quota; upsert quota row for current period
    v_period_start := COALESCE(v_subscription.current_period_start, date_trunc('month', NOW()));
    v_period_end := COALESCE(v_subscription.current_period_end, v_period_start + INTERVAL '1 month');

    INSERT INTO public.user_feature_quotas (
        user_id, feature_key, source, period_start, period_end,
        included_quantity, metadata
    ) VALUES (
        p_user_id, 'ai_chat', 'subscription', v_period_start, v_period_end,
        v_subscription.chat_limit,
        jsonb_build_object('plan_name', v_subscription.plan_name)
    )
    ON CONFLICT (user_id, feature_key, source, period_start, period_end)
    DO UPDATE SET
        included_quantity = EXCLUDED.included_quantity,
        metadata = EXCLUDED.metadata,
        updated_at = NOW();

    SELECT *
    INTO v_quota
    FROM public.user_feature_quotas
    WHERE user_id = p_user_id
      AND feature_key = 'ai_chat'
      AND source = 'subscription'
      AND period_start = v_period_start
      AND period_end = v_period_end
    FOR UPDATE;

    v_remaining_free := GREATEST(v_quota.included_quantity - v_quota.used_quantity, 0);

    IF v_remaining_free > 0 THEN
        -- Use free quota
        UPDATE public.user_feature_quotas
        SET used_quantity = used_quantity + 1,
            updated_at = NOW()
        WHERE id = v_quota.id;

        INSERT INTO public.feature_usage_events (
            user_id, feature_key, quantity, reference_type, metadata
        ) VALUES (
            p_user_id, 'ai_chat', 1, 'quota',
            jsonb_build_object('source', 'free_quota', 'plan_name', v_subscription.plan_name)
        );

        RETURN json_build_object(
            'success', true,
            'source', 'free_quota',
            'credits_used', 0,
            'free_remaining', v_remaining_free - 1,
            'free_total', v_quota.included_quantity,
            'period_end', v_quota.period_end
        );
    END IF;

    -- Free quota exhausted; deduct 1 credit
    SELECT balance INTO v_credit_balance
    FROM public.user_credits
    WHERE user_id = p_user_id;

    IF v_credit_balance IS NULL OR v_credit_balance < 1 THEN
        RETURN json_build_object(
            'success', false,
            'reason', 'insufficient_credits',
            'message', 'Your free messages are used up and you don''t have enough credits. Purchase more to continue.',
            'balance', COALESCE(v_credit_balance, 0),
            'free_remaining', 0,
            'free_total', v_quota.included_quantity
        );
    END IF;

    UPDATE public.user_credits
    SET balance = balance - 1,
        total_consumed = COALESCE(total_consumed, 0) + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_balance;

    INSERT INTO public.credit_transactions (
        user_id, type, amount, balance_before, balance_after,
        description, reference_type
    ) VALUES (
        p_user_id, 'consumed', 1, v_new_balance + 1, v_new_balance,
        'AI chat message (free quota exhausted)', 'ai_chat'
    );

    INSERT INTO public.feature_usage_events (
        user_id, feature_key, quantity, reference_type, metadata
    ) VALUES (
        p_user_id, 'ai_chat', 1, 'credit',
        jsonb_build_object('source', 'credits', 'plan_name', v_subscription.plan_name)
    );

    RETURN json_build_object(
        'success', true,
        'source', 'credits',
        'credits_used', 1,
        'balance', v_new_balance,
        'free_remaining', 0,
        'free_total', v_quota.included_quantity,
        'period_end', v_quota.period_end
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Get chat quota status for frontend display
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_chat_quota_status(
    p_user_id UUID
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_subscription RECORD;
    v_period_start TIMESTAMPTZ;
    v_period_end TIMESTAMPTZ;
    v_quota RECORD;
    v_credit_balance INT := 0;
BEGIN
    SELECT balance INTO v_credit_balance
    FROM public.user_credits
    WHERE user_id = p_user_id;

    SELECT
        us.current_period_start,
        us.current_period_end,
        sp.name AS plan_name,
        COALESCE(sp.chat_monthly_limit, 0) AS chat_limit
    INTO v_subscription
    FROM public.user_subscriptions us
    JOIN public.subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = p_user_id
      AND us.status = 'active'
    ORDER BY us.created_at DESC
    LIMIT 1;

    IF NOT FOUND OR COALESCE(v_subscription.chat_limit, 0) <= 0 THEN
        RETURN json_build_object(
            'free_remaining', 0,
            'free_total', 0,
            'credit_balance', COALESCE(v_credit_balance, 0),
            'plan_name', COALESCE(v_subscription.plan_name, 'Free')
        );
    END IF;

    v_period_start := COALESCE(v_subscription.current_period_start, date_trunc('month', NOW()));
    v_period_end := COALESCE(v_subscription.current_period_end, v_period_start + INTERVAL '1 month');

    SELECT *
    INTO v_quota
    FROM public.user_feature_quotas
    WHERE user_id = p_user_id
      AND feature_key = 'ai_chat'
      AND source = 'subscription'
      AND period_start = v_period_start
      AND period_end = v_period_end;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'free_remaining', v_subscription.chat_limit,
            'free_total', v_subscription.chat_limit,
            'credit_balance', COALESCE(v_credit_balance, 0),
            'plan_name', v_subscription.plan_name,
            'period_end', v_period_end
        );
    END IF;

    RETURN json_build_object(
        'free_remaining', GREATEST(v_quota.included_quantity - v_quota.used_quantity, 0),
        'free_total', v_quota.included_quantity,
        'used', v_quota.used_quantity,
        'credit_balance', COALESCE(v_credit_balance, 0),
        'plan_name', v_subscription.plan_name,
        'period_end', v_quota.period_end
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.check_chat_rate_limit(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_chat_message(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_chat_quota_status(UUID) TO authenticated, service_role;
