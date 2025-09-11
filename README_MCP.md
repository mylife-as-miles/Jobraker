# MCP Supabase Integration

This project is configured with a Supabase MCP server for schema introspection and (optionally) write operations.

## Environment Variables
Set locally in `.env.local` (never commit secrets):

```
SUPABASE_PROJECT_REF=your_project_ref
SUPABASE_ACCESS_TOKEN=your_rotated_token
SUPABASE_MCP_SCHEMAS=public
```

`SUPABASE_MCP_SCHEMAS` can be a comma-separated list (e.g. `public,storage`).

## Default Mode (Read-Only)
The configured command uses `--read-only` to prevent accidental writes. Remove that flag in `mcp.config.json` to enable write operations:

```
"args": [
  "-y",
  "@supabase/mcp-server-supabase@latest",
  "--project-ref=${SUPABASE_PROJECT_REF}",
  "--schema=${SUPABASE_MCP_SCHEMAS:-public}"
]
```

## Rotating Tokens
1. Revoke exposed token in Supabase dashboard.
2. Create a new Personal Access Token with least scopes.
3. Update `.env.local`.
4. Restart your MCP client.

## Safety Tips
- Keep `.env.local` out of version control (already gitignored).
- Never paste raw tokens into issues or commits.
- Use read-only unless actively migrating or altering schema.

## Troubleshooting
- If schema mismatch errors persist, run migrations or manual repair before relying on MCP introspection.
- Ensure the CLI version is current if introspection seems stale.

## Manual Apply Flow (Parsed Resumes Schema)
If migration history is inconsistent but you need the `parsed_resumes` objects remotely now:

1. Switch to write-enabled MCP (use `supabase_write` server or remove `--read-only`).
2. Apply consolidated SQL (one time):
  - File: `backend/supabase/manual/parsed_resumes_apply.sql`
  - Or run helper script: `backend/supabase/manual/apply_parsed_resumes.sh`
  - Run via psql or the SQL editor.
3. Mark each related migration as applied to reconcile history:
  ```bash
  supabase migration repair --status applied 20250910120000
  supabase migration repair --status applied 20250910120010
  supabase migration repair --status applied 20250910123000
  supabase migration repair --status applied 20250910124500
  ```
4. Verify:
  ```sql
  select column_name, data_type from information_schema.columns where table_name='parsed_resumes';
  ```
5. Return to read-only mode for regular development.

Index Note: Defer creating a vector similarity index until you have enough rows to justify it.

## Features Flag
The MCP server can enable feature modules:

```
--features=database,docs
```

Currently used: `database` for schema introspection, `docs` for project metadata. Remove or adjust as needed in `mcp.config.json`.

