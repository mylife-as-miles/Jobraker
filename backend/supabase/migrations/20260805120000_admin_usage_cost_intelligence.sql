-- Admin-only financial usage rollups. Browser roles are intentionally denied.
-- The provider-cost ledger was introduced by a prior migration.  Development
-- and recovered environments may not have it yet, so the admin migration must
-- remain installable and surface an empty provider bucket until it exists.
DO $$ BEGIN
  IF to_regclass('public.external_provider_usage_events') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_external_provider_usage_user_created
      ON public.external_provider_usage_events (user_id, created_at DESC);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_composio_usage_user_created
  ON public.composio_usage_events (user_id, created_at DESC);

CREATE OR REPLACE VIEW public.admin_user_ai_usage_daily_v1
WITH (security_invoker = false) AS
SELECT user_id, date_trunc('day', created_at)::date AS day,
  sum(input_tokens) AS input_tokens, sum(output_tokens) AS output_tokens,
  sum(provider_cost_nanos) AS provider_cost_nanos,
  sum(billable_cost_nanos) AS billable_cost_nanos,
  sum(reserved_cost_nanos) AS reserved_cost_nanos,
  count(*) FILTER (WHERE status = 'settled') AS settled_events,
  count(*) FILTER (WHERE status = 'reserved') AS reserved_events
FROM public.ai_usage_events
GROUP BY user_id, date_trunc('day', created_at)::date;

CREATE OR REPLACE VIEW public.admin_user_provider_usage_daily_v1
WITH (security_invoker = false) AS
SELECT NULL::uuid AS user_id, NULL::text AS provider, NULL::date AS day,
  0::numeric AS provider_units, 0::numeric AS provider_cost_nanos,
  0::integer AS user_credit_cost, 0::integer AS reserved_user_credits,
  false AS reconciliation_required, false AS has_estimated_usage WHERE false;

CREATE OR REPLACE VIEW public.admin_external_user_rollup_v1
WITH (security_invoker = false) AS
SELECT NULL::uuid AS user_id, 0::integer AS credits_consumed, 0::integer AS credits_reserved,
  0::numeric AS provider_cost_nanos, false AS reconciliation_required,
  false AS estimated_usage WHERE false;

CREATE OR REPLACE VIEW public.admin_provider_cost_summary_v1
WITH (security_invoker = false) AS
SELECT NULL::text AS provider, 0::numeric AS units, 0::numeric AS provider_cost_nanos,
  0::integer AS credits_charged, 'unavailable'::text AS usage_source WHERE false;

DO $$ BEGIN
  IF to_regclass('public.external_provider_usage_events') IS NOT NULL THEN
    EXECUTE $views$
      CREATE OR REPLACE VIEW public.admin_user_provider_usage_daily_v1 WITH (security_invoker = false) AS
      SELECT user_id, provider, date_trunc('day', created_at)::date AS day,
        sum(provider_units) AS provider_units, sum(provider_cost_nanos) AS provider_cost_nanos,
        sum(user_credit_cost)::integer AS user_credit_cost, sum(reserved_user_credits)::integer AS reserved_user_credits,
        bool_or(reconciliation_required) AS reconciliation_required,
        bool_or(usage_source NOT IN ('confirmed', 'provider_reported')) AS has_estimated_usage
      FROM public.external_provider_usage_events GROUP BY user_id, provider, date_trunc('day', created_at)::date
    $views$;
    EXECUTE $views$
      CREATE OR REPLACE VIEW public.admin_external_user_rollup_v1 WITH (security_invoker = false) AS
      SELECT user_id, sum(user_credit_cost)::integer AS credits_consumed,
        coalesce(sum(reserved_user_credits) FILTER (WHERE status = 'reserved'), 0)::integer AS credits_reserved,
        sum(provider_cost_nanos) AS provider_cost_nanos, bool_or(reconciliation_required) AS reconciliation_required,
        bool_or(usage_source NOT IN ('confirmed', 'provider_reported')) AS estimated_usage
      FROM public.external_provider_usage_events WHERE created_at >= now() - interval '90 days' GROUP BY user_id
    $views$;
    EXECUTE $views$
      CREATE OR REPLACE VIEW public.admin_provider_cost_summary_v1 WITH (security_invoker = false) AS
      SELECT provider, sum(provider_units) AS units, sum(provider_cost_nanos) AS provider_cost_nanos,
        sum(user_credit_cost)::integer AS credits_charged,
        CASE WHEN bool_or(usage_source NOT IN ('confirmed', 'provider_reported')) THEN 'estimated' ELSE 'confirmed' END AS usage_source
      FROM public.external_provider_usage_events WHERE created_at >= now() - interval '90 days' GROUP BY provider
    $views$;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.admin_user_usage_summary_v1
WITH (security_invoker = false) AS
WITH subscription AS (
  SELECT DISTINCT ON (us.user_id) us.user_id, us.status, us.current_period_start, us.current_period_end, subscription_plans.name AS plan, subscription_plans.price
  FROM public.user_subscriptions AS us LEFT JOIN public.subscription_plans ON subscription_plans.id = us.subscription_plan_id
  ORDER BY us.user_id, us.created_at DESC
), ai AS (
  SELECT user_id, sum(provider_cost_nanos) AS ai_provider_cost_nanos, sum(billable_cost_nanos) AS ai_consumed_nanos,
    sum(input_tokens) AS input_tokens, sum(output_tokens) AS output_tokens,
    sum(billable_cost_nanos) FILTER (WHERE created_at >= now() - interval '24 hours') AS ai_24h_nanos,
    max(created_at) AS last_activity
  FROM public.ai_usage_events WHERE created_at >= now() - interval '90 days' GROUP BY user_id
), providers AS (
  SELECT user_id, credits_consumed, credits_reserved, provider_cost_nanos, reconciliation_required, estimated_usage
  FROM public.admin_external_user_rollup_v1
)
SELECT COALESCE(subscription.user_id, ai.user_id, providers.user_id) AS user_id,
  COALESCE(subscription.plan, 'Free') AS plan, subscription.status AS subscription_status, subscription.current_period_end,
  COALESCE(ai.ai_provider_cost_nanos, 0) AS ai_provider_cost_nanos, COALESCE(ai.ai_consumed_nanos, 0) AS ai_consumed_nanos,
  COALESCE(ai.input_tokens, 0) AS input_tokens, COALESCE(ai.output_tokens, 0) AS output_tokens, COALESCE(ai.ai_24h_nanos, 0) AS ai_24h_nanos,
  COALESCE(providers.credits_consumed, 0) AS credits_consumed, COALESCE(providers.credits_reserved, 0) AS credits_reserved,
  COALESCE(providers.provider_cost_nanos, 0) AS provider_cost_nanos, COALESCE(providers.reconciliation_required, false) AS reconciliation_required,
  COALESCE(providers.estimated_usage, false) AS estimated_usage, ai.last_activity,
  CASE COALESCE(subscription.plan, 'Free') WHEN 'Starter' THEN 3000000000 WHEN 'Basics' THEN 5000000000 WHEN 'Pro' THEN 12000000000 WHEN 'Ultimate' THEN 25000000000 ELSE 500000000 END AS ai_allocation_nanos,
  CASE COALESCE(subscription.plan, 'Free') WHEN 'Starter' THEN 150 WHEN 'Basics' THEN 250 WHEN 'Pro' THEN 600 WHEN 'Ultimate' THEN 1250 ELSE 10 END AS included_credits,
  COALESCE(subscription.price, 0) * 1000000000 AS subscription_revenue_nanos
FROM subscription FULL OUTER JOIN ai ON ai.user_id = subscription.user_id FULL OUTER JOIN providers ON providers.user_id = COALESCE(subscription.user_id, ai.user_id);

CREATE OR REPLACE VIEW public.admin_plan_cost_summary_v1
WITH (security_invoker = false) AS
SELECT plan, count(*) AS active_subscribers, sum(subscription_revenue_nanos) AS revenue_nanos,
  sum(ai_allocation_nanos) AS ai_allocation_nanos, sum(ai_provider_cost_nanos) AS actual_ai_cost_nanos,
  sum(included_credits * 20000000) AS provider_allocation_nanos, sum(provider_cost_nanos) AS provider_actual_cost_nanos,
  sum(ai_provider_cost_nanos + provider_cost_nanos) AS total_actual_cost_nanos,
  sum(subscription_revenue_nanos - ai_provider_cost_nanos - provider_cost_nanos) AS contribution_nanos
FROM public.admin_user_usage_summary_v1 GROUP BY plan;

CREATE OR REPLACE VIEW public.admin_usage_anomalies_v1
WITH (security_invoker = false) AS
SELECT user_id, 'allocation_over_80_percent'::text AS anomaly, ai_consumed_nanos, ai_allocation_nanos
FROM public.admin_user_usage_summary_v1 WHERE ai_consumed_nanos >= ai_allocation_nanos * .8
UNION ALL SELECT user_id, 'expired_subscription_with_usage', ai_consumed_nanos, ai_allocation_nanos FROM public.admin_user_usage_summary_v1
WHERE current_period_end < now() AND ai_consumed_nanos > 0;

REVOKE ALL ON public.admin_user_usage_summary_v1, public.admin_user_ai_usage_daily_v1, public.admin_user_provider_usage_daily_v1, public.admin_external_user_rollup_v1, public.admin_plan_cost_summary_v1, public.admin_provider_cost_summary_v1, public.admin_usage_anomalies_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_user_usage_summary_v1, public.admin_user_ai_usage_daily_v1, public.admin_user_provider_usage_daily_v1, public.admin_external_user_rollup_v1, public.admin_plan_cost_summary_v1, public.admin_provider_cost_summary_v1, public.admin_usage_anomalies_v1 TO service_role;
