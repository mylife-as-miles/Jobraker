-- Make chat quota display the same authoritative V2 credit balance shown in
-- the app header and Billing page. Legacy user_credits remains a fallback for
-- databases that have not fully rolled onto the V2 credit ledger.

CREATE OR REPLACE FUNCTION public.get_chat_quota_status(
    p_user_id UUID
) RETURNS JSON
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
    v_v2_balance JSONB;
BEGIN
    IF to_regprocedure('public.get_v2_credit_balance(uuid)') IS NOT NULL THEN
        EXECUTE 'SELECT public.get_v2_credit_balance($1)::jsonb'
        INTO v_v2_balance
        USING p_user_id;

        v_credit_balance := COALESCE(
            NULLIF(v_v2_balance->>'available', '')::INT,
            NULLIF(v_v2_balance->>'total', '')::INT,
            0
        );
    ELSE
        SELECT balance INTO v_credit_balance
        FROM public.user_credits
        WHERE user_id = p_user_id;
    END IF;

    SELECT
        us.current_period_start,
        us.current_period_end,
        sp.name AS plan_name,
        COALESCE(sp.chat_monthly_limit, 0) AS chat_limit
    INTO v_subscription
    FROM public.user_subscriptions us
    JOIN public.subscription_plans sp ON us.subscription_plan_id = sp.id
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

GRANT EXECUTE ON FUNCTION public.get_chat_quota_status(UUID) TO authenticated, service_role;
