# Security Guidelines

## Supabase Keys
- `VITE_SUPABASE_ANON_KEY` is a public client key but still should be rotated if exposed alongside privileged assumptions.
- Service role keys (never committed) must NOT be prefixed with `VITE_` and only used in server-side contexts.

## Key Rotation Step
1. Go to Supabase Dashboard → Project Settings → API.
2. Click "Regenerate anon key" (and optionally service role key if compromised).
3. Update Vercel project environment variables.
4. Re-deploy (`vercel --prod` or via Git push).
5. Invalidate old builds (Vercel handles this automatically post-deploy).

