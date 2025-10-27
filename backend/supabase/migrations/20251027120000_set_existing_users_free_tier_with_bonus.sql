-- Migration: Set all existing users to Free tier and allocate signup bonus
-- This ensures all existing users have the new credit system applied

-- Step 1: Update all existing profiles to Free tier if they don't have a subscription tier set
UPDATE profiles
SET subscription_tier = 'Free'
WHERE subscription_tier IS NULL OR subscription_tier = '';

-- Step 2: Ensure all users have a user_credits record
-- Insert credits for users who don't have a record yet
INSERT INTO user_credits (user_id, balance, lifetime_earned, lifetime_spent)
SELECT 
    p.id,
    50, -- New user signup bonus
    50, -- Lifetime earned starts at 50
    0   -- No spent credits yet
FROM profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM user_credits uc WHERE uc.user_id = p.id
);

-- Step 3: Add signup bonus to existing users who already have a user_credits record
-- This gives them the 50 credit bonus on top of what they have
UPDATE user_credits uc
SET 
    balance = balance + 50,
    lifetime_earned = lifetime_earned + 50,
    updated_at = NOW()
WHERE EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = uc.user_id
);

-- Step 4: Record the bonus transaction for all users
INSERT INTO credit_transactions (user_id, amount, transaction_type, description, balance_after)
SELECT 
    uc.user_id,
    50,
    'bonus',
    'New user signup bonus - 50 credits',
    uc.balance
FROM user_credits uc
WHERE NOT EXISTS (
    SELECT 1 
    FROM credit_transactions ct 
    WHERE ct.user_id = uc.user_id 
    AND ct.transaction_type = 'bonus' 
    AND ct.description LIKE '%signup bonus%'
);

-- Step 5: Ensure all existing user_subscriptions are properly set
-- If users have active subscriptions but profiles say Free, update profiles to match
UPDATE profiles p
SET subscription_tier = sp.name
FROM user_subscriptions us
JOIN subscription_plans sp ON us.subscription_plan_id = sp.id
WHERE p.id = us.user_id
  AND us.status = 'active'
  AND p.subscription_tier = 'Free'
  AND sp.name IN ('Pro', 'Ultimate');

-- Step 6: Add monthly credit allocation for Free tier users who were just set
-- This ensures they get their monthly 10 credits
UPDATE user_credits uc
SET 
    balance = balance + 10,
    lifetime_earned = lifetime_earned + 10,
    last_refill = NOW(),
    updated_at = NOW()
FROM profiles p
WHERE uc.user_id = p.id
  AND p.subscription_tier = 'Free'
  AND (uc.last_refill IS NULL OR uc.last_refill < NOW() - INTERVAL '1 month');

-- Step 7: Record the monthly allocation transaction for Free users
INSERT INTO credit_transactions (user_id, amount, transaction_type, description, balance_after)
SELECT 
    uc.user_id,
    10,
    'refill',
    'Free tier monthly credit allocation - 10 credits',
    uc.balance
FROM user_credits uc
JOIN profiles p ON uc.user_id = p.id
WHERE p.subscription_tier = 'Free'
  AND NOT EXISTS (
    SELECT 1 
    FROM credit_transactions ct 
    WHERE ct.user_id = uc.user_id 
    AND ct.transaction_type = 'refill' 
    AND ct.description LIKE '%Free tier monthly%'
    AND ct.created_at > NOW() - INTERVAL '1 month'
  );

-- Step 8: Verify the changes with a summary
DO $$
DECLARE
    total_users INTEGER;
    free_users INTEGER;
    pro_users INTEGER;
    ultimate_users INTEGER;
    total_credits_allocated BIGINT;
BEGIN
    -- Count users by tier
    SELECT COUNT(*) INTO total_users FROM profiles;
    SELECT COUNT(*) INTO free_users FROM profiles WHERE subscription_tier = 'Free';
    SELECT COUNT(*) INTO pro_users FROM profiles WHERE subscription_tier = 'Pro';
    SELECT COUNT(*) INTO ultimate_users FROM profiles WHERE subscription_tier = 'Ultimate';
    
    -- Sum total credits
    SELECT COALESCE(SUM(balance), 0) INTO total_credits_allocated FROM user_credits;
    
    -- Log the summary
    RAISE NOTICE '=== Credit System Migration Summary ===';
    RAISE NOTICE 'Total users: %', total_users;
    RAISE NOTICE 'Free tier users: %', free_users;
    RAISE NOTICE 'Pro tier users: %', pro_users;
    RAISE NOTICE 'Ultimate tier users: %', ultimate_users;
    RAISE NOTICE 'Total credits in system: %', total_credits_allocated;
    RAISE NOTICE '======================================';
END $$;
