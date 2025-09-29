# Archived / Ignored Migrations

These files were renamed with `.ignore` to remove them from Supabase CLI migration ordering. They represent:

- Legacy date-only versions created outside standard `<timestamp>_name.sql` pattern (20250831, 20250911, 20250922) later marked `reverted` via `supabase migration repair`.
- Placeholder or duplicate retry/manual migrations superseded by canonical applied ones.
- A retry notifications migration obsoleted by a later manual version.

## Why Archive Instead of Delete?
Keeping a record makes the repair history auditable without polluting active migration set.

## DO NOT RESTORE
Do not move these back unless you deliberately re-run repair operations. New migrations must follow the canonical 14-digit timestamp pattern.

## Repair Commands Executed
```
supabase migration repair 20250831 20250911 20250922 --status reverted
```

## Safe to Remove Later
After team consensus and if git history adequately preserves them, you may delete this folder.
