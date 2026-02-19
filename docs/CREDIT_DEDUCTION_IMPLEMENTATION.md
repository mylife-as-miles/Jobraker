# Credit Deduction Implementation

## Overview
This document describes the implementation of credit deduction for job search and auto-apply actions in Jobraker.

## Credit Costs

| Action | Cost per Action |
|--------|----------------|
| Job Search | 1 credit per job found |
| Auto Apply | 5 credits per job application |

## Database Functions

### 1. `deduct_job_search_credits(p_user_id, p_jobs_count)`
**Purpose:** Deducts credits after a successful job search.

**Parameters:**
- `p_user_id` (uuid): The user's ID
- `p_jobs_count` (integer): Number of jobs found (default: 1)

**Returns:** JSON object
```json
{
  "success": true,
  "credits_deducted": 10,
  "remaining_balance": 40,
  "jobs_count": 10
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "insufficient_credits",
  "required": 10,
  "available": 5,
  "message": "Insufficient credits. Need 10 but only have 5."
}
```

### 2. `deduct_auto_apply_credits(p_user_id, p_jobs_count)`
**Purpose:** Deducts credits after successful auto-apply.

**Parameters:**
- `p_user_id` (uuid): The user's ID
- `p_jobs_count` (integer): Number of jobs applied to (default: 1)

**Returns:** JSON object (same format as job search)

### 3. `check_credits_available(p_user_id, p_feature_type, p_quantity)`
**Purpose:** Checks if user has enough credits before performing an action (does NOT deduct).

**Parameters:**
- `p_user_id` (uuid): The user's ID
- `p_feature_type` (text): Either 'job_search' or 'auto_apply'
- `p_quantity` (integer): Number of items (default: 1)

**Returns:** JSON object
```json
{
  "available": true,
  "current_balance": 50,
  "required": 25,
  "cost_per_item": 5,
  "quantity": 5,
  "feature_type": "auto_apply"
}
```

## Frontend Integration

### Job Search (JobPage.tsx)
**Location:** After successful job search, before refreshing job list

**Code Flow:**
1. User searches for jobs
2. Jobs are found and saved by `jobs-search` edge function
3. **Credit deduction happens here** (1 credit × number of jobs found)
4. Search counter incremented (for tier limits)
5. Job list refreshed

**Implementation:**
```typescript
// Deduct credits for job search (1 credit per job)
if (inserted > 0) {
  const { data: deductResult } = await supabase.rpc('deduct_job_search_credits', {
    p_user_id: userId,
    p_jobs_count: inserted
  });
}
```

### Auto Apply (JobPage.tsx)
**Location:** 
- **Pre-check:** Before launching automation (checks if user has enough credits)
- **Deduction:** After successful applications

**Code Flow:**
1. User clicks "Auto Apply"
2. **Pre-check credits** (5 credits × number of jobs)
3. If insufficient credits → Show error + redirect to billing
4. If sufficient → Launch automation
5. After successful applications → **Deduct credits**
6. Show success message with remaining balance

**Implementation:**
```typescript
// Pre-check credits
const { data: creditCheck } = await supabase.rpc('check_credits_available', {
  p_user_id: userId,
  p_feature_type: 'auto_apply',
  p_quantity: jobsWithTargets.length
});

if (!creditCheck?.available) {
  // Show error and stop
  setError({ 
    message: `Insufficient credits. Need ${required} but only have ${available}.`,
    link: '/dashboard/billing'
  });
  return;
}

// ... after successful automation ...

// Deduct credits (only for successful applications)
const { data: deductResult } = await supabase.rpc('deduct_auto_apply_credits', {
  p_user_id: userId,
  p_jobs_count: success // Only count successful applications
});
```

## Credit Transaction Tracking

All credit deductions are automatically tracked in the `credit_transactions` table with:
- User ID
- Transaction type: 'consumed'
- Amount deducted
- Balance before/after
- Description (e.g., "Job search (10 jobs)")
- Reference type ('job_search' or 'auto_apply')
- Metadata (jobs count, cost per job)

## User Experience

### Insufficient Credits
When a user doesn't have enough credits:

**Job Search:**
- Search completes normally
- Credits are deducted silently in background
- If credits run out mid-search, future searches will be blocked by tier limits

**Auto Apply:**
- Pre-check prevents action from starting
- Clear error message shows:
  - Required credits
  - Available credits
  - Link to billing page
- User can upgrade or purchase credit packs

### Success Messages
- Job search: Silent deduction (shown in console)
- Auto apply: Toast notification: "Used 25 credits for auto apply. 175 credits remaining."

## Deployment Steps

1. **Execute SQL file in Supabase Dashboard:**
   ```bash
   # Run: ADD_CREDIT_DEDUCTION_FUNCTIONS.sql
   ```

2. **Verify functions created:**
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name LIKE '%credit%';
   ```

3. **Test credit check:**
   ```sql
   SELECT check_credits_available(
     'YOUR_USER_ID'::uuid, 
     'auto_apply', 
     5
   );
   ```

4. **Test credit deduction:**
   ```sql
   SELECT deduct_job_search_credits(
     'YOUR_USER_ID'::uuid, 
     3
   );
   ```

5. **Verify transaction created:**
   ```sql
   SELECT * FROM credit_transactions 
   WHERE user_id = 'YOUR_USER_ID'::uuid 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

## Monitoring

### Check User Credits
```sql
SELECT 
  uc.user_id,
  uc.balance,
  uc.total_earned,
  uc.total_consumed,
  sp.name as plan_name
FROM user_credits uc
LEFT JOIN user_subscriptions us ON us.user_id = uc.user_id AND us.status = 'active'
LEFT JOIN subscription_plans sp ON sp.id = us.plan_id
WHERE uc.user_id = 'YOUR_USER_ID'::uuid;
```

### Recent Transactions
```sql
SELECT 
  type,
  amount,
  balance_after,
  description,
  reference_type,
  metadata,
  created_at
FROM credit_transactions
WHERE user_id = 'YOUR_USER_ID'::uuid
ORDER BY created_at DESC
LIMIT 20;
```

### Daily Credit Usage
```sql
SELECT 
  DATE(created_at) as date,
  reference_type,
  SUM(amount) as total_credits,
  COUNT(*) as transaction_count
FROM credit_transactions
WHERE type = 'consumed'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), reference_type
ORDER BY date DESC;
```

## Error Handling

### Insufficient Credits
- Function returns `success: false` with error details
- Frontend shows user-friendly message
- User redirected to billing page to upgrade/purchase

### Transaction Failures
- Database functions use `SECURITY DEFINER` for reliable execution
- Errors logged to console
- User sees generic error message
- Credits not deducted if transaction fails

### Edge Cases
- User with NULL credits → Initialized to 0 automatically
- Negative balance attempts → Blocked by CHECK constraint
- Concurrent transactions → PostgreSQL handles with ACID guarantees

## Future Enhancements

1. **Bulk Operations:** Optimize for batch credit deductions
2. **Credit Refunds:** Implement refund mechanism for failed actions
3. **Credit Expiration:** Add expiration dates for purchased credits
4. **Usage Analytics:** Dashboard showing credit usage trends
5. **Smart Warnings:** Notify users when credits are running low
6. **Credit Rollover:** Allow unused monthly credits to roll over (with limits)

## Testing Checklist

- [ ] Free user (10 credits) can search for 10 jobs → 10 credits deducted
- [ ] Free user with 5 credits cannot auto-apply to 2 jobs (needs 10)
- [ ] Pro user can auto-apply to 5 jobs → 25 credits deducted
- [ ] Credit transactions appear in billing history
- [ ] Error message shows when credits insufficient
- [ ] Billing page link works from error messages
- [ ] Credits display updates in real-time after actions
- [ ] Monthly credit refill works correctly
- [ ] Credit purchases add to balance immediately
