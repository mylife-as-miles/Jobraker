# Admin Credit Checker Tool

## Quick Answer for siscostarters@gmail.com

To check how many credits **siscostarters@gmail.com** has:

1. **Navigate to**: `http://localhost:5173/admin/check-credits` (or your deployed URL)
2. The email `siscostarters@gmail.com` is already pre-filled
3. Click **"Check Credits"**

You'll instantly see:
- ✅ Current credit balance
- ✅ Total earned credits
- ✅ Total consumed credits  
- ✅ Active subscription plan
- ✅ Recent transaction history (last 10)

---

## Features

This admin tool provides comprehensive credit information for any user:

### User Information
- Email address
- Full name
- User ID (UUID)

### Credit Balance
- **Current Balance** - Available credits right now
- **Total Earned** - All credits ever received (refills, bonuses, purchases)
- **Total Consumed** - All credits ever spent (job searches, auto-applies)
- **Last Reset** - When credits were last refilled

### Subscription Details
- Active plan name (Free/Pro/Ultimate)
- Monthly credit allocation
- Subscription status

### Transaction History
Shows the last 10 credit transactions:
- Date & time
- Type (earned/consumed/bonus/refund)
- Amount (+/-)
- Description (what the transaction was for)
- Balance after transaction

Color-coded for easy reading:
- 🟢 Green = Credits added (earned, bonus, refund)
- 🔴 Red = Credits spent (consumed)

---

## How to Use

### Step 1: Access the Page
Navigate to: `/admin/check-credits`

Example URLs:
- Local dev: `http://localhost:5173/admin/check-credits`
- Production: `https://yourdomain.com/admin/check-credits`

### Step 2: Enter Email
The form has `siscostarters@gmail.com` pre-filled, but you can check any user:
- Enter or modify the email address
- Click "Check Credits"

### Step 3: View Results
The page will display:
1. User profile information
2. Complete credit breakdown
3. Active subscription (if any)
4. Recent credit transactions

---

## Troubleshooting

### "User not found with email: xxx"
- The email doesn't exist in the `profiles` table
- Check for typos in the email address
- User may not have completed registration

### "No credits data found"
- User exists but hasn't been assigned credits yet
- Credit system may not be initialized for this user
- Check if the user was created before the credit system was implemented

### "No active subscription"
- User is on the Free tier (default)
- User's paid subscription may have expired
- Subscription status is not "active"

### Permission Errors
- You must be logged in to access this page
- Make sure you're authenticated
- Check browser console for RLS (Row Level Security) errors

---

## Database Context

This tool queries the following tables:
- `profiles` - User information
- `user_credits` - Credit balances
- `user_subscriptions` - Subscription status
- `subscription_plans` - Plan details
- `credit_transactions` - Transaction history

All queries respect Row Level Security (RLS) policies. If you see permission errors, the logged-in user may not have access to view other users' data.

---

## Technical Details

**File Location**: `/workspaces/Jobraker/src/pages/AdminCheckCredits.tsx`

**Route**: `/admin/check-credits`

**Tech Stack**:
- React functional component with hooks
- Supabase client for database queries
- TailwindCSS for styling
- Real-time data (no caching)

**Security**:
- Requires authentication (`<RequireAuth>` wrapper)
- Respects Supabase RLS policies
- No admin privileges checked (relies on RLS)

---

## Next Steps

After checking credits, if you need to:

### Add Credits Manually
Run this SQL in Supabase SQL Editor:
```sql
-- Add 50 credits to a user
UPDATE user_credits 
SET 
  balance = balance + 50,
  total_earned = total_earned + 50
WHERE user_id = (SELECT id FROM profiles WHERE email = 'siscostarters@gmail.com');

-- Record the transaction
INSERT INTO credit_transactions (user_id, type, amount, balance_before, balance_after, description)
SELECT 
  id,
  'bonus',
  50,
  (SELECT balance - 50 FROM user_credits WHERE user_id = id),
  (SELECT balance FROM user_credits WHERE user_id = id),
  'Manual credit addition'
FROM profiles WHERE email = 'siscostarters@gmail.com';
```

### Check Why Credits Weren't Deducted
1. Verify the SQL functions are deployed (see `DEPLOY_CREDIT_DEDUCTION.md`)
2. Check browser console for errors during job search
3. Look for "function does not exist" errors
4. Verify transaction history shows recent "consumed" entries

### Monitor Credit Usage
Use the transaction history to:
- See when credits were spent
- Identify patterns (job searches vs auto-applies)
- Verify deduction amounts (1 credit/search, 5 credits/auto-apply)
- Check for unusual activity

---

## Example Output

```
User Information
Email: siscostarters@gmail.com
Name: John Doe
User ID: 550e8400-e29b-41d4-a716-446655440000

Credit Balance
Current Balance: 180
Total Earned: 200
Total Consumed: 20
Last Reset: 10/28/2025

Active Subscription
Plan: Free
Monthly Credits: 25
Status: active

Recent Transactions
Date                Type      Amount  Description              Balance After
10/28/25 3:45 PM   consumed    -5     Auto apply (1 job)            180
10/28/25 2:30 PM   consumed    -1     Job search (10 jobs)          185
10/27/25 1:00 AM   earned     +25     Monthly credit refill         186
```

---

For deployment instructions and SQL function setup, see:
- `DEPLOY_CREDIT_DEDUCTION.md`
- `ADD_CREDIT_DEDUCTION_FUNCTIONS.sql`
