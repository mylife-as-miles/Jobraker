# Job Search Limits - Deployment Instructions

## What's Been Done

✅ Created database functions to enforce tier-based job search limits
✅ Created React hook to check and track limits
✅ Integrated limits into JobPage component
✅ Updated billing page to show limits

## Tier Limits

- **Free**: 10 job searches per month
- **Pro**: 50 job searches per month
- **Ultimate**: 100 job searches per month

## Deployment Steps

### Step 1: Run SQL Files in Supabase

Go to Supabase Dashboard → SQL Editor and run these files in order:

1. **First run:** `/workspaces/Jobraker/ENFORCE_JOB_SEARCH_LIMITS.sql`
   - Creates `user_job_search_usage` table
   - Creates limit checking functions
   - Initializes all users with 0 searches

2. **Then run:** `/workspaces/Jobraker/UPDATE_SUBSCRIPTION_FEATURES.sql`
   - Updates subscription plan features to show job limits
   - Updates descriptions

### Step 2: That's It!

The frontend is already integrated. Here's what happens:

## How It Works

### Before Search:
1. User clicks "Search for Jobs"
2. System checks `can_search_jobs()` function
3. If limit reached → Shows error and upgrade prompt
4. If allowed → Proceeds with search using tier limit (10/50/100)

### During Search:
- Free users: Searches only 10 jobs
- Pro users: Searches 50 jobs
- Ultimate users: Searches 100 jobs

### After Search:
- Increments search count by number of jobs found
- Next search checks updated count

### Monthly Reset:
- Automatically resets after 1 month from `last_reset_at`
- No manual intervention needed

## Testing

### Check your current limits:
```sql
SELECT can_search_jobs(auth.uid());
```

### Manually set a user to limit (testing):
```sql
UPDATE user_job_search_usage
SET search_count = 10
WHERE user_id = auth.uid();
```

### View all user usage:
```sql
SELECT 
  au.email,
  ujs.search_count,
  ujs.last_reset_at,
  get_job_search_limit(au.id) as limit,
  sp.name as tier
FROM user_job_search_usage ujs
JOIN auth.users au ON au.id = ujs.user_id
LEFT JOIN user_subscriptions us ON us.user_id = au.id AND us.status = 'active'
LEFT JOIN subscription_plans sp ON sp.id = us.subscription_plan_id
ORDER BY ujs.search_count DESC;
```

## User Experience

### Free User (Limit Reached):
1. Clicks "Search for Jobs"
2. Sees error: "Search limit reached! You've used 10 of 10 searches this month."
3. Toast notification: "Upgrade to Pro for 50 searches per month!"
4. Click on error link → Goes to /dashboard/billing

### Pro User:
1. Can search 50 jobs per month
2. Sees same flow if limit is reached

### Ultimate User:
1. Can search 100 jobs per month
2. Best experience with highest limit

## What's Updated

### Database:
- ✅ `user_job_search_usage` table tracking usage
- ✅ `get_job_search_limit()` function
- ✅ `can_search_jobs()` function  
- ✅ `increment_job_search_count()` function
- ✅ RLS policies for security

### Frontend:
- ✅ `useJobSearchLimits` hook in `/src/hooks/useJobSearchLimits.ts`
- ✅ JobPage integrated with limits checking
- ✅ Billing page shows correct limits from database

### Features Updated:
- ✅ Free tier: "10 job searches per month"
- ✅ Pro tier: "50 job searches per month"  
- ✅ Ultimate tier: "100 job searches per month"
- ✅ All other features preserved

## Monitoring

Check usage stats:
```sql
SELECT 
  COUNT(*) as total_users,
  AVG(search_count) as avg_searches,
  MAX(search_count) as max_searches,
  COUNT(CASE WHEN search_count >= get_job_search_limit(user_id) THEN 1 END) as users_at_limit
FROM user_job_search_usage;
```

## Troubleshooting

**Problem:** User says they can't search but haven't reached limit
**Solution:** Check their record in user_job_search_usage, may need to reset

**Problem:** Limit not enforcing
**Solution:** Verify RLS policies are created and functions exist

**Problem:** Counter not incrementing
**Solution:** Check console logs for errors in incrementSearchCount call

## Notes

- Searches are counted by number of jobs found, not number of search button clicks
- If a search returns 5 jobs, it counts as 5 searches
- This prevents abuse while being fair to users
- Monthly reset is automatic based on `last_reset_at` timestamp
