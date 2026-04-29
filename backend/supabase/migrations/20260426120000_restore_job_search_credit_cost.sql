-- Ensure the job search pre-flight check can always find its credit cost.
-- The RPC maps p_feature_type='job_search' to credit_costs('job_search', 'search').

INSERT INTO public.credit_costs (
  feature_type,
  feature_name,
  cost,
  description,
  is_active
)
VALUES (
  'job_search',
  'search',
  1,
  'Search for jobs (1 credit per search)',
  true
)
ON CONFLICT (feature_type, feature_name)
DO UPDATE SET
  cost = EXCLUDED.cost,
  description = EXCLUDED.description,
  is_active = true,
  updated_at = timezone('utc'::text, now());
