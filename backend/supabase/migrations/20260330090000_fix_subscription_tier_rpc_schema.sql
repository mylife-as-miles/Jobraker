CREATE OR REPLACE FUNCTION public.get_user_tier(
    p_user_id uuid
) RETURNS text AS $$
DECLARE
    v_tier text;
BEGIN
    SELECT COALESCE(
        (
            SELECT sp.name
            FROM public.user_subscriptions us
            JOIN public.subscription_plans sp
              ON us.subscription_plan_id = sp.id
            WHERE us.user_id = p_user_id
              AND us.status = 'active'
            ORDER BY us.created_at DESC
            LIMIT 1
        ),
        (
            SELECT subscription_tier
            FROM public.profiles
            WHERE id = p_user_id
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
