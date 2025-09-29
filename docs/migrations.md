# Migrations Governance

This document outlines conventions and tooling for managing Postgres migrations with Supabase.

## Filename Convention
Use canonical timestamp + snake description:

```
YYYYMMDDHHMMSS_description.sql
```

Example:
```
20250929101500_alter_profiles_add_onboarding_and_extended_fields.sql
```

## Principles
- Immutable once merged (create follow-up migration instead of editing old ones).
- Small, focused diffs (one concern per file).
- Include a brief header comment (intent + rollback hint) for complex changes.
- Prefer `ALTER TABLE ...` over recreating tables to preserve grants & RLS.

## Lint Script
Run:
```
node backend/scripts/lint-migrations.ts
```
Checks performed:
1. Filename format (canonical vs legacy) — WARN if non-canonical.
2. Chronological ordering & duplicate timestamps — ERROR for conflicts.
3. Duplicate description slugs — WARN for potential collisions.
4. Placeholder / retry / manual patterns — WARN as cleanup candidates.
5. Cross-directory duplicate timestamps (legacy vs supabase tree) — ERROR.
6. Large gaps (>14d) between canonical timestamps — WARN (sanity signal only).

Exit codes: `0` = clean or warnings only, `1` = errors present.

## Archival Strategy
Legacy or experimental migrations that should not run in fresh setups can be moved into an `migrations-archived/` or `migrations-ignored/` directory (already present in repo). The lint script currently ignores those paths.

## Adding a Migration
1. Generate base file (example using Supabase CLI diff):
   ```bash
   npm run supabase:diff
   ```
2. Rename to follow convention if needed.
3. Inspect & prune unintended changes (especially grants / policies).
4. Add header comment.
5. Commit separately from application code when possible.

## Recovery Notes
If a bad migration was merged:
- Create a new forward migration to revert objects (avoid history rewrite).
- If in dev only and safe, you may squash locally but never rewrite a shared remote history.

## Future Enhancements
- CI integration to run lint in PR workflow.
- Drift check via `supabase db diff` against committed schema snapshot.
- Automated RLS policy regression tests.

---
_Last updated: 2025-09-29_
