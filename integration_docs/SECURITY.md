# Security Guidelines

## Supabase Keys
- `VITE_SUPABASE_ANON_KEY` is a public client key but still should be rotated if exposed alongside privileged assumptions.
- Service role keys (never committed) must NOT be prefixed with `VITE_` and only used in server-side contexts.

## Key Rotation Steps
1. Go to Supabase Dashboard → Project Settings → API.
2. Click "Regenerate anon key" (and optionally service role key if compromised).
3. Update Vercel project environment variables.
4. Re-deploy (`vercel --prod` or via Git push).
5. Invalidate old builds (Vercel handles this automatically post-deploy).

## Local Development
Store secrets in `.env.local` which is already gitignored. Never commit `.env` or any file containing private tokens.

## Access Tokens
If using `SUPABASE_ACCESS_TOKEN` for CLI automation:
- Store it in your shell keychain or secret manager.
- Provide it to CI via an encrypted secret (e.g., GitHub Actions Secrets).
- Rotate periodically (e.g., every 90 days) or immediately after suspected exposure.

## Reporting Vulnerabilities
Open a private security advisory or email security@jobraker.com (placeholder) instead of filing a public issue for sensitive disclosures.

## Dependency Monitoring
Run `npm audit` regularly and apply patches for high and critical vulnerabilities.

## Browser Storage
Authentication tokens are managed by Supabase; avoid manually storing tokens in `localStorage` outside of the managed client to reduce XSS blast radius.

## Content Security Policy (Planned)
A restrictive CSP is recommended in production to mitigate XSS. Future improvement: add `meta http-equiv="Content-Security-Policy"` via a Vite plugin or HTML transform.

---
Stay vigilant: treat any logged or pasted key as compromised until confirmed otherwise.
