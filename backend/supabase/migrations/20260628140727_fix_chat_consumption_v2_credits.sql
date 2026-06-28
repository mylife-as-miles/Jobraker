-- Charge paid AI chat messages through the V2 credit ledger so consumption and
-- display both use the same authoritative balance.

CREATE OR REPLACE FUNCTION public.consume_chat_message(
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
    v_remaining_free INT := 0;
    v_credit_balance INT := 0;
    v_v2_balance JSONB;
    v_charge_result JSONB;
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
        us.created_at,
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
        IF v_credit_balance < 1 THEN
            RETURN json_build_object(
                'success', false,
                'reason', 'insufficient_credits',
                'message', 'You don''t have enough credits. Purchase more credits to continue chatting.',
                'balance', COALESCE(v_credit_balance, 0),
                'free_remaining', 0
            );
        END IF;

        IF to_regprocedure('public.charge_credits_v2(uuid,integer,text,text,uuid,text,uuid,jsonb)') IS NOT NULL THEN
            EXECUTE $charge$
                SELECT public.charge_credits_v2(
                    p_user_id := $1,
                    p_amount := 1,
                    p_reference_type := 'ai_chat',
                    p_idempotency_key := $2,
                    p_description := 'AI chat message',
                    p_metadata := jsonb_build_object('source', 'credits', 'feature_key', 'ai_chat')
                )::jsonb
            $charge$
            INTO v_charge_result
            USING p_user_id, 'ai_chat:' || p_user_id::text || ':' || gen_random_uuid()::text;
        ELSE
            UPDATE public.user_credits
            SET balance = balance - 1,
                total_consumed = COALESCE(total_consumed, 0) + 1,
                updated_at = NOW()
            WHERE user_id = p_user_id
            RETURNING jsonb_build_object('success', true, 'available', balance) INTO v_charge_result;
        END IF;

        IF COALESCE((v_charge_result->>'success')::BOOLEAN, false) IS NOT TRUE THEN
            RETURN json_build_object(
                'success', false,
                'reason', COALESCE(v_charge_result->>'reason', 'insufficient_credits'),
                'message', COALESCE(v_charge_result->>'message', 'You don''t have enough credits. Purchase more credits to continue chatting.'),
                'balance', COALESCE(NULLIF(v_charge_result->>'available', '')::INT, v_credit_balance),
                'free_remaining', 0
            );
        END IF;

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
            'balance', COALESCE(NULLIF(v_charge_result->>'available', '')::INT, GREATEST(v_credit_balance - 1, 0)),
            'free_remaining', 0
        );
    END IF;

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

    IF v_credit_balance < 1 THEN
        RETURN json_build_object(
            'success', false,
            'reason', 'insufficient_credits',
            'message', 'Your free messages are used up and you don''t have enough credits. Purchase more to continue.',
            'balance', COALESCE(v_credit_balance, 0),
            'free_remaining', 0,
            'free_total', v_quota.included_quantity
        );
    END IF;

    IF to_regprocedure('public.charge_credits_v2(uuid,integer,text,text,uuid,text,uuid,jsonb)') IS NOT NULL THEN
        EXECUTE $charge$
            SELECT public.charge_credits_v2(
                p_user_id := $1,
                p_amount := 1,
                p_reference_type := 'ai_chat',
                p_idempotency_key := $2,
                p_description := 'AI chat message (free quota exhausted)',
                p_metadata := jsonb_build_object('source', 'credits', 'feature_key', 'ai_chat', 'plan_name', $3)
            )::jsonb
        $charge$
        INTO v_charge_result
        USING p_user_id, 'ai_chat:' || p_user_id::text || ':' || gen_random_uuid()::text, v_subscription.plan_name;
    ELSE
        UPDATE public.user_credits
        SET balance = balance - 1,
            total_consumed = COALESCE(total_consumed, 0) + 1,
            updated_at = NOW()
        WHERE user_id = p_user_id
        RETURNING jsonb_build_object('success', true, 'available', balance) INTO v_charge_result;
    END IF;

    IF COALESCE((v_charge_result->>'success')::BOOLEAN, false) IS NOT TRUE THEN
        RETURN json_build_object(
            'success', false,
            'reason', COALESCE(v_charge_result->>'reason', 'insufficient_credits'),
            'message', COALESCE(v_charge_result->>'message', 'Your free messages are used up and you don''t have enough credits. Purchase more to continue.'),
            'balance', COALESCE(NULLIF(v_charge_result->>'available', '')::INT, v_credit_balance),
            'free_remaining', 0,
            'free_total', v_quota.included_quantity
        );
    END IF;

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
        'balance', COALESCE(NULLIF(v_charge_result->>'available', '')::INT, GREATEST(v_credit_balance - 1, 0)),
        'free_remaining', 0,
        'free_total', v_quota.included_quantity,
        'period_end', v_quota.period_end
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_chat_message(UUID) TO authenticated, service_role;
