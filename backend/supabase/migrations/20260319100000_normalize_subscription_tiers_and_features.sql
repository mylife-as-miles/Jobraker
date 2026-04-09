-- Normalize subscription tiers, plan features, and DB tier enforcement.
-- Canonical tier order: Free < Basics < Pro < Ultimate.

UPDATE public.subscription_plans
SET
    price = CASE name
        WHEN 'Free' THEN 0
        WHEN 'Basics' THEN 14
        WHEN 'Pro' THEN 49
        WHEN 'Ultimate' THEN 199
        ELSE price
    END,
    credits_per_month = CASE name
        WHEN 'Free' THEN 10
        WHEN 'Basics' THEN 200
        WHEN 'Pro' THEN 1000
        WHEN 'Ultimate' THEN 5000
        ELSE credits_per_month
    END,
    description = CASE name
        WHEN 'Free' THEN 'Core job-search tools for getting started'
        WHEN 'Basics' THEN 'AI-assisted application prep for active job seekers'
        WHEN 'Pro' THEN 'Advanced coaching and analytics for serious search velocity'
        WHEN 'Ultimate' THEN 'Full automation and integration access for power users'
        ELSE description
    END,
    sort_order = CASE name
        WHEN 'Free' THEN 0
        WHEN 'Basics' THEN 1
        WHEN 'Pro' THEN 2
        WHEN 'Ultimate' THEN 3
        ELSE sort_order
    END,
    features = CASE name
        WHEN 'Free' THEN jsonb_build_array(
            jsonb_build_object('name', 'Job Search', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'Resume Builder', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'Resume Storage', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'Resume Import & Parsing', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'Cover Letter Builder', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'Application Tracking', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'Email Notifications', 'value', 'Included', 'included', true)
        )
        WHEN 'Basics' THEN jsonb_build_array(
            jsonb_build_object('name', 'Everything in Free', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'Credits', 'value', '200 per month', 'included', true),
            jsonb_build_object('name', 'AI Match Score', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'AI Resume Optimization', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'AI Cover Letter Generation & Polish', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'Auto Apply', 'value', 'Included', 'included', true)
        )
        WHEN 'Pro' THEN jsonb_build_array(
            jsonb_build_object('name', 'Everything in Basics', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'Credits', 'value', '1,000 per month', 'included', true),
            jsonb_build_object('name', 'AI Chat Assistant', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'Advanced Analytics', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'Interview Scheduling Assistant', 'value', 'Included', 'included', true)
        )
        WHEN 'Ultimate' THEN jsonb_build_array(
            jsonb_build_object('name', 'Everything in Pro', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'Credits', 'value', '5,000 per month', 'included', true),
            jsonb_build_object('name', 'Gmail Integration', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'Custom Integrations', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'Priority Support', 'value', 'Included', 'included', true)
        )
        ELSE features
    END,
    updated_at = NOW()
WHERE name IN ('Free', 'Basics', 'Pro', 'Ultimate');

UPDATE public.credit_costs
SET
    cost = 0,
    description = 'AI-powered job match score analysis (Basics+ plan, no credits)',
    updated_at = NOW()
WHERE feature_type = 'job_search'
  AND feature_name = 'job_match_analysis';

UPDATE public.credit_costs
SET
    cost = 0,
    description = 'Generate personalized cover letters with AI (Basics+ plan, no credits)',
    updated_at = NOW()
WHERE feature_type = 'cover_letter'
  AND feature_name = 'ai_generation';

UPDATE public.credit_costs
SET
    cost = 0,
    description = 'Polish cover letter content with AI (Basics+ plan, no credits)',
    updated_at = NOW()
WHERE feature_type = 'cover_letter'
  AND feature_name = 'optimization';

INSERT INTO public.credit_costs (
    feature_type,
    feature_name,
    cost,
    description,
    is_active
) VALUES (
    'ai_chat',
    'chat_message',
    0,
    'AI chat assistant (Pro+ plan, no credits)',
    true
)
ON CONFLICT (feature_type, feature_name)
DO UPDATE SET
    cost = EXCLUDED.cost,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

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
              ON us.plan_id = sp.id
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

    v_tier_rank := CASE v_user_tier
        WHEN 'Free' THEN 1
        WHEN 'Basics' THEN 2
        WHEN 'Pro' THEN 3
        WHEN 'Ultimate' THEN 4
        ELSE 1
    END;

    v_required_rank := CASE p_required_tier
        WHEN 'Free' THEN 1
        WHEN 'Basics' THEN 2
        WHEN 'Pro' THEN 3
        WHEN 'Ultimate' THEN 4
        ELSE 1
    END;

    RETURN v_tier_rank >= v_required_rank;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.consume_credits(
    p_user_id uuid,
    p_feature_type text,
    p_feature_name text,
    p_reference_id uuid DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS boolean AS $$
DECLARE
    v_cost integer;
    v_current_balance integer;
    v_feature_description text;
    v_user_tier text;
    v_tier_check boolean;
BEGIN
    v_user_tier := public.get_user_tier(p_user_id);

    IF p_feature_type = 'job_search' AND p_feature_name = 'job_match_analysis' THEN
        v_tier_check := public.check_tier_access(p_user_id, 'Basics');
        IF NOT v_tier_check THEN
            RAISE EXCEPTION 'Match score analysis requires Basics, Pro, or Ultimate subscription';
        END IF;
    END IF;

    IF p_feature_type = 'cover_letter' AND p_feature_name IN ('ai_generation', 'optimization') THEN
        v_tier_check := public.check_tier_access(p_user_id, 'Basics');
        IF NOT v_tier_check THEN
            RAISE EXCEPTION 'Cover letter AI features require Basics, Pro, or Ultimate subscription';
        END IF;
    END IF;

    IF p_feature_type = 'ai_chat' THEN
        v_tier_check := public.check_tier_access(p_user_id, 'Pro');
        IF NOT v_tier_check THEN
            RAISE EXCEPTION 'AI Chat assistant requires Pro or Ultimate subscription';
        END IF;
    END IF;

    SELECT cost, description
    INTO v_cost, v_feature_description
    FROM public.credit_costs
    WHERE feature_type = p_feature_type
      AND feature_name = p_feature_name
      AND is_active = true;

    IF v_cost IS NULL THEN
        RAISE EXCEPTION 'Feature not found or inactive: %.%', p_feature_type, p_feature_name;
    END IF;

    SELECT balance INTO v_current_balance
    FROM public.user_credits
    WHERE user_id = p_user_id;

    IF v_current_balance IS NULL OR v_current_balance < v_cost THEN
        RETURN false;
    END IF;

    UPDATE public.user_credits
    SET
        balance = balance - v_cost,
        total_consumed = total_consumed + v_cost,
        updated_at = timezone('utc'::text, now())
    WHERE user_id = p_user_id;

    INSERT INTO public.credit_transactions (
        user_id,
        type,
        amount,
        balance_before,
        balance_after,
        description,
        reference_type,
        reference_id,
        metadata
    ) VALUES (
        p_user_id,
        'consumed',
        v_cost,
        v_current_balance,
        v_current_balance - v_cost,
        v_feature_description,
        p_feature_type,
        p_reference_id,
        jsonb_build_object('tier', v_user_tier) || p_metadata
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_tier(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_tier_access(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.get_user_tier(uuid) IS 'Resolve the canonical user subscription tier with Basics support.';
COMMENT ON FUNCTION public.check_tier_access(uuid, text) IS 'Check whether a user tier meets or exceeds the required tier.';
