# Archived / Placeholder Migrations

This directory stores historical or placeholder migration files that should not be applied again by the Supabase CLI.

## Reasons for Archiving
- Non-canonical filenames (not matching `YYYYMMDDHHMMSS_description.sql`).
- Intentionally blank placeholders used to reserve order or document a reverted change.
- Manual or retry variants superseded by a finalized canonical migration.

## Guidelines
- Do not place new active migrations here. New migrations must go in `supabase/migrations/` with a canonical timestamped filename.
- If a placeholder had no executable SQL (only comments like `-- intentionally blank`), it is safe to archive here.
- If you must keep context for why a placeholder existed, add a short comment block at the top of the file.

## Lint Integration
The migration lint script skips this directory (once updated) to avoid noise. If you move a file back, ensure it is renamed to the canonical pattern.

## Safe Removal
These files can generally be removed after one or two release cycles unless you need the historical breadcrumb for audits.
