# Fix: Gmail Connection Status Check Error

## Issue Summary

**Error:** The composio-gmail-auth edge function is returning a 400 error with "Invalid action" when checking Gmail connection status.

```
POST https://yquhsllwrwfvrwolqywh.supabase.co/functions/v1/composio-gmail-auth 400
Failed to check Gmail connection status: FunctionsHttpError: Edge Function returned a non-2xx status code

Request payload:
{
  "userId": "20cc2e4f-2678-496f-9259-70a310b81566",
  "authConfigId": "ac_h5WmVaSoocpG",
  "action": "status"
}

Response:
{
  "error": "Invalid action"
}
```

## Root Cause

The **deployed version** of the `composio-gmail-auth` edge function on Supabase does not include the "status" action handler, even though the code in the repository **does have it**.

### Current Local Code (✅ Correct)

The local code at `backend/supabase/supabase/functions/composio-gmail-auth/index.ts` includes the "status" action handler (lines 77-96):

```typescript
} else if (action === "status") {
  const { data: connectedAccounts } =
    await composio.connectedAccounts.list({
      userIds: [userId],
    });
  const isConnected =
    connectedAccounts &&
    connectedAccounts.some(
      (account) => account.authConfigId === authConfigId
    );

  return new Response(
    JSON.stringify({
      isConnected,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    }
  );
```

### The Problem

The code is correct in the repository, but **it hasn't been deployed to Supabase yet**. The deployed version only supports "initiate" and "verify" actions, not "status".

## Solution: Deploy the Edge Function

You need to deploy the updated edge function to Supabase. Here are the deployment options:

### Option 1: Manual Deployment via Supabase CLI (Recommended)

1. **Ensure you have Supabase CLI credentials:**
   ```bash
   # Login to Supabase (if not already logged in)
   npx supabase login
   
   # Or set the access token as an environment variable
   export SUPABASE_ACCESS_TOKEN=your_access_token
   ```

2. **Link to your project (if not already linked):**
   ```bash
   cd backend/supabase
   npx supabase link --project-ref $SUPABASE_PROJECT_REF
   ```

3. **Deploy the specific function:**
   ```bash
   cd backend/supabase
   npx supabase functions deploy composio-gmail-auth --no-verify-jwt
   ```

### Option 2: Deploy All Functions

If you want to deploy all edge functions at once:

```bash
cd backend/supabase
npx supabase functions deploy
```

### Option 3: Via GitHub Actions

If you have CI/CD set up, you could create a workflow to deploy edge functions similar to how database migrations are deployed.

Create `.github/workflows/deploy-functions.yml`:

```yaml
name: Deploy Supabase Functions

on:
  workflow_dispatch:
  push:
    branches:
      - main
    paths:
      - 'backend/supabase/supabase/functions/**'

jobs:
  deploy-functions:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm i -g supabase@^2
      - name: Supabase login
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
        run: supabase login --token "${SUPABASE_ACCESS_TOKEN}"
      - name: Link project
        env:
          SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
        working-directory: backend/supabase
        run: supabase link --project-ref "${SUPABASE_PROJECT_REF}" --password "${SUPABASE_DB_PASSWORD}" --yes
      - name: Deploy functions
        working-directory: backend/supabase
        run: supabase functions deploy composio-gmail-auth --no-verify-jwt
```

## Verification Steps

After deploying, verify the fix works:

1. **Check deployment status:**
   ```bash
   npx supabase functions list
   ```

2. **Test the status action:**
   - Open your application
   - Navigate to Settings page
   - Check browser console - the 400 error should be gone
   - The Gmail connection status should load correctly

3. **Monitor function logs:**
   ```bash
   npx supabase functions logs composio-gmail-auth
   ```

## Required Environment Variables

Make sure these are set in your environment or CI/CD secrets:

- `SUPABASE_ACCESS_TOKEN` - Your Supabase personal access token (get from https://supabase.com/dashboard/account/tokens)
- `SUPABASE_PROJECT_REF` - Your project reference ID (e.g., `yquhsllwrwfvrwolqywh`)
- `SUPABASE_DB_PASSWORD` - Your database password

## Expected Results After Fix

✅ **Before deployment:**
```json
{
  "error": "Invalid action"
}
```

✅ **After deployment:**
```json
{
  "isConnected": true  // or false, depending on connection status
}
```

## Files Already Fixed

The following files already contain the correct code and don't need changes:

1. ✅ `backend/supabase/supabase/functions/composio-gmail-auth/index.ts` - Has "status" action handler
2. ✅ `src/screens/Dashboard/pages/SettingsPage.tsx` - Correctly calls the status action

**No code changes are needed - only deployment!**

## Troubleshooting

### "Access token not provided"
```bash
# Solution: Login to Supabase first
npx supabase login
# Or set the token
export SUPABASE_ACCESS_TOKEN=your_token_here
```

### "Project not linked"
```bash
# Solution: Link your project
cd backend/supabase
npx supabase link --project-ref your_project_ref
```

### Function still returning "Invalid action"
- Clear your browser cache
- Check that the deployment completed successfully
- Verify you deployed to the correct project
- Check function logs for any deployment errors

## Additional Notes

- The edge function uses `@composio/core@0.2.2`
- CORS headers are already configured
- The function supports three actions: "initiate", "verify", and "status"
- No JWT verification is needed (`--no-verify-jwt` flag)
