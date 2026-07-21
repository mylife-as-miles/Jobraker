# Jobraker Supabase Deployment Package

Date: July 21, 2026

Repository: `mylife-as-miles/Jobraker`

Branch: `main`

Supabase project ref: `yquhsllwrwfvrwolqywh`

## Purpose

This is the complete Supabase handoff for the Job Search freshness, Auto Apply recovery, connector reliability, discovery RPC security, and transactional LinkedIn import work.

Deploy the database migrations before the Edge Functions. A GitHub push does not apply database migrations or deploy Edge Functions automatically unless a separately configured workflow does so.

## Deployment inventory

### Database migrations

Apply these files in timestamp order. `supabase db push` applies only migrations absent from the remote migration history, so a migration already present on the project should not be run manually again.

1. `backend/supabase/migrations/20260716120000_harden_auto_apply_queue_dispatch.sql`

   Required Auto Apply prerequisite. It:

   - creates the protected `edge_function_invocation_log` table;
   - creates `invoke_process_auto_apply_queue` and the queue trigger;
   - stores trigger/cron dispatch request IDs;
   - recreates the one-minute Auto Apply cron;
   - restricts privileged queue functions to `service_role`;
   - requires Vault secrets named `project_url` and `service_role_key`.

2. `backend/supabase/migrations/20260720090000_fresh_job_search_results.sql`

   Replaces `get_job_search_results_for_run(uuid)` so only `displayable = true` and `is_new_to_user = true` jobs are returned for the run. Historical duplicates remain stored for billing and diagnostics but are not shown as refreshed opportunities.

3. `backend/supabase/migrations/20260720091000_recover_stale_auto_apply_queue.sql`

   Recreates the queue cron so it processes:

   - `waiting` rows immediately;
   - `launching` rows stale for more than 10 minutes;
   - `waiting_worker` rows stale for more than 3 hours.

4. `backend/supabase/migrations/20260721090000_fix_discovery_digest_search_path.sql`

   Ensures `upsert_job_from_discovery` resolves `pgcrypto.digest()` through the `extensions` schema. It also removes `PUBLIC`, `anon`, and `authenticated` execution and grants execution only to `service_role`, because the security-definer RPC accepts a user ID and is called by the discovery worker.

5. `backend/supabase/migrations/20260721100000_transactional_linkedin_connection_import.sql`

   Adds a generated LinkedIn connection `identity_key`, removes existing duplicates, creates a partial unique index, and adds `import_linkedin_connections(text, boolean, jsonb)`. Imports become atomic, serialized per user, authenticated, and idempotent.

### Edge Functions

Deploy all six functions:

1. `jobs-search`
   - starts search tasks and returns only results associated with the current run;
   - depends on the fresh-result and discovery RPC migrations.

2. `process-task`
   - performs job discovery and persists fresh/deduplicated results;
   - calls the service-only discovery ingestion RPC.

3. `apply-to-jobs`
   - performs the Auto Apply provider dispatch and terminal-state handling;
   - includes direct queue dispatch and idempotent failure/refund behavior.

4. `process-auto-apply-queue`
   - claims waiting work and recovers stale `launching` and `waiting_worker` rows;
   - depends on the queue-hardening and recovery migrations.

5. `composio-auth`
   - uses a correlated, allowlisted OAuth callback URL;
   - supports event-driven OAuth completion and the corrected connector lifecycle;
   - resolves provider-specific Composio auth configuration IDs.

6. `sync-portfolio-integrations`
   - uses the standardized Composio SDK;
   - recognizes camel-case, snake-case, and nested connected-account formats;
   - reports provider-level and partial failures accurately.

The following shared modules are bundled automatically when their consuming functions are deployed and are not deployed separately:

- `backend/supabase/functions/_shared/discovery-freshness.ts`
- `backend/supabase/functions/_shared/discovery-hybrid.ts`
- `backend/supabase/functions/_shared/jobs.ts`
- `backend/supabase/functions/_shared/cors.ts`
- `backend/supabase/functions/_shared/composio-connected-account.ts`

## Required secrets and infrastructure

Confirm these before functional testing:

- Supabase Vault secret `project_url`: the project root URL, for example `https://yquhsllwrwfvrwolqywh.supabase.co`.
- Supabase Vault secret `service_role_key`: the project service-role key.
- Edge Function secret `COMPOSIO_API_KEY`.
- Edge Function secret `PUBLIC_APP_URL` set to the production application origin.
- Provider auth configuration secrets as used by the installation, such as `COMPOSIO_GITHUB_CONFIG_ID` and `COMPOSIO_LINKEDIN_CONFIG_ID`.
- Auto Apply worker/provider secrets used by the installation, including the configured RTRVR or Skyvern credentials and webhook secrets.
- `pg_cron`, `pg_net`, Vault, and `pgcrypto` available on the Supabase project.

Never paste access tokens, service-role keys, Vault values, or provider secrets into this file or commit them to Git.

## Commands for the Supabase teammate or agent

Start from the repository root in PowerShell:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "<token-from-secure-password-manager>"
npx supabase login --token $env:SUPABASE_ACCESS_TOKEN

Set-Location backend
npx supabase link --project-ref yquhsllwrwfvrwolqywh
```

Inspect migration history and perform a dry run first:

```powershell
npx supabase migration list --linked
npx supabase db push --include-all --dry-run
```

The dry run should include only migrations that are genuinely absent remotely. Stop and investigate if it proposes unrelated historical migrations. When the list is correct, apply it:

```powershell
npx supabase db push --include-all --yes
```

Deploy the six Edge Functions:

```powershell
npx supabase functions deploy jobs-search `
  --project-ref yquhsllwrwfvrwolqywh --use-api

npx supabase functions deploy process-task `
  --project-ref yquhsllwrwfvrwolqywh --use-api

npx supabase functions deploy apply-to-jobs `
  --project-ref yquhsllwrwfvrwolqywh --use-api

npx supabase functions deploy process-auto-apply-queue `
  --project-ref yquhsllwrwfvrwolqywh --use-api

npx supabase functions deploy composio-auth `
  --project-ref yquhsllwrwfvrwolqywh --use-api

npx supabase functions deploy sync-portfolio-integrations `
  --project-ref yquhsllwrwfvrwolqywh --use-api
```

Do not add `--no-verify-jwt` manually. The repository's `backend/supabase/config.toml` is the source of truth for each function's JWT configuration, and the functions also perform their required application-level authorization.

## Database verification

Run in the Supabase SQL editor after migration deployment.

### Confirm migration history

```sql
select version
from supabase_migrations.schema_migrations
where version in (
  '20260716120000',
  '20260720090000',
  '20260720091000',
  '20260721090000',
  '20260721100000'
)
order by version;
```

Expected: five rows.

### Confirm discovery RPC privileges

```sql
select
  has_function_privilege(
    'anon',
    'public.upsert_job_from_discovery(uuid,text,text,text,text,text,text,text,integer,integer,text,text,text[],jsonb,integer,text,text[],text,double precision,text,boolean)',
    'EXECUTE'
  ) as anon_can_execute,
  has_function_privilege(
    'authenticated',
    'public.upsert_job_from_discovery(uuid,text,text,text,text,text,text,text,integer,integer,text,text,text[],jsonb,integer,text,text[],text,double precision,text,boolean)',
    'EXECUTE'
  ) as authenticated_can_execute,
  has_function_privilege(
    'service_role',
    'public.upsert_job_from_discovery(uuid,text,text,text,text,text,text,text,integer,integer,text,text,text[],jsonb,integer,text,text[],text,double precision,text,boolean)',
    'EXECUTE'
  ) as service_role_can_execute;
```

Expected: `false`, `false`, `true`.

### Confirm cron and LinkedIn import objects

```sql
select jobname, schedule, active, command
from cron.job
where jobname = 'process-auto-apply-queue-cron';

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname = 'linkedin_connections_user_identity_key';

select column_name, is_generated, generation_expression
from information_schema.columns
where table_schema = 'public'
  and table_name = 'linkedin_connections'
  and column_name = 'identity_key';

select
  has_function_privilege(
    'authenticated',
    'public.import_linkedin_connections(text,boolean,jsonb)',
    'EXECUTE'
  ) as authenticated_can_import;
```

Expected: one active one-minute cron, the unique partial index, the generated `identity_key` column, and `authenticated_can_import = true`.

## Functional verification

### Job Search

- Run the same search twice.
- Confirm earlier jobs are not presented as newly discovered jobs.
- Confirm a run with no new matches does not fall back to historical results.
- Confirm the previous `function digest(text, unknown) does not exist` error no longer appears.

### Auto Apply

- Submit one controlled Auto Apply request and confirm it moves from queued/waiting through `launching`.
- Confirm the worker handoff progresses beyond `waiting_worker`.
- Verify stale `launching` and `waiting_worker` rows are recovered by the cron.
- Confirm terminal failure performs an idempotent refund and quota restoration.
- Inspect `edge_function_invocation_log` and the Edge Function logs for the same request.

### GitHub and LinkedIn connectors

- Connect both providers from Settings and Profile.
- Leave the OAuth popup open longer than five seconds, then finish authorization.
- Confirm the opener receives the correlated callback and live status is refreshed.
- Sync, disconnect, reconnect, and sync again.
- Force one provider to fail and confirm the UI reports a partial failure rather than overall success.

### LinkedIn CSV import

- Import a CSV containing duplicate profile URLs and emails.
- Confirm duplicates are shown during preview.
- Confirm the import completes atomically.
- Reimport the same file and confirm existing rows update instead of duplicating.
- Confirm simultaneous imports for one user serialize without unique-key failures.

## Known repository issue

`npm run lint:migrations` currently reports two older migration timestamps duplicated across `backend/migrations` and `backend/supabase/migrations`:

- `20260419130000_profiles_availability.sql`
- `20260421153000_gmail_events_withdrawal.sql`

These are pre-existing legacy duplicates; none of the five migrations listed in this handoff is duplicated. Do not delete or rename remote migration history. Reconcile the legacy mirrored files separately before making this lint rule a blocking gate.

Local Deno validation was unavailable on the original Windows workstation. Run the repository's Deno checks or deploy to a non-production Supabase project first, then inspect function logs before production rollout.
