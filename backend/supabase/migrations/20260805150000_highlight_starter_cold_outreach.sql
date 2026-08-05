-- Present the Starter plan around the value it provides without implying that
-- JobRaker automatically sends a user's emails or applications.
UPDATE public.subscription_plans
SET
  description = 'Build a focused search with AI tools and tailored cold-outreach email drafts.',
  features = jsonb_build_array(
    jsonb_build_object('name', '75 monthly credits', 'value', '75', 'included', true),
    jsonb_build_object('name', 'AI job search', 'value', 'Included', 'included', true),
    jsonb_build_object('name', 'AI Chat assistant', 'value', 'Included', 'included', true),
    jsonb_build_object('name', 'Resume analysis', 'value', 'Included', 'included', true),
    jsonb_build_object('name', 'Resume builder', 'value', 'Included', 'included', true),
    jsonb_build_object('name', 'AI resume polishing', 'value', 'Included', 'included', true),
    jsonb_build_object('name', 'Cover-letter generation', 'value', 'Included', 'included', true),
    jsonb_build_object('name', 'Job match scores', 'value', 'Included', 'included', true),
    jsonb_build_object('name', 'Application tracking', 'value', 'Included', 'included', true),
    jsonb_build_object('name', 'Cold outreach email drafts', 'value', 'Included', 'included', true),
    jsonb_build_object('name', 'Flexible application workflow', 'value', 'Included', 'included', true)
  ),
  updated_at = NOW()
WHERE name = 'Starter';
