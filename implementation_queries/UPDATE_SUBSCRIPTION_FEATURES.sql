-- Update subscription plans with job search limits
-- Free: 10 jobs/month, Pro: 50 jobs/month, Ultimate: 100 jobs/month

UPDATE subscription_plans
SET 
    description = 'Perfect for getting started with job searching',
    features = jsonb_build_array(
        '10 job searches',
        '10 credits per month',
        'Email notifications'
    )
WHERE name = 'Free';

UPDATE subscription_plans
SET 
    description = 'For serious job seekers who need more power',
    features = jsonb_build_array(
        '50 job searches',
        '1,000 credits per month',
        'AI-powered job matching',
        'AI chat assistant',
        'AI cover letter generation',
        'Priority support',
        'Advanced analytics',
        'Unlimited resumes'
    )
WHERE name = 'Pro';

UPDATE subscription_plans
SET 
    description = 'Maximum power for your job search journey',
    features = jsonb_build_array(
        '100 job searches',
        '5,000 credits per month',
        'Everything in Pro',
        'AI interview preparation',
        'Personalized job recommendations',
        'Dedicated support',
        'White-glove onboarding',
        'Custom integrations'
    )
WHERE name = 'Ultimate';

-- Verify updates
SELECT 
    name,
    price,
    credits_per_month,
    description,
    features
FROM subscription_plans
ORDER BY price;
