CREATE OR REPLACE FUNCTION public.expire_stale_subscriptions()
RETURNS integer AS $$
DECLARE
    v_expired_count integer := 0;
BEGIN
    WITH expired AS (
        UPDATE public.user_subscriptions
        SET
            status = 'canceled',
            cancel_at_period_end = true,
            updated_at = NOW()
        WHERE status = 'active'
          AND current_period_end <= NOW()
        RETURNING id, user_id, current_period_end
    ),
    affected_users AS (
        SELECT DISTINCT user_id
        FROM expired
    ),
    downgraded_profiles AS (
        UPDATE public.profiles p
        SET
            subscription_tier = 'Free',
            updated_at = NOW()
        FROM affected_users au
        WHERE p.id = au.user_id
          AND NOT EXISTS (
              SELECT 1
              FROM public.user_subscriptions us
              WHERE us.user_id = au.user_id
                AND us.status = 'active'
                AND us.current_period_end > NOW()
          )
        RETURNING p.id
    ),
    expiry_notifications AS (
        INSERT INTO public.notifications (
            user_id,
            type,
            title,
            message,
            priority,
            action_url,
            action_label,
            source,
            source_record_id,
            source_record_type,
            metadata,
            dedupe_key
        )
        SELECT
            e.user_id,
            'credit',
            'Subscription expired',
            'Your Jobraker subscription period has ended. Renew from Billing to restore paid plan access.',
            'high',
            '/dashboard/billing',
            'Renew subscription',
            'billing',
            e.id,
            'user_subscription',
            jsonb_build_object('current_period_end', e.current_period_end),
            'subscription-expired-' || e.id::text
        FROM expired e
        ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
        RETURNING id
    )
    SELECT COUNT(*) INTO v_expired_count
    FROM expired;

    RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_tier(
    p_user_id uuid
) RETURNS text AS $$
DECLARE
    v_tier text;
BEGIN
    PERFORM public.expire_stale_subscriptions();

    SELECT COALESCE(
        (
            SELECT sp.name
            FROM public.user_subscriptions us
            JOIN public.subscription_plans sp
              ON us.subscription_plan_id = sp.id
            WHERE us.user_id = p_user_id
              AND us.status = 'active'
              AND us.current_period_end > NOW()
            ORDER BY us.created_at DESC
            LIMIT 1
        ),
        'Free'
    ) INTO v_tier;

    RETURN v_tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_tier_access(
    p_user_id uuid,
    p_required_tier text
) RETURNS boolean AS $$
DECLARE
    v_user_tier text;
    v_tier_rank integer;
    v_required_rank integer;
BEGIN
    v_user_tier := public.get_user_tier(p_user_id);

    v_tier_rank := CASE public.normalize_tier(v_user_tier)
        WHEN 'Free' THEN 0
        WHEN 'Basics' THEN 1
        WHEN 'Pro' THEN 2
        WHEN 'Ultimate' THEN 3
        ELSE 0
    END;

    v_required_rank := CASE public.normalize_tier(p_required_tier)
        WHEN 'Free' THEN 0
        WHEN 'Basics' THEN 1
        WHEN 'Pro' THEN 2
        WHEN 'Ultimate' THEN 3
        ELSE 0
    END;

    RETURN v_tier_rank >= v_required_rank;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.expire_stale_subscriptions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_subscriptions() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_tier(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_tier_access(uuid, text) TO authenticated;

SELECT public.expire_stale_subscriptions();
