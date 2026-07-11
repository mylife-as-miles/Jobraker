-- Migration: Add Basics tier support to get_job_search_limit function and repair quota joins and monthly refills.

CREATE OR REPLACE FUNCTION public.get_job_search_limit(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tier text;
BEGIN
    SELECT sp.name
    INTO v_tier
    FROM public.user_subscriptions us
    JOIN public.subscription_plans sp ON sp.id = us.subscription_plan_id
    WHERE us.user_id = p_user_id
      AND us.status = 'active'
    ORDER BY us.created_at DESC
    LIMIT 1;

    RETURN CASE COALESCE(v_tier, 'Free')
        WHEN 'Ultimate' THEN 100
        WHEN 'Pro' THEN 50
        WHEN 'Basics' THEN 25
        ELSE 10
    END;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_auto_apply_quota(
    p_user_id uuid,
    p_requested_quantity integer DEFAULT 1
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_subscription record;
    v_period_start timestamptz;
    v_period_end timestamptz;
    v_quota record;
    v_remaining integer := 0;
BEGIN
    IF p_requested_quantity <= 0 THEN
        RETURN json_build_object('available', false, 'required', p_requested_quantity, 'remaining', 0, 'message', 'Requested quantity must be greater than 0.');
    END IF;

    SELECT us.current_period_start, us.current_period_end, us.created_at,
           sp.name AS plan_name, COALESCE(sp.auto_apply_monthly_limit, 0) AS included_quantity
    INTO v_subscription
    FROM public.user_subscriptions us
    JOIN public.subscription_plans sp ON us.subscription_plan_id = sp.id
    WHERE us.user_id = p_user_id AND us.status = 'active'
    ORDER BY us.created_at DESC
    LIMIT 1;

    IF NOT FOUND OR COALESCE(v_subscription.included_quantity, 0) <= 0 THEN
        RETURN json_build_object('available', false, 'required', p_requested_quantity, 'remaining', 0, 'included', 0, 'used', 0, 'message', 'Auto apply requires an active paid subscription with automation included.');
    END IF;

    v_period_start := COALESCE(v_subscription.current_period_start, date_trunc('month', now()));
    v_period_end := COALESCE(v_subscription.current_period_end, v_period_start + interval '1 month');

    INSERT INTO public.user_feature_quotas (user_id, feature_key, source, period_start, period_end, included_quantity, metadata)
    VALUES (p_user_id, 'auto_apply', 'subscription', v_period_start, v_period_end, v_subscription.included_quantity, jsonb_build_object('plan_name', v_subscription.plan_name))
    ON CONFLICT (user_id, feature_key, source, period_start, period_end)
    DO UPDATE SET included_quantity = EXCLUDED.included_quantity, metadata = EXCLUDED.metadata, updated_at = now()
    RETURNING * INTO v_quota;

    v_remaining := GREATEST(v_quota.included_quantity - v_quota.used_quantity, 0);
    RETURN json_build_object('available', v_remaining >= p_requested_quantity, 'required', p_requested_quantity, 'remaining', v_remaining, 'included', v_quota.included_quantity, 'used', v_quota.used_quantity, 'period_end', v_quota.period_end, 'plan_name', v_subscription.plan_name);
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_auto_apply_quota(
    p_user_id uuid,
    p_requested_quantity integer DEFAULT 1,
    p_reference_id uuid DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_subscription record;
    v_period_start timestamptz;
    v_period_end timestamptz;
    v_quota record;
    v_remaining integer := 0;
BEGIN
    IF p_requested_quantity <= 0 THEN
        RETURN json_build_object('success', false, 'required', p_requested_quantity, 'remaining', 0, 'message', 'Requested quantity must be greater than 0.');
    END IF;

    SELECT us.current_period_start, us.current_period_end, us.created_at,
           sp.name AS plan_name, COALESCE(sp.auto_apply_monthly_limit, 0) AS included_quantity
    INTO v_subscription
    FROM public.user_subscriptions us
    JOIN public.subscription_plans sp ON us.subscription_plan_id = sp.id
    WHERE us.user_id = p_user_id AND us.status = 'active'
    ORDER BY us.created_at DESC
    LIMIT 1;

    IF NOT FOUND OR COALESCE(v_subscription.included_quantity, 0) <= 0 THEN
        RETURN json_build_object('success', false, 'required', p_requested_quantity, 'remaining', 0, 'message', 'Auto apply requires an active paid subscription with automation included.');
    END IF;

    v_period_start := COALESCE(v_subscription.current_period_start, date_trunc('month', now()));
    v_period_end := COALESCE(v_subscription.current_period_end, v_period_start + interval '1 month');

    INSERT INTO public.user_feature_quotas (user_id, feature_key, source, period_start, period_end, included_quantity, metadata)
    VALUES (p_user_id, 'auto_apply', 'subscription', v_period_start, v_period_end, v_subscription.included_quantity, jsonb_build_object('plan_name', v_subscription.plan_name))
    ON CONFLICT (user_id, feature_key, source, period_start, period_end)
    DO UPDATE SET included_quantity = EXCLUDED.included_quantity, metadata = EXCLUDED.metadata, updated_at = now();

    SELECT * INTO v_quota
    FROM public.user_feature_quotas
    WHERE user_id = p_user_id AND feature_key = 'auto_apply' AND source = 'subscription'
      AND period_start = v_period_start AND period_end = v_period_end
    FOR UPDATE;

    v_remaining := GREATEST(v_quota.included_quantity - v_quota.used_quantity, 0);
    IF v_remaining < p_requested_quantity THEN
        RETURN json_build_object('success', false, 'required', p_requested_quantity, 'remaining', v_remaining, 'included', v_quota.included_quantity, 'used', v_quota.used_quantity, 'period_end', v_quota.period_end, 'plan_name', v_subscription.plan_name, 'message', 'Not enough auto apply runs remaining for this billing period.');
    END IF;

    UPDATE public.user_feature_quotas
    SET used_quantity = used_quantity + p_requested_quantity,
        updated_at = now(),
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('last_consumed_at', now())
    WHERE id = v_quota.id
    RETURNING * INTO v_quota;

    INSERT INTO public.feature_usage_events (user_id, feature_key, quantity, reference_type, reference_id, metadata)
    VALUES (p_user_id, 'auto_apply', p_requested_quantity, 'auto_apply', p_reference_id, COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('plan_name', v_subscription.plan_name));

    RETURN json_build_object('success', true, 'quantity_consumed', p_requested_quantity, 'remaining', GREATEST(v_quota.included_quantity - v_quota.used_quantity, 0), 'included', v_quota.included_quantity, 'used', v_quota.used_quantity, 'period_end', v_quota.period_end, 'plan_name', v_subscription.plan_name);
END;
$$;

CREATE OR REPLACE FUNCTION public.add_credits(
    p_user_id uuid,
    p_amount integer,
    p_description text,
    p_reference_type text,
    p_reference_id uuid DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_balance integer;
    v_previous_balance integer;
    v_transaction_kind text;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN json_build_object('success', false, 'message', 'Amount must be greater than 0');
    END IF;

    INSERT INTO public.user_credits (user_id, balance, lifetime_earned, last_refill)
    VALUES (p_user_id, p_amount, p_amount, CASE WHEN p_reference_type = 'subscription' THEN now() ELSE NULL END)
    ON CONFLICT (user_id) DO UPDATE
    SET balance = public.user_credits.balance + EXCLUDED.balance,
        lifetime_earned = public.user_credits.lifetime_earned + EXCLUDED.lifetime_earned,
        last_refill = CASE WHEN p_reference_type = 'subscription' THEN now() ELSE public.user_credits.last_refill END,
        updated_at = now()
    RETURNING balance INTO v_new_balance;

    v_previous_balance := v_new_balance - p_amount;
    v_transaction_kind := CASE WHEN p_reference_type IN ('order', 'subscription') THEN 'refill' ELSE 'bonus' END;

    INSERT INTO public.credit_transactions (
        user_id, transaction_type, amount, balance_after, description, reference_type, reference_id, metadata
    ) VALUES (
        p_user_id, v_transaction_kind, p_amount, v_new_balance, p_description, p_reference_type, p_reference_id, p_metadata
    );

    RETURN json_build_object(
        'success', true,
        'message', 'Credits added successfully',
        'previous_balance', v_previous_balance,
        'new_balance', v_new_balance
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', 'Error adding credits: ' || SQLERRM, 'detail', SQLSTATE);
END;
$$;

CREATE OR REPLACE FUNCTION public.refill_monthly_credits()
RETURNS TABLE(user_id uuid, credits_added integer, new_balance integer)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH refill_users AS (
        SELECT uc.user_id,
               COALESCE(subscribed_plan.credits_per_month, free_plan.credits_per_month) AS credits_per_month
        FROM public.user_credits uc
        LEFT JOIN public.user_subscriptions us ON us.user_id = uc.user_id AND us.status = 'active'
        LEFT JOIN public.subscription_plans subscribed_plan ON subscribed_plan.id = us.subscription_plan_id
        LEFT JOIN public.subscription_plans free_plan ON free_plan.name = 'Free'
        WHERE uc.last_refill < now() - interval '1 month'
          AND COALESCE(subscribed_plan.credits_per_month, free_plan.credits_per_month, 0) > 0
    )
    UPDATE public.user_credits uc
    SET balance = uc.balance + ru.credits_per_month,
        lifetime_earned = uc.lifetime_earned + ru.credits_per_month,
        last_refill = now(),
        updated_at = now()
    FROM refill_users ru
    WHERE uc.user_id = ru.user_id
    RETURNING uc.user_id, ru.credits_per_month::integer, uc.balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_monthly_refill_transactions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.credit_transactions (user_id, transaction_type, amount, balance_after, description)
    SELECT uc.user_id,
           'refill',
           COALESCE(subscribed_plan.credits_per_month, free_plan.credits_per_month),
           uc.balance,
           CASE COALESCE(subscribed_plan.name, free_plan.name)
               WHEN 'Free' THEN 'Free tier monthly credit allocation - 10 credits'
               WHEN 'Basics' THEN 'Basics tier monthly credit allocation - 250 credits'
               WHEN 'Pro' THEN 'Pro tier monthly credit allocation - 1200 credits'
               WHEN 'Ultimate' THEN 'Ultimate tier monthly credit allocation - 3500 credits'
               ELSE 'Monthly credit allocation - ' || COALESCE(subscribed_plan.credits_per_month, free_plan.credits_per_month) || ' credits'
           END
    FROM public.user_credits uc
    LEFT JOIN public.user_subscriptions us ON us.user_id = uc.user_id AND us.status = 'active'
    LEFT JOIN public.subscription_plans subscribed_plan ON subscribed_plan.id = us.subscription_plan_id
    LEFT JOIN public.subscription_plans free_plan ON free_plan.name = 'Free'
    WHERE uc.updated_at > now() - interval '5 minutes'
      AND COALESCE(subscribed_plan.credits_per_month, free_plan.credits_per_month, 0) > 0
      AND NOT EXISTS (
          SELECT 1 FROM public.credit_transactions ct
          WHERE ct.user_id = uc.user_id AND ct.transaction_type = 'refill' AND ct.created_at > now() - interval '5 minutes'
      );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_job_search_limit(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_auto_apply_quota(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_auto_apply_quota(uuid, integer, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, integer, text, text, uuid, jsonb) TO service_role;
