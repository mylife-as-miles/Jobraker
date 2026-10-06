# Legacy Supabase Snapshot — Do Not Deploy

This nested `backend/supabase/supabase/` tree is retained only as historical source material.

The **canonical Jobraker Supabase project** is one directory up:

- Edge Functions: `backend/supabase/functions/`
- Migrations: `backend/supabase/migrations/`
- CLI config: `backend/supabase/config.toml`
- Schema: `backend/supabase/schema.sql`

Run Supabase CLI commands from `backend/`, where the CLI resolves `backend/supabase/config.toml` correctly.

Do not implement production fixes or deploy Edge Functions from this nested snapshot. If a legacy file here is still needed, migrate the required behavior into the canonical tree first.
