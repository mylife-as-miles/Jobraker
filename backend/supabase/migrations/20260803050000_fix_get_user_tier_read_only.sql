-- Migration: Fix get_user_tier to be a pure STABLE function (removes mutating expire_stale_subscriptions call)
-- This eliminates "cannot execute SELECT in a read-only transaction" errors during get_ai_usage_status and read queries.

CREATE OR REPLACE FUNCTION public.get_user_tier(
    p_user_id UUID
) RETURNS TEXT AS $$
DECLARE
    v_tier TEXT;
BEGIN
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.get_user_tier(UUID) TO authenticated, service_role, anon;
COMMENT ON FUNCTION public.get_user_tier(UUID) IS 'Pure read-only helper to resolve user subscription tier.';
