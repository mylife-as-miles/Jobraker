# Deploy Credit Deduction Functions

## Issue
Credits are not being deducted after job searches because the database functions don't exist yet.

## Solution
You need to execute the SQL file that contains the credit deduction functions.

## Steps to Deploy

### Option 1: Via Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy the entire contents of `ADD_CREDIT_DEDUCTION_FUNCTIONS.sql`
5. Paste it into the SQL editor
6. Click **Run** to execute

### Option 2: Via Supabase CLI (If you have it configured)
```bash
# From project root
cd /workspaces/Jobraker
supabase db push
```

### Option 3: Create a Migration File
```bash
# Create a new migration file
cd /workspaces/Jobraker/backend/supabase
mkdir -p migrations
cp ../../ADD_CREDIT_DEDUCTION_FUNCTIONS.sql migrations/$(date +%Y%m%d%H%M%S)_add_credit_deduction_functions.sql

# Then push via Supabase dashboard or CLI
```

## What These Functions Do

1. **`deduct_job_search_credits(user_id, jobs_count)`**
   - Deducts 1 credit per job searched
   - Creates transaction record
   - Returns success status and remaining balance

2. **`deduct_auto_apply_credits(user_id, jobs_count)`**
   - Deducts 5 credits per job auto-applied
   - Creates transaction record
   - Returns success status and remaining balance

3. **`check_credits_available(user_id, feature_type, quantity)`**
   - Pre-checks if user has enough credits
   - Used before starting an action
   - Does NOT deduct credits

## Verify Deployment

After executing the SQL, test by:
1. Check your current credit balance (180)
2. Perform a job search
3. Check credit balance again - should be reduced by the number of jobs found

You can also check the functions exist by running this in SQL Editor:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE 'deduct%credit%';
```

Should return:
- `deduct_job_search_credits`
- `deduct_auto_apply_credits`
- `check_credits_available`

## Browser Console Check

Open your browser's developer console (F12) during a job search. You should see:
```
Deducted X credits. Remaining: Y
```

If you see errors like "function does not exist", the SQL hasn't been deployed yet.
