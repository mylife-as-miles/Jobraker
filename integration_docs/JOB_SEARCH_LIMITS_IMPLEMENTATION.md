# Job Search Limits Implementation

## Overview
This implements tier-based job search limits to prevent free users from unlimited searches.

## Limits by Tier
- **Free**: 10 job searches per month
- **Pro**: 50 job searches per month  
- **Ultimate**: 100 job searches per month

## Database Setup

### Step 1: Run the job search limits enforcement SQL
Execute `/workspaces/Jobraker/ENFORCE_JOB_SEARCH_LIMITS.sql` in Supabase SQL Editor.

This creates:
- `user_job_search_usage` table to track usage
- `get_job_search_limit(user_id)` function - returns limit based on tier
- `can_search_jobs(user_id)` function - checks if user can search
- `increment_job_search_count(user_id, count)` function - increments search count

### Step 2: Update subscription plan features
Execute `/workspaces/Jobraker/UPDATE_SUBSCRIPTION_FEATURES.sql` in Supabase SQL Editor.

This updates the subscription_plans table with:
- Free: "10 job searches per month" feature
- Pro: "50 job searches per month" feature  
- Ultimate: "100 job searches per month" feature

## Frontend Integration

### Hook Usage
Use the `useJobSearchLimits` hook in your job search component:

```typescript
import { useJobSearchLimits } from '@/hooks/useJobSearchLimits';

const { limits, loading, incrementSearchCount } = useJobSearchLimits();

// Check before searching
if (limits && !limits.canSearch) {
  // Show upgrade prompt
  alert(`You've reached your ${limits.tier} tier limit of ${limits.limit} searches`);
  return;
}

// After successful search
await incrementSearchCount(numberOfJobsReturned);
```

### Example Implementation in JobPage

```typescript
import { useJobSearchLimits } from '@/hooks/useJobSearchLimits';

const JobPage = () => {
  const { limits, loading, incrementSearchCount } = useJobSearchLimits();

  const handleSearch = async () => {
    // Check limits before searching
    if (limits && !limits.canSearch) {
      // Show upgrade modal
      toast.error(`Search limit reached! Upgrade to Pro for 50 searches/month.`);
      navigate('/dashboard/billing');
      return;
    }

    // Perform search
    const results = await searchJobs(query);
    
    // Increment counter
    if (results && results.length > 0) {
      await incrementSearchCount(results.length);
    }
  };

  // Display remaining searches
  if (limits) {
    console.log(`${limits.remaining} searches remaining this month`);
  }
};
```

## Updated Billing Page

The BillingPage component automatically displays the correct features from the database, including:
- Job search limits per tier
- Credit allocations
- All other features

## How It Works

1. **User searches for jobs** → Frontend calls `can_search_jobs()` function
2. **Function checks:**
   - User's subscription tier
   - Current search count for this month
   - If month has passed, resets counter
   - Returns: canSearch, currentCount, limit, remaining, tier, resetDate
3. **If allowed** → Search proceeds, then `increment_job_search_count()` is called
4. **If limit reached** → Show upgrade prompt directing to /dashboard/billing

## Monthly Reset

Counters automatically reset after 1 month from `last_reset_at` timestamp.
The `can_search_jobs()` function handles this automatically.

## Testing

### Check a user's limits:
```sql
SELECT can_search_jobs('user-uuid-here');
```

### Manually increment count (testing):
```sql
SELECT increment_job_search_count('user-uuid-here', 5);
```

### View all usage:
```sql
SELECT 
  au.email,
  ujs.search_count,
  ujs.last_reset_at,
  get_job_search_limit(au.id) as limit
FROM user_job_search_usage ujs
JOIN auth.users au ON au.id = ujs.user_id;
```

## Next Steps

1. Run both SQL files in Supabase
2. Integrate `useJobSearchLimits` hook in JobPage component
3. Add check before job search
4. Increment counter after successful search
5. Show upgrade prompt when limit reached
