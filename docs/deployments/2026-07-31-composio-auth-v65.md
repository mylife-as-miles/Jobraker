# Composio Auth Deployment Record

Date: July 31, 2026

## Deployment target

- Organization: Area 50
- Supabase project: Jobraker
- Project reference: `yquhsllwrwfvrwolqywh`
- Edge Function: `composio-auth`
- Deployed version: `65`
- Status: `ACTIVE`
- JWT mode: `verify_jwt = false`

The function preserves application-level Supabase authentication through `requireAuthenticatedUser`.

## Source

- Pull request: `#235` — Enforce paid Composio access server-side
- Merge commit: `12a298e8bcbb3a05adc03710e4cab8d6eb9d535f`

## Deployed behavior

- `initiate`, `execute`, and `debug-configs` require the Basics plan or higher.
- Free users receive HTTP `403 Forbidden` before a Composio connection or tool operation runs.
- Authenticated users can still call `status`, `disconnect`, and `delete` after downgrading.
- Existing per-user connection isolation, ownership checks, pending-state handling, and safe disconnect behavior remain included.

## Scope

Only the `composio-auth` Edge Function bundle was deployed. No SQL migration or frontend deployment was performed.
