-- Fix security definer view issues by recreation as security_invoker = true

-- Recreate public.job_stats view
DROP VIEW IF EXISTS public.job_stats;

CREATE OR REPLACE VIEW public.job_stats WITH (security_invoker = true) AS
SELECT 
  user_id,
  COUNT(*) as total_jobs,
  COUNT(*) FILTER (WHERE status = 'active') as active_jobs,
  COUNT(*) FILTER (WHERE status = 'applied') as applied_jobs,
  COUNT(*) FILTER (WHERE status = 'interview') as interview_jobs,
  COUNT(*) FILTER (WHERE status = 'offer') as offer_jobs,
  COUNT(*) FILTER (WHERE bookmarked = true) as bookmarked_jobs,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as jobs_this_week,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as jobs_this_month
FROM public.jobs
GROUP BY user_id;

-- Grant permissions for job_stats
GRANT SELECT ON public.job_stats TO anon, authenticated, service_role;

-- Recreate public.user_job_stats view
DROP VIEW IF EXISTS public.user_job_stats;

CREATE OR REPLACE VIEW public.user_job_stats WITH (security_invoker = true) AS
SELECT 
  user_id,
  COUNT(*) as total_jobs,
  COUNT(*) FILTER (WHERE status = 'active') as active_jobs,
  COUNT(*) FILTER (WHERE status = 'applied') as applied_jobs,
  COUNT(*) FILTER (WHERE status = 'interview') as interview_jobs,
  COUNT(*) FILTER (WHERE status = 'offer') as offer_jobs,
  COUNT(*) FILTER (WHERE bookmarked = true) as bookmarked_jobs,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as jobs_this_week,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as jobs_this_month
FROM public.jobs
GROUP BY user_id;

-- Grant permissions for user_job_stats
GRANT SELECT ON public.user_job_stats TO anon, authenticated, service_role;
