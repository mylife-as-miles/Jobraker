# Cold Mail Supabase Implementation and Deployment Handoff

## Purpose

This document guides the engineer or AI agent responsible for the JobRaker Supabase project through the database migration, Edge Function deployment, production verification, and operational checks required for the Cold Mail skill.

The target outcome is specific: after an authenticated user reviews and approves a generated cold email, JobRaker must create a real Gmail draft through the user's connected Gmail account, persist the provider's Gmail draft ID in Supabase, return that same ID to the frontend, and avoid creating duplicate drafts when the same approved request is retried.

This handoff does not authorize frontend redesign, unrelated schema changes, model changes, dependency upgrades, or email sending. The workflow creates Gmail drafts only.

## Production Deployment Status

Deployment was completed against the `Jobraker` Supabase project `yquhsllwrwfvrwolqywh` on 2026-09-05.

| Component | Production state |
| --- | --- |
| Migration | Applied as `20260905064539_cold_mail_draft_idempotency` |
| `public.cold_mail_drafts` | Created, RLS enabled, client table access revoked |
| `jobs-search` | Active, version 231 |
| `scout-company` | Active, version 80 |
| `generate-outreach` | Active, version 82 |
| `cold-mail` | Active, version 3 |

Post-deployment schema and bundle verification passed. The authenticated Gmail test and backend/database/provider draft-ID match remain pending until a test user with an active Gmail connection runs the workflow.

## Executive Summary

The application implementation is already present in the repository. Production confirmation requires the Supabase owner to:

1. Confirm access to Supabase project `yquhsllwrwfvrwolqywh`.
2. Review and apply migration `20260905064539_cold_mail_draft_idempotency.sql`.
3. Confirm the required Edge Function secrets are configured.
4. Deploy or verify the supporting functions used by the Cold Mail workflow.
5. Deploy `jobs-search` and then `cold-mail`, with `cold-mail` deployed last.
6. Run an authenticated end-to-end test with a real connected Gmail account.
7. Prove that the ID returned by the backend equals the ID stored in `public.cold_mail_drafts` and identifies the draft in Gmail or through the Gmail provider API.
8. Repeat the same approved request and confirm that the existing draft ID is replayed rather than creating a second Gmail draft.

## Repository and Project Details

| Item | Value |
| --- | --- |
| Repository root | `C:\Users\User\Documents\Jobraker` |
| Supabase CLI working directory | `backend` |
| Supabase configuration | `backend/supabase/config.toml` |
| Supabase project reference | `yquhsllwrwfvrwolqywh` |
| Migration | `backend/supabase/migrations/20260905064539_cold_mail_draft_idempotency.sql` |
| Main orchestration function | `backend/supabase/functions/cold-mail/index.ts` |
| Opportunity discovery function | `backend/supabase/functions/jobs-search/index.ts` |
| Recruiter research function | `backend/supabase/functions/scout-company/index.ts` |
| Draft-writing function | `backend/supabase/functions/generate-outreach/index.ts` |
| Gmail provider adapter | `backend/supabase/functions/_shared/composio-gmail.ts` |
| Gmail agent adapter | `backend/supabase/functions/_shared/gmail-job-agent-tools.ts` |
| Idempotency helper | `backend/supabase/functions/_shared/cold-mail-draft-idempotency.ts` |

Run Supabase CLI commands from `backend`, because it is the directory containing the `supabase` folder.

## Implemented Workflow

### Discovery

The frontend calls `cold-mail` with `action: "discover"`. The function infers a target role and location from the user's current profile or supplied search input, then invokes `jobs-search` synchronously. The response contains saved job targets for the user to select.

### Preparation

The frontend calls `cold-mail` with `action: "prepare"` and the selected job context. The function:

1. Resolves the selected job while enforcing ownership.
2. Invokes `scout-company` to research the company and find an evidence-backed recruiter, hiring manager, or public recruitment email.
3. Loads candidate evidence from the authenticated user's profile, experience, education, skills, and public profile.
4. Invokes `generate-outreach` to create the subject and body.
5. Returns a preview and a signed preparation token with `status: "needs_approval"`.

No Gmail write occurs during preparation.

### Approved Gmail Draft Creation

After user approval, the frontend calls `cold-mail` with:

```json
{
  "action": "create_gmail_draft",
  "preparationToken": "<signed-token-from-prepare>"
}
```

The function then:

1. Authenticates the user and checks the required subscription tier.
2. Verifies the preparation token signature, expiry, and user ownership.
3. Computes a SHA-256 fingerprint of the token without storing the token itself.
4. Reserves a row in `public.cold_mail_drafts` with status `creating`.
5. Uses the user's active Composio Gmail connection to call `GMAIL_CREATE_EMAIL_DRAFT`.
6. Requires a non-empty provider `draftId` before reporting success.
7. Stores the Gmail draft, message, and thread identifiers and changes the row to `created`.
8. Returns the confirmed provider identifiers to the frontend.

The success response has this shape:

```json
{
  "success": true,
  "draftId": "<gmail-provider-draft-id>",
  "messageId": "<gmail-message-id-or-null>",
  "threadId": "<gmail-thread-id-or-null>",
  "draftFrom": "<connected-gmail-address-or-null>",
  "to": "<recipient-email>"
}
```

The draft ID is distinct from the Gmail message ID. The frontend success state must be based on `success: true` and a non-empty `draftId`, not merely a successful HTTP call.

## Database Migration

### What the Migration Adds

The migration creates `public.cold_mail_drafts` as a server-owned Gmail draft idempotency ledger.

Important fields include:

| Column | Purpose |
| --- | --- |
| `user_id` | Owns the attempt and references `auth.users` |
| `job_id` | Links the draft attempt to the selected job when available |
| `request_fingerprint` | SHA-256 fingerprint of the signed preparation token |
| `recipient_email` | Records the intended recipient |
| `subject` | Records the approved subject |
| `status` | `creating`, `created`, or `uncertain` |
| `provider_draft_id` | Gmail draft ID returned by Composio/Gmail |
| `provider_message_id` | Gmail message ID when returned |
| `provider_thread_id` | Gmail thread ID when returned |
| `draft_from` | Connected Gmail address used for the draft |
| `error_code` | Provider or confirmation failure code |

The unique constraint on `(user_id, request_fingerprint)` prevents concurrent or repeated use of the same approved preparation token from reserving multiple provider writes.

The migration deliberately does not store the preparation token or email body. This limits exposure of signed data and message content. Recipient address and subject remain personal data and must be handled under the project's normal retention and access controls.

### Security Model

The table is in the `public` schema but is not a client-facing Data API table:

- Row Level Security is enabled.
- All table privileges are revoked from `public`, `anon`, and `authenticated`.
- Table privileges are granted only to `service_role`.
- No permissive client RLS policies are created.
- The service-role key must never be exposed to frontend code.
- The `cold-mail` function authenticates the caller and scopes all operations to the authenticated `user.id`.

Do not add an `authenticated` policy just to make the table visible in the browser. The frontend receives only the function's controlled response.

### Pre-Migration Checks

From the repository root:

```powershell
git status --short
npx supabase --version
npm run lint:migrations
```

The repository currently contains pre-existing migration-lint findings involving duplicate historical definitions outside this change, including the profiles availability and Gmail events withdrawal migrations under both `backend/migrations` and `backend/supabase/migrations`. Do not rename, delete, or rewrite historical migrations as part of this handoff. Confirm specifically that the new Cold Mail migration does not introduce an additional finding.

Inspect the migration before applying it:

```powershell
Get-Content -Raw .\backend\supabase\migrations\20260905064539_cold_mail_draft_idempotency.sql
```

### Authenticate and Link the Correct Project

Do not paste access tokens, database passwords, service-role keys, or provider secrets into chat, source files, commit messages, or logs.

PowerShell:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "<set-locally>"
$env:SUPABASE_DB_PASSWORD = "<set-locally>"
npx supabase login --token $env:SUPABASE_ACCESS_TOKEN
Set-Location .\backend
npx supabase link --project-ref yquhsllwrwfvrwolqywh --password $env:SUPABASE_DB_PASSWORD --yes
npx supabase projects list
```

Bash or Git Bash:

```bash
export SUPABASE_ACCESS_TOKEN='<set-locally>'
export SUPABASE_DB_PASSWORD='<set-locally>'
npx supabase login --token "$SUPABASE_ACCESS_TOKEN"
cd backend
npx supabase link --project-ref yquhsllwrwfvrwolqywh --password "$SUPABASE_DB_PASSWORD" --yes
npx supabase projects list
```

Stop if the linked project reference is not exactly `yquhsllwrwfvrwolqywh`.

### Review the Pending Migration

From `backend`:

```powershell
npx supabase migration list --linked
npx supabase db push --linked --include-all --dry-run -p $env:SUPABASE_DB_PASSWORD
```

Review the dry-run output. It must include `20260905064539_cold_mail_draft_idempotency.sql`. Investigate any unexpected pending migration before continuing; do not blindly apply unrelated schema changes.

### Apply the Migration

From `backend`:

```powershell
npx supabase db push --linked --include-all --yes -p $env:SUPABASE_DB_PASSWORD
```

Equivalent command following the repository deployment convention:

```bash
npx supabase db push --include-all --yes
```

Do not deploy the new `cold-mail` function until the table exists. Otherwise, the first approved draft request will fail during idempotency lookup or reservation.

### Verify the Migration

Run these read-only checks in the Supabase SQL Editor or through an authenticated administrative SQL connection:

```sql
select version
from supabase_migrations.schema_migrations
where version = '20260905064539';

select
  to_regclass('public.cold_mail_drafts') as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
where c.oid = 'public.cold_mail_drafts'::regclass;

select
  has_table_privilege('anon', 'public.cold_mail_drafts', 'select')
    as anon_can_select,
  has_table_privilege('authenticated', 'public.cold_mail_drafts', 'select')
    as authenticated_can_select,
  has_table_privilege('service_role', 'public.cold_mail_drafts', 'select')
    as service_role_can_select;

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.cold_mail_drafts'::regclass
order by conname;
```

Expected results:

- Migration version `20260905064539` is present once.
- `table_name` is `cold_mail_drafts`.
- `rls_enabled` is `true`.
- `anon_can_select` is `false`.
- `authenticated_can_select` is `false`.
- `service_role_can_select` is `true`.
- The unique user/fingerprint constraint and the created-status/provider-ID constraint are present.

## Edge Function Secrets

### Supabase-Provided Runtime Variables

Hosted Supabase Edge Functions normally receive the following project variables automatically:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Confirm they resolve in the hosted runtime, but do not copy their values into the repository or expose them in responses.

### Required Application Secrets

| Secret | Used by | Requirement |
| --- | --- | --- |
| `COMPOSIO_API_KEY` | Gmail connection lookup and Gmail draft creation | Required |
| `COLD_MAIL_SIGNING_SECRET` | Signs and verifies approved preparation tokens | Required for production; use a dedicated high-entropy secret |
| `GEMINI_API_KEY` | `generate-outreach` drafting | Required for generated outreach |
| `RTRVR_API_KEY` | Job opportunity discovery through the repository's provider adapter | Required for the configured discovery path |

The code can fall back from `COLD_MAIL_SIGNING_SECRET` to `SUPABASE_SERVICE_ROLE_KEY`, but production should use a dedicated signing secret. This permits independent rotation and avoids coupling token validity to a database credential.

### Contact Research Secrets

| Secret | Used by | Requirement |
| --- | --- | --- |
| `FIRECRAWL_API_KEY` | `scout-company` public company and recruiter research | Configure for the current scout research path |
| `RECRUITER_EMAIL_VERIFIER_URL` | External recruiter/contact email provider | Required when an external verifier is part of the production workflow |
| `RECRUITER_EMAIL_VERIFIER_API_KEY` | Authenticates the external verifier request | Required when that verifier requires authentication |

The contact provider URL must use HTTPS in production. Confirm its response format is compatible with `scout-company` before the live test. The system must not invent an email address when no evidence-backed or provider-verified address is available.

### Set and Verify Secrets

Set values locally or in a secrets manager first. Do not substitute real values directly into a document or commit.

From `backend`, PowerShell example:

```powershell
npx supabase secrets set `
  COMPOSIO_API_KEY="$env:COMPOSIO_API_KEY" `
  COLD_MAIL_SIGNING_SECRET="$env:COLD_MAIL_SIGNING_SECRET" `
  GEMINI_API_KEY="$env:GEMINI_API_KEY" `
  RTRVR_API_KEY="$env:RTRVR_API_KEY" `
  FIRECRAWL_API_KEY="$env:FIRECRAWL_API_KEY" `
  RECRUITER_EMAIL_VERIFIER_URL="$env:RECRUITER_EMAIL_VERIFIER_URL" `
  RECRUITER_EMAIL_VERIFIER_API_KEY="$env:RECRUITER_EMAIL_VERIFIER_API_KEY" `
  --project-ref yquhsllwrwfvrwolqywh

npx supabase secrets list --project-ref yquhsllwrwfvrwolqywh
```

Only include optional contact-provider variables in the command when they are actually configured. `secrets list` should confirm names and digests; it must not be used to print secret values.

## Edge Function Deployment

### Functions Required by the End-to-End Flow

The Cold Mail orchestrator depends on these deployed functions:

| Function | Role | Deployment action |
| --- | --- | --- |
| `jobs-search` | Searches approved public opportunity sources and saves target jobs | Deploy this update |
| `scout-company` | Researches the company and resolves an evidence-backed recipient | Verify compatible production version; deploy if missing or behind the repository |
| `generate-outreach` | Generates the reviewed email subject and body | Verify compatible production version; deploy if missing or behind the repository |
| `cold-mail` | Orchestrates discovery, preparation, approval, Gmail creation, persistence, and idempotency | Deploy last |

The `cold-mail` call to `jobs-search` uses synchronous execution, so the asynchronous `process-task` path is not required specifically for this Cold Mail test.

### Authentication Configuration

`backend/supabase/config.toml` sets `verify_jwt = false` for these browser-invoked functions so that CORS preflight reaches the handler. This does not mean the operation is anonymous:

- `cold-mail` calls `requireSubscriptionTier` and validates the bearer token internally.
- `jobs-search` calls the repository's authenticated-user helper internally.
- User ownership is enforced when jobs, profile data, and draft attempts are loaded.

Do not change `verify_jwt` or the internal authentication architecture as part of this deployment without a separate security review.

### Deploy in Order

From `backend`:

```powershell
npx supabase functions deploy jobs-search --project-ref yquhsllwrwfvrwolqywh --use-api
npx supabase functions deploy scout-company --project-ref yquhsllwrwfvrwolqywh --use-api
npx supabase functions deploy generate-outreach --project-ref yquhsllwrwfvrwolqywh --use-api
npx supabase functions deploy cold-mail --project-ref yquhsllwrwfvrwolqywh --use-api
```

If `scout-company` and `generate-outreach` are already deployed from the same compatible commit, they may be verified instead of redeployed. `jobs-search` and `cold-mail` must contain the current repository changes.

Use `--use-api` when Docker is not running. The CLI bundles shared imports referenced from `backend/supabase/functions/_shared`.

After deployment:

```powershell
npx supabase functions list --project-ref yquhsllwrwfvrwolqywh
```

Confirm all four functions are active. Review the deployment output for import, bundle, or secret-resolution errors.

## Production Test Preconditions

Use a dedicated test user and a safe recipient address controlled by the team. Before testing, confirm:

- The user can authenticate to JobRaker.
- The user has at least the `Basics` subscription entitlement required by Cold Mail.
- The user has an active Gmail connection in Settings and Integrations.
- The Composio connected-account user identifier matches the authenticated Supabase user ID.
- The Gmail connection includes permission to create drafts.
- The user has a usable target role or search query.
- The user profile contains enough candidate evidence: a job title, experience, or skills.
- At least one selected opportunity is saved to the user's `jobs` records.
- The selected company can produce an evidence-backed recruiter or recruitment contact.
- The test recipient and subject are clearly identifiable and do not contain sensitive production data.

Do not test by sending an email. The expected Gmail artifact must remain a draft.

## Authenticated End-to-End Test

### Test 1 Opportunity Discovery

1. Sign in to the production application as the test user.
2. Open AI Chat and click the independent Cold Mail skill.
3. Allow the skill to infer the current job-search context or provide a narrow search query.
4. Confirm the UI displays selectable company and job targets returned by the backend.
5. Select one target.

Expected backend behavior:

- `cold-mail` receives `action: "discover"`.
- `jobs-search` returns `success: true` and saved jobs.
- The Cold Mail response is `awaiting_target_selection` with one or more target records.
- The target chosen by the user resolves to a job owned by that user.

### Test 2 Prepare and Review

1. Continue with the selected target.
2. Confirm company/recruiter research completes.
3. Confirm a recipient, subject, and body are displayed for review.
4. Confirm the UI requires explicit approval before the Gmail draft write.

Expected backend behavior:

- `cold-mail` receives `action: "prepare"`.
- `scout-company` returns an evidence-backed contact.
- `generate-outreach` returns a non-empty subject and body.
- The response has `status: "needs_approval"` and a `preparationToken`.
- No row is created in `cold_mail_drafts` yet.
- No Gmail draft exists yet.

### Test 3 Create the Gmail Draft

1. Approve the reviewed email once.
2. Capture the `cold-mail` network response for `action: "create_gmail_draft"`.
3. Record `draftId`, `messageId`, `threadId`, `draftFrom`, and `to` from the response.
4. Confirm the UI displays Gmail drafted successfully only after receiving `success: true` with a non-empty `draftId`.

Expected response:

- HTTP `200`.
- `success` is `true`.
- `draftId` is non-empty.
- `draftFrom` is the Gmail account connected by the test user when the provider reports it.
- No send operation occurs.

### Test 4 Verify Database Persistence

Use the Supabase SQL Editor with administrative access. Replace the placeholders without committing or sharing real user data:

```sql
select
  id,
  user_id,
  job_id,
  status,
  provider_draft_id,
  provider_message_id,
  provider_thread_id,
  draft_from,
  recipient_email,
  subject,
  error_code,
  created_at,
  updated_at
from public.cold_mail_drafts
where user_id = '<test-user-uuid>'::uuid
order by created_at desc
limit 5;
```

Expected result for the new attempt:

- `status = 'created'`.
- `provider_draft_id` exactly equals the backend response `draftId`.
- `provider_message_id` equals the response `messageId` when provided.
- `provider_thread_id` equals the response `threadId` when provided.
- `recipient_email` equals the reviewed recipient.
- `error_code` is null.
- The preparation token and body are not stored.

### Test 5 Verify the Artifact in Gmail

1. Open Gmail for the same account identified by `draftFrom`.
2. Open the Drafts folder.
3. Locate the new draft by its unique test subject and recipient.
4. Confirm the subject, recipient, and body match the approved preview.
5. Use Composio's `GMAIL_GET_DRAFT` tool or equivalent Gmail provider lookup with the backend-returned `draftId` for a direct identifier check.
6. Confirm the provider lookup resolves the same draft visible in Gmail.

Gmail's normal UI may not display the provider draft ID directly. The authoritative ID match is therefore:

```text
cold-mail response draftId
  = public.cold_mail_drafts.provider_draft_id
  = ID accepted and returned by GMAIL_GET_DRAFT
```

The Gmail UI inspection independently proves that the provider artifact is visible in the user's Drafts folder.

### Test 6 Verify Idempotency

Replay the exact same `create_gmail_draft` request using the same preparation token.

Expected response:

```json
{
  "success": true,
  "draftId": "<same-draft-id-as-first-call>",
  "idempotentReplay": true
}
```

Then verify:

- The returned `draftId` is unchanged.
- Only one database row exists for that user and request fingerprint.
- Only one matching Gmail draft exists.
- The provider draft-create tool was not called a second time.

The same approved token is idempotent. A newly prepared email receives a new signed token and may intentionally create a new draft after a new approval.

### Test 7 Verify Failure Safety

If a provider result is missing a draft ID or the draft's final state cannot be confirmed:

- The request must not report success.
- The row must remain `creating` or become `uncertain`.
- A repeat attempt with the same token must return HTTP `409` with code `gmail_draft_state_uncertain`.
- The operator must inspect Gmail before deciding whether a new preparation and approval are safe.

Do not delete an uncertain row merely to make a retry pass. That can create a duplicate Gmail draft.

## Acceptance Criteria

Production confirmation is complete only when every item below is checked:

- [ ] Supabase project `yquhsllwrwfvrwolqywh` is the linked and deployed target.
- [ ] Migration `20260905064539` is recorded in migration history.
- [ ] `public.cold_mail_drafts` exists with RLS enabled.
- [ ] `anon` and `authenticated` have no direct table privileges.
- [ ] `service_role` can read and write the ledger.
- [ ] Required Supabase and provider secret names are configured.
- [ ] `jobs-search` is deployed from the current repository version.
- [ ] `scout-company` and `generate-outreach` are present and compatible.
- [ ] `cold-mail` is deployed after the migration.
- [ ] An authenticated production user can discover and select a job target.
- [ ] Preparation produces a reviewable recipient, subject, body, and signed token.
- [ ] Gmail draft creation returns HTTP 200 and a non-empty `draftId`.
- [ ] The backend `draftId` equals `cold_mail_drafts.provider_draft_id`.
- [ ] The same ID resolves through the Gmail provider lookup.
- [ ] The draft is visibly present in the connected Gmail account.
- [ ] The draft content matches the user-approved preview.
- [ ] Replaying the same token returns the same draft ID with `idempotentReplay: true`.
- [ ] The replay creates neither a second database row nor a second Gmail draft.
- [ ] No email was sent during testing.

## Troubleshooting Guide

### Access token not provided

Symptom:

```text
Access token not provided
```

Action:

- Configure `SUPABASE_ACCESS_TOKEN` locally.
- Run `supabase login --token` again.
- Do not paste the token into chat or commit it.

### Permission denied for the project

Action:

- Confirm the authenticated Supabase account belongs to the organization that owns `yquhsllwrwfvrwolqywh`.
- Confirm the account has permission to manage database migrations, secrets, and Edge Functions.
- Stop rather than deploying to a similarly named or unrelated project.

### Cold Mail cannot verify or reserve idempotency

Likely causes:

- Migration was not applied.
- Function was deployed before the table existed.
- `SUPABASE_SERVICE_ROLE_KEY` is unavailable in the runtime.
- Table grants differ from the migration.

Actions:

- Run the migration verification SQL.
- Confirm the function is operating with the server-side service client.
- Do not grant browser roles direct table access.

### Gmail is not connected

Possible codes:

- `gmail_not_connected`
- `gmail_authorization_incomplete`
- `gmail_unauthorized`

Actions:

- Reconnect Gmail from Settings and Integrations as the same authenticated user.
- Complete any pending OAuth consent.
- Confirm the Composio connection is active and scoped to the Supabase user ID.
- Re-authorize if Gmail draft scopes are missing.

### Gmail reports success without a draft ID

Expected application behavior:

- Return `gmail_draft_unconfirmed` rather than success.
- Persist the attempt as `uncertain`.
- Block automatic retry with the same preparation token.

Operator action:

- Inspect Gmail Drafts and the Composio execution result.
- Do not clear the ledger or retry until the provider artifact's existence is known.

### Recruiter or contact is not found

Actions:

- Review `scout-company` logs.
- Confirm `FIRECRAWL_API_KEY` and the configured contact provider variables.
- Confirm the provider returned evidence and an email address in the expected format.
- Prefer a public recruitment address when supported by evidence.
- Do not generate or guess an unverified personal email.

### Opportunity discovery returns no targets

Actions:

- Review `jobs-search` logs and provider configuration.
- Confirm `RTRVR_API_KEY` is configured for the repository's discovery adapter.
- Confirm the test user's job-search profile contains a target role or provide a search query.
- Confirm discovered jobs were persisted for the authenticated user.

### CORS or browser preflight fails

Actions:

- Confirm `verify_jwt = false` remains set for the browser-invoked functions in `config.toml`.
- Confirm the handler still answers `OPTIONS` requests.
- Confirm the application origin is accepted by the shared CORS helper.
- Do not remove internal bearer-token validation.

## Logs and Evidence to Retain

For the deployment record, retain:

- Migration dry-run output.
- Migration push result.
- Function deployment results and deployed timestamps.
- Function logs for the successful test request.
- Redacted `cold-mail` response showing the draft identifiers.
- Redacted database row showing the same provider draft ID.
- Composio or Gmail lookup confirmation for that ID.
- Screenshot showing the draft in Gmail, with personal content redacted as needed.
- Idempotent replay response and confirmation that no duplicate exists.

Do not retain access tokens, database passwords, service-role keys, signing secrets, Gmail OAuth tokens, full preparation tokens, or unnecessary email body content in the evidence package.

## Rollback and Incident Handling

If the deployed function causes an incident:

1. Stop new Cold Mail draft traffic or redeploy the last known-good `cold-mail` function version.
2. Leave `public.cold_mail_drafts` in place initially. It is additive and contains evidence needed to prevent or investigate duplicate drafts.
3. Inspect all `creating` and `uncertain` rows before allowing retries.
4. Compare provider execution logs and Gmail Drafts before changing any status.
5. Rotate a compromised provider or signing secret immediately and redeploy affected functions.
6. Remove the table only through a new reviewed migration after a retention and rollback decision. Do not delete the migration from history or manually erase the ledger during an active incident.

## Final Handoff Record

Complete this section during deployment:

| Record | Value |
| --- | --- |
| Supabase operator |  |
| Deployment date and time |  |
| Source commit |  |
| Target project ref | `yquhsllwrwfvrwolqywh` |
| Migration applied |  |
| `jobs-search` deployment ID or timestamp |  |
| `scout-company` verified or deployed |  |
| `generate-outreach` verified or deployed |  |
| `cold-mail` deployment ID or timestamp |  |
| Test user ID |  |
| Backend draft ID |  |
| Database provider draft ID |  |
| Gmail provider lookup matched |  |
| Gmail UI draft confirmed |  |
| Idempotent replay confirmed |  |
| Operator sign-off |  |

## Official References

- Supabase database migrations: https://supabase.com/docs/guides/deployment/database-migrations
- Supabase Edge Function deployment: https://supabase.com/docs/guides/functions/deploy
- Supabase Edge Function secrets: https://supabase.com/docs/guides/functions/secrets
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase changelog: https://supabase.com/changelog


## Appendix A Embedded Migration File

The following is the complete migration currently stored at `backend/supabase/migrations/20260905064539_cold_mail_draft_idempotency.sql`. The repository file remains the deployment source of truth.

````sql
create table public.cold_mail_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  request_fingerprint text not null
    check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  recipient_email text not null,
  subject text not null,
  status text not null default 'creating'
    check (status in ('creating', 'created', 'uncertain')),
  provider_draft_id text,
  provider_message_id text,
  provider_thread_id text,
  draft_from text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cold_mail_drafts_user_request_unique
    unique (user_id, request_fingerprint),
  constraint cold_mail_drafts_created_has_provider_id
    check (status <> 'created' or provider_draft_id is not null)
);

create index cold_mail_drafts_user_created_idx
  on public.cold_mail_drafts (user_id, created_at desc);

alter table public.cold_mail_drafts enable row level security;

revoke all on table public.cold_mail_drafts from public, anon, authenticated;
grant all on table public.cold_mail_drafts to service_role;

comment on table public.cold_mail_drafts is
  'Server-owned idempotency ledger for approved Cold Mail Gmail draft writes.';

comment on column public.cold_mail_drafts.request_fingerprint is
  'SHA-256 fingerprint of the signed preparation token; the token itself is never stored.';

````

## Appendix B Embedded Required Edge Function Entrypoints

These are complete snapshots of the two Edge Function entrypoints that must be deployed for this update. Deploy them from the repository with the Supabase CLI so that all imported files under `functions/_shared` are bundled. Do not copy only these entrypoint blocks into the Supabase Dashboard editor.

### Cold Mail Edge Function

Source: `backend/supabase/functions/cold-mail/index.ts`

````typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  SubscriptionAccessError,
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";
import { agentCreateJobRelatedDraft } from "../_shared/gmail-job-agent-tools.ts";
import {
  confirmGmailDraftResult,
  createColdMailPreparationToken,
  selectColdMailRecipient,
  verifyColdMailPreparationToken,
  type ColdMailPreparation,
} from "../_shared/cold-mail-contract.ts";
import {
  fingerprintColdMailPreparationToken,
  resolveColdMailDraftAttempt,
  type ColdMailDraftAttemptRow,
} from "../_shared/cold-mail-draft-idempotency.ts";

type PrepareRequest = {
  action: "prepare";
  jobId?: string;
  companyName?: string;
  jobTitle?: string;
  applyUrl?: string;
  instructions?: string;
};

type DiscoverRequest = {
  action: "discover";
  searchQuery?: string;
  location?: string;
  limit?: number;
};

type CreateDraftRequest = {
  action: "create_gmail_draft";
  preparationToken?: string;
};

type ColdMailRequest = DiscoverRequest | PrepareRequest | CreateDraftRequest;

class RequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "RequestError";
  }
}

const asString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const boundedString = (
  value: unknown,
  field: string,
  maxLength: number,
) => {
  const parsed = asString(value);
  if (parsed.length > maxLength) {
    throw new RequestError(400, `${field} is too long.`);
  }
  return parsed;
};

const jsonResponse = (
  payload: Record<string, unknown>,
  status: number,
  headers: Record<string, string>,
) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });

const signingSecret = () => {
  const secret =
    asString(Deno.env.get("COLD_MAIL_SIGNING_SECRET")) ||
    asString(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if (!secret) throw new Error("Cold Mail signing is not configured.");
  return secret;
};

async function invokeSpecialist(
  req: Request,
  functionName: string,
  payload: Record<string, unknown>,
) {
  const supabaseUrl = asString(Deno.env.get("SUPABASE_URL")).replace(/\/$/, "");
  const apiKey = asString(Deno.env.get("SUPABASE_ANON_KEY"));
  const authorization = asString(req.headers.get("Authorization"));
  if (!supabaseUrl || !apiKey || !authorization) {
    throw new Error("Cold Mail specialist invocation is not configured.");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      apikey: apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  const raw = await response.text();
  let data: unknown = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }
  if (!response.ok) {
    const message =
      data && typeof data === "object"
        ? asString((data as Record<string, unknown>).error)
        : asString(data);
    throw new RequestError(
      response.status,
      message || `${functionName} failed (${response.status}).`,
    );
  }
  return data;
}

async function resolveJob(
  serviceClient: any,
  userId: string,
  request: PrepareRequest,
) {
  const jobId = asString(request.jobId);
  const companyName = asString(request.companyName);
  const requestedTitle = asString(request.jobTitle);
  const applyUrl = asString(request.applyUrl);

  if (jobId) {
    const { data, error } = await serviceClient
      .from("jobs")
      .select("id, title, company, description, apply_url")
      .eq("id", jobId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("cold-mail job lookup failed", {
        code: error.code,
        message: error.message,
      });
      throw new RequestError(
        500,
        "Cold Mail could not load the selected job. Please try again.",
      );
    }
    if (!data) throw new RequestError(404, "The selected job could not be found.");
    return data as Record<string, unknown>;
  }

  if (applyUrl) {
    const { data, error } = await serviceClient
      .from("jobs")
      .select("id, title, company, description, apply_url")
      .eq("user_id", userId)
      .eq("apply_url", applyUrl)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("cold-mail job URL lookup failed", {
        code: error.code,
        message: error.message,
      });
      throw new RequestError(
        500,
        "Cold Mail could not load the selected job. Please try again.",
      );
    }
    if (data) return data as Record<string, unknown>;
  }

  if (!companyName) {
    throw new RequestError(
      400,
      "Cold Mail needs one job or company from the current job-search context.",
    );
  }

  const { data, error } = await serviceClient
    .from("jobs")
    .select("id, title, company, description, apply_url, created_at")
    .eq("user_id", userId)
    .ilike("company", companyName)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) {
    console.error("cold-mail job lookup failed", {
      code: error.code,
      message: error.message,
    });
    throw new RequestError(
      500,
      "Cold Mail could not load the selected job. Please try again.",
    );
  }

  const jobs = Array.isArray(data) ? data : [];
  const requestedTitleLower = requestedTitle.toLowerCase();
  const exactJob = requestedTitleLower
    ? jobs.find((job: Record<string, unknown>) => {
        const title = asString(job.title).toLowerCase();
        return (
          title === requestedTitleLower ||
          title.includes(requestedTitleLower) ||
          requestedTitleLower.includes(title)
        );
      })
    : jobs[0];

  if (!exactJob) {
    throw new RequestError(
      404,
      "That individual job was not found in the current saved job search.",
    );
  }
  return exactJob as Record<string, unknown>;
}

async function inferSearchPreference(
  serviceClient: any,
  userId: string,
  request: DiscoverRequest,
) {
  const requestedQuery = boundedString(
    request.searchQuery,
    "searchQuery",
    200,
  );
  const requestedLocation = boundedString(
    request.location,
    "location",
    120,
  );
  if (requestedQuery) {
    return {
      searchQuery: requestedQuery,
      location: requestedLocation || "Remote",
    };
  }

  const [profileResult, experienceResult] = await Promise.all([
    serviceClient
      .from("profiles")
      .select("job_title, location")
      .eq("id", userId)
      .maybeSingle(),
    serviceClient
      .from("profile_experiences")
      .select("title")
      .eq("user_id", userId)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const searchQuery =
    asString(profileResult.data?.job_title) ||
    asString(experienceResult.data?.title);
  if (!searchQuery) {
    throw new RequestError(
      422,
      "Cold Mail needs a target role. Add one to your profile or include it with the skill.",
    );
  }
  return {
    searchQuery,
    location:
      requestedLocation || asString(profileResult.data?.location) || "Remote",
  };
}

async function discoverColdMailTargets(
  req: Request,
  serviceClient: any,
  userId: string,
  request: DiscoverRequest,
) {
  const preference = await inferSearchPreference(serviceClient, userId, request);
  const limit = Number.isFinite(Number(request.limit))
    ? Math.max(1, Math.min(10, Math.floor(Number(request.limit))))
    : 10;
  const result = await invokeSpecialist(req, "jobs-search", {
    searchQuery: preference.searchQuery,
    location: preference.location,
    limit,
    async: false,
  });
  const resultRecord =
    result && typeof result === "object" && !Array.isArray(result)
      ? (result as Record<string, unknown>)
      : {};
  if (resultRecord.success !== true) {
    throw new RequestError(502, "Cold Mail opportunity search did not complete.");
  }

  const discovered = Array.isArray(resultRecord.jobs)
    ? resultRecord.jobs
        .filter(
          (job): job is Record<string, unknown> =>
            Boolean(job) && typeof job === "object" && !Array.isArray(job),
        )
        .slice(0, limit)
    : [];
  const applyUrls = Array.from(
    new Set(discovered.map((job) => asString(job.url)).filter(Boolean)),
  );
  if (!applyUrls.length) {
    return {
      success: true,
      status: "awaiting_target_selection",
      searchQuery: preference.searchQuery,
      location: preference.location,
      targets: [],
      agentRunId: asString(resultRecord.agent_run_id) || undefined,
    };
  }

  const { data: savedJobs, error: savedJobsError } = await serviceClient
    .from("jobs")
    .select("id, title, company, location, apply_url, source_kind")
    .eq("user_id", userId)
    .in("apply_url", applyUrls);
  if (savedJobsError) {
    console.error("cold-mail discovered job lookup failed", {
      code: savedJobsError.code,
      message: savedJobsError.message,
    });
    throw new RequestError(500, "Cold Mail could not load discovered targets.");
  }

  const agentRunId = asString(resultRecord.agent_run_id);
  let resultIdByJobId = new Map<string, string>();
  if (agentRunId) {
    const { data: searchResults, error: searchResultsError } =
      await serviceClient
        .from("job_search_results")
        .select("id, job_id")
        .eq("user_id", userId)
        .eq("agent_run_id", agentRunId);
    if (searchResultsError) {
      console.warn("cold-mail search result ID lookup failed", {
        code: searchResultsError.code,
        message: searchResultsError.message,
      });
    } else {
      resultIdByJobId = new Map(
        (Array.isArray(searchResults) ? searchResults : []).map(
          (row: Record<string, unknown>) => [asString(row.job_id), asString(row.id)],
        ),
      );
    }
  }

  const savedByUrl = new Map(
    (Array.isArray(savedJobs) ? savedJobs : []).map(
      (job: Record<string, unknown>) => [asString(job.apply_url), job],
    ),
  );
  const targets = discovered.flatMap((job) => {
    const saved = savedByUrl.get(asString(job.url));
    const jobId = asString(saved?.id);
    const jobTitle = asString(saved?.title) || asString(job.title);
    const companyName = asString(saved?.company) || asString(job.company);
    const applyUrl = asString(saved?.apply_url) || asString(job.url);
    if (!jobId || !jobTitle || !companyName || !applyUrl) return [];
    const searchResultId = resultIdByJobId.get(jobId);
    return [
      {
        jobId,
        ...(searchResultId ? { searchResultId } : {}),
        jobTitle,
        companyName,
        applyUrl,
        location: asString(saved?.location) || asString(job.location),
        source: asString(saved?.source_kind) || asString(job.source_kind),
      },
    ];
  });

  return {
    success: true,
    status: "awaiting_target_selection",
    searchQuery: preference.searchQuery,
    location: preference.location,
    targets,
    agentRunId: agentRunId || undefined,
  };
}

async function loadCandidateEvidence(serviceClient: any, userId: string) {
  const { data: favoriteResume } = await serviceClient
    .from("resumes")
    .select("id")
    .eq("user_id", userId)
    .eq("is_favorite", true)
    .maybeSingle();

  let resume = favoriteResume;
  if (!resume) {
    const { data } = await serviceClient
      .from("resumes")
      .select("id")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    resume = data;
  }

  if (resume?.id) {
    const { data } = await serviceClient
      .from("parsed_resumes")
      .select("raw_text")
      .eq("resume_id", resume.id)
      .order("extracted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const rawText = asString(data?.raw_text);
    if (rawText) return rawText;
  }

  const [profileResult, experienceResult, educationResult, skillsResult] =
    await Promise.all([
      serviceClient.from("profiles").select("*").eq("id", userId).maybeSingle(),
      serviceClient
        .from("profile_experiences")
        .select("title, company, start_date, end_date, description")
        .eq("user_id", userId)
        .order("start_date", { ascending: false }),
      serviceClient
        .from("profile_education")
        .select("degree, school")
        .eq("user_id", userId)
        .order("start_date", { ascending: false }),
      serviceClient
        .from("profile_skills")
        .select("name")
        .eq("user_id", userId),
    ]);

  const profile = profileResult.data || {};
  const experiences = Array.isArray(experienceResult.data)
    ? experienceResult.data
    : [];
  const education = Array.isArray(educationResult.data)
    ? educationResult.data
    : [];
  const skills = Array.isArray(skillsResult.data) ? skillsResult.data : [];
  const evidence = [
    `Name: ${asString(profile.first_name)} ${asString(profile.last_name)}`.trim(),
    `Title: ${asString(profile.job_title)}`,
    `Location: ${asString(profile.location)}`,
    "Experience:",
    ...experiences.map(
      (item: Record<string, unknown>) =>
        `- ${asString(item.title)} at ${asString(item.company)}: ${asString(item.description)}`,
    ),
    "Education:",
    ...education.map(
      (item: Record<string, unknown>) =>
        `- ${asString(item.degree)} from ${asString(item.school)}`,
    ),
    `Skills: ${skills.map((item: Record<string, unknown>) => asString(item.name)).filter(Boolean).join(", ")}`,
  ]
    .filter((line) => !/:\s*$/.test(line) || line === "Experience:" || line === "Education:")
    .join("\n")
    .trim();

  if (!experiences.length && !skills.length && !asString(profile.job_title)) {
    throw new RequestError(
      422,
      "Cold Mail needs resume or profile evidence before it can write a trustworthy draft.",
    );
  }
  return evidence;
}

async function loadPublicProfileUrl(serviceClient: any, userId: string) {
  const { data } = await serviceClient
    .from("public_profile_sites")
    .select("slug")
    .eq("user_id", userId)
    .maybeSingle();
  const slug = asString(data?.slug);
  if (!slug) return "";
  return `https://app.jobraker.io/u/${encodeURIComponent(slug)}`;
}

async function prepareColdMail(
  req: Request,
  serviceClient: any,
  userId: string,
  request: PrepareRequest,
) {
  const safeRequest: PrepareRequest = {
    action: "prepare",
    jobId: boundedString(request.jobId, "jobId", 100) || undefined,
    companyName:
      boundedString(request.companyName, "companyName", 200) || undefined,
    jobTitle: boundedString(request.jobTitle, "jobTitle", 200) || undefined,
    applyUrl: boundedString(request.applyUrl, "applyUrl", 2_048) || undefined,
    instructions:
      boundedString(request.instructions, "instructions", 2_000) || undefined,
  };
  const job = await resolveJob(serviceClient, userId, safeRequest);
  const companyName = asString(job.company);
  const jobTitle = asString(job.title) || asString(request.jobTitle);
  const jobDescription = asString(job.description);
  if (!companyName || !jobTitle) {
    throw new RequestError(422, "The selected job is missing its company or title.");
  }

  const scout = await invokeSpecialist(req, "scout-company", {
    companyName,
    jobId: asString(job.id) || undefined,
    jobTitle,
    jobDescription,
    applyUrl: asString(job.apply_url) || undefined,
    limit: 5,
  });
  const recipient = selectColdMailRecipient(scout);
  if (!recipient) {
    throw new RequestError(
      422,
      "No evidence-backed recruiter or public recruitment email was found for this job. No Gmail draft was created.",
    );
  }

  const [resumeText, publicProfileUrl] = await Promise.all([
    loadCandidateEvidence(serviceClient, userId),
    loadPublicProfileUrl(serviceClient, userId),
  ]);
  const generated = await invokeSpecialist(req, "generate-outreach", {
    companyName,
    role: jobTitle,
    resumeText,
    publicProfileUrl: publicProfileUrl || undefined,
    jobDescription: jobDescription || undefined,
    instructions: safeRequest.instructions,
  });
  const generatedRecord =
    generated && typeof generated === "object"
      ? (generated as Record<string, unknown>)
      : {};
  const subject = asString(generatedRecord.subject);
  const body = asString(generatedRecord.body);
  if (!subject || subject.length > 250 || body.length < 5 || body.length > 25_000) {
    throw new RequestError(502, "The outreach writer did not return a complete draft.");
  }

  const preparation: ColdMailPreparation = {
    userId,
    jobId: asString(job.id) || null,
    companyName,
    jobTitle,
    recipient,
    subject,
    body,
  };
  const preparationToken = await createColdMailPreparationToken(
    preparation,
    signingSecret(),
  );

  return {
    success: true,
    status: "needs_approval",
    preparation: {
      jobId: preparation.jobId,
      companyName,
      jobTitle,
      recipient,
      subject,
      body,
    },
    preparationToken,
    agents: [
      { id: "job_context", status: "completed" },
      { id: "recruiter_scout", status: "completed" },
      { id: "candidate_evidence", status: "completed" },
      { id: "outreach_writer", status: "completed" },
      { id: "gmail_draft", status: "awaiting_approval" },
    ],
  };
}

const COLD_MAIL_DRAFT_ATTEMPT_COLUMNS =
  "id, status, provider_draft_id, provider_message_id, provider_thread_id, draft_from, recipient_email";

async function loadColdMailDraftAttempt(
  serviceClient: any,
  userId: string,
  requestFingerprint: string,
) {
  const { data, error } = await serviceClient
    .from("cold_mail_drafts")
    .select(COLD_MAIL_DRAFT_ATTEMPT_COLUMNS)
    .eq("user_id", userId)
    .eq("request_fingerprint", requestFingerprint)
    .maybeSingle();
  if (error) {
    console.error("cold-mail draft attempt lookup failed", {
      code: error.code,
      message: error.message,
    });
    throw new RequestError(500, "Cold Mail could not verify draft idempotency.");
  }
  return (data as ColdMailDraftAttemptRow | null) || null;
}

async function reserveColdMailDraftAttempt(
  serviceClient: any,
  userId: string,
  token: string,
  preparation: ColdMailPreparation,
) {
  const requestFingerprint = await fingerprintColdMailPreparationToken(token);
  const existing = await loadColdMailDraftAttempt(
    serviceClient,
    userId,
    requestFingerprint,
  );
  const existingDecision = resolveColdMailDraftAttempt(existing);
  if (existingDecision.action !== "create") {
    return { decision: existingDecision, row: existing };
  }

  const { data, error } = await serviceClient
    .from("cold_mail_drafts")
    .insert({
      user_id: userId,
      job_id: preparation.jobId,
      request_fingerprint: requestFingerprint,
      recipient_email: preparation.recipient.email,
      subject: preparation.subject,
      status: "creating",
    })
    .select(COLD_MAIL_DRAFT_ATTEMPT_COLUMNS)
    .single();
  if (!error && data) {
    return {
      decision: { action: "create" as const },
      row: data as ColdMailDraftAttemptRow,
    };
  }

  if (error?.code === "23505") {
    const concurrent = await loadColdMailDraftAttempt(
      serviceClient,
      userId,
      requestFingerprint,
    );
    return {
      decision: resolveColdMailDraftAttempt(concurrent),
      row: concurrent,
    };
  }

  console.error("cold-mail draft attempt reservation failed", {
    code: error?.code,
    message: error?.message,
  });
  throw new RequestError(500, "Cold Mail could not reserve the Gmail draft write.");
}

async function persistColdMailDraftAttempt(
  serviceClient: any,
  attemptId: string,
  values: Record<string, unknown>,
) {
  const { error } = await serviceClient
    .from("cold_mail_drafts")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", attemptId);
  if (error) {
    console.error("cold-mail draft attempt persistence failed", {
      attemptId,
      code: error.code,
      message: error.message,
    });
    throw new RequestError(
      500,
      "The Gmail draft was processed but its confirmation could not be persisted. Check Gmail drafts before retrying.",
    );
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed." }, 405, corsHeaders);
  }

  try {
    const { user, serviceClient } = await requireSubscriptionTier(
      req,
      "Basics",
      "Cold Mail",
    );
    const parsedRequest = await req.json();
    if (!parsedRequest || typeof parsedRequest !== "object" || Array.isArray(parsedRequest)) {
      throw new RequestError(400, "Cold Mail request is invalid.");
    }
    const request = parsedRequest as ColdMailRequest;

    if (request.action === "discover") {
      const result = await discoverColdMailTargets(
        req,
        serviceClient,
        user.id,
        request,
      );
      return jsonResponse(result, 200, corsHeaders);
    }

    if (request.action === "prepare") {
      const result = await prepareColdMail(
        req,
        serviceClient,
        user.id,
        request,
      );
      return jsonResponse(result, 200, corsHeaders);
    }

    if (request.action === "create_gmail_draft") {
      const token = boundedString(
        request.preparationToken,
        "preparationToken",
        60_000,
      );
      if (!token) throw new RequestError(400, "A reviewed Cold Mail draft is required.");
      const preparation = await verifyColdMailPreparationToken(
        token,
        signingSecret(),
      );
      if (preparation.userId !== user.id) {
        throw new RequestError(403, "This Cold Mail preparation belongs to another user.");
      }

      const reserved = await reserveColdMailDraftAttempt(
        serviceClient,
        user.id,
        token,
        preparation,
      );
      if (reserved.decision.action === "replay") {
        return jsonResponse(reserved.decision.response, 200, corsHeaders);
      }
      if (reserved.decision.action === "block" || !reserved.row) {
        return jsonResponse(
          reserved.decision.action === "block"
            ? reserved.decision.response
            : {
                success: false,
                code: "gmail_draft_reservation_failed",
                error: "Cold Mail could not reserve the Gmail draft write.",
              },
          409,
          corsHeaders,
        );
      }

      const providerResult = await agentCreateJobRelatedDraft(
        serviceClient,
        user.id,
        {
          to: preparation.recipient.email,
          subject: preparation.subject,
          body: preparation.body,
        },
      );
      const confirmed = confirmGmailDraftResult(providerResult);
      if (confirmed.success) {
        await persistColdMailDraftAttempt(serviceClient, reserved.row.id, {
          status: "created",
          provider_draft_id: confirmed.draftId,
          provider_message_id: confirmed.messageId,
          provider_thread_id: confirmed.threadId,
          draft_from: confirmed.draftFrom || null,
          error_code: null,
        });
      } else {
        await persistColdMailDraftAttempt(serviceClient, reserved.row.id, {
          status: "uncertain",
          error_code: confirmed.code,
        });
      }
      return jsonResponse(
        confirmed,
        confirmed.success ? 200 : 502,
        corsHeaders,
      );
    }

    throw new RequestError(400, "Unknown Cold Mail action.");
  } catch (error) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    const status = error instanceof RequestError ? error.status : 500;
    const message =
      error instanceof RequestError
        ? error.message
        : "Cold Mail failed. Please try again.";
    console.error("cold-mail failed", error);
    return jsonResponse({ success: false, error: message }, status, corsHeaders);
  }
});

````

### Jobs Search Edge Function

Source: `backend/supabase/functions/jobs-search/index.ts`

````typescript
import { getCorsHeaders } from "../_shared/cors.ts";
import { discoverJobsHybrid, type PublicJobSource } from "../_shared/discovery-hybrid.ts";
import { persistDiscoveredJobs, settleJobSearchRunCredits } from "../_shared/jobs.ts";
import { syncRtrvrCreditUsage } from "../_shared/provider-credits.ts";
import { normalizeSearchScope } from "../_shared/search-normalization.ts";
import {
  requireAuthenticatedUser,
  resolveJobSearchExecutionLimits,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";

const PUBLIC_JOB_SOURCE_ALIASES: Record<string, PublicJobSource> = {
  web: "web",
  general: "web",
  ats: "ats",
  greenhouse: "ats",
  lever: "ats",
  ashby: "ats",
  workable: "ats",
  yc: "yc",
  "yc/jobs": "yc",
  ycombinator: "yc",
  "ycombinator.com": "yc",
  workatastartup: "yc",
  x: "x",
  twitter: "x",
  "x.com": "x",
  "twitter.com": "x",
  reddit: "reddit",
  hn: "hackernews",
  hackernews: "hackernews",
  "hacker-news": "hackernews",
  "news.ycombinator.com": "hackernews",
  community: "community",
};

function serializeError(err: any): string {
  if (err == null) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) {
    const anyErr = err as any;
    if (anyErr.response?.data) {
      return `${err.message}: ${JSON.stringify(anyErr.response.data)}`;
    }
    return err.message || err.stack || String(err);
  }
  if (typeof err === "object") {
    if (err.message) {
      let msg = err.message;
      if (err.details) msg += ` (${err.details})`;
      if (err.code) msg += ` [Code: ${err.code}]`;
      return msg;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

function parsePublicSources(value: unknown): PublicJobSource[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;\s]+/)
      : [];
  const seen = new Set<PublicJobSource>();
  for (const item of raw) {
    const key = String(item || "").trim().toLowerCase();
    const source = PUBLIC_JOB_SOURCE_ALIASES[key];
    if (source) seen.add(source);
  }
  return Array.from(seen);
}

function normalizeDomain(value: string): string | null {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return trimmed
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "")
      .trim() || null;
  }
}

function extractTargetDomains(value: unknown): string[] {
  const inputs = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? [value]
      : [];
  const seen = new Set<string>();
  for (const item of inputs) {
    const text = String(item || "");
    for (const match of text.matchAll(/\bsite:([a-z0-9.-]+\.[a-z]{2,})(?:\/[^\s)"']*)?/gi)) {
      const domain = normalizeDomain(match[1]);
      if (domain) seen.add(domain);
    }
    for (const match of text.matchAll(/https?:\/\/[^\s<>"')]+/gi)) {
      const domain = normalizeDomain(match[0]);
      if (domain) seen.add(domain);
    }
    const direct = normalizeDomain(text);
    if (direct && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(direct)) seen.add(direct);
  }
  return Array.from(seen).slice(0, 12);
}

Deno.serve(async (req) => {
  const startedAt = Date.now();
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin, req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Hoisted above the try so the emergency credit-refund path in `catch` can
  // still read them. These used to be block-scoped to the try, so the fallback
  // settlement threw a ReferenceError and reserved credits were never refunded.
  let searchQuery = "";
  let location = "";
  let userId = "";
  let agentRunId: string | null = null;
  let searchSettled = false;
  let creditsToReserve = 0;
  // Reused by the catch below. `createServiceSupabaseClient()` was called there
  // but never imported into this module, so the refund path threw even once the
  // scoping was fixed; the client from requireAuthenticatedUser works fine.
  let serviceClientRef:
    | Awaited<ReturnType<typeof requireAuthenticatedUser>>["serviceClient"]
    | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    searchQuery = String(body?.searchQuery || body?.query || "").trim();
    const rawLocation = String(body?.location || "").trim();
    const locationScope = (["city", "country", "global", "remote"] as const).includes(body?.locationScope)
      ? (body.locationScope as "city" | "country" | "global" | "remote")
      : "city";
    const sourceFocus = parsePublicSources(
      body?.sources ?? body?.sourceFocus ?? body?.publicSources,
    );
    const targetDomains = extractTargetDomains([
      searchQuery,
      ...(Array.isArray(body?.targetDomains) ? body.targetDomains : []),
      ...(Array.isArray(body?.careerSourceUrls) ? body.careerSourceUrls : []),
    ]);

    // ── Canonical search scope normalization ──────────────────────────────────
    // Replace inline ad-hoc country resolution with the shared normalizer.
    // This produces a stable fingerprint and structured location metadata.
    const canonicalScope = await normalizeSearchScope(
      searchQuery,
      rawLocation,
      locationScope,
    );

    // The effective search location string sent to discovery tools
    location = (canonicalScope.location.displayName ?? rawLocation) || "Remote";

    const requestedLimit = Number.isFinite(Number(body?.limit))
      ? Math.max(1, Math.floor(Number(body.limit)))
      : 10;
    const freshnessDays = Number.isFinite(Number(body?.freshnessDays))
      ? Math.max(1, Math.min(365, Math.floor(Number(body.freshnessDays))))
      : 30;

    if (!searchQuery) {
      return new Response(JSON.stringify({ error: "searchQuery is required" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { serviceClient, user } = await requireAuthenticatedUser(req);
    userId = user?.id ?? "";
    serviceClientRef = serviceClient;
    const {
      subscriptionTier,
      planCap,
      creditsBalance,
      effectiveLimit,
    } = await resolveJobSearchExecutionLimits(
      user.id,
      requestedLimit,
      serviceClient,
    );

    if (effectiveLimit <= 0) {
      return new Response(
        JSON.stringify({
          error: "Your subscription limit for job search has been reached.",
          code: "limit_reached",
          requestedLimit,
          planCap,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    creditsToReserve = Math.max(1, effectiveLimit);
    const idempotencyKey = crypto.randomUUID();
    const { data: reserveRaw, error: reserveError } = await serviceClient.rpc(
      "reserve_credits_for_run",
      {
        p_user_id: user.id,
        p_run_type: "job_search",
        p_estimated_credits: creditsToReserve,
        p_idempotency_key: idempotencyKey,
        p_metadata: {
          searchQuery,
          normalizedQuery: canonicalScope.normalizedQuery,
          locationScope: canonicalScope.location.scope,
          locationKey: canonicalScope.location.locationKey,
          location,
          fingerprint: canonicalScope.fingerprint,
          requestedLimit,
          effectiveLimit,
        },
      }
    );

    const reserve = reserveRaw as Record<string, unknown> | null;
    if (reserveError || !reserve || reserve.success !== true) {
      return new Response(
        JSON.stringify({
          error: (reserve?.message as string) || "Insufficient credits for job search run.",
          code: "insufficient_credits",
          current_balance: reserve?.current_balance || creditsBalance,
          required_credits: creditsToReserve,
        }),
        {
          status: 402,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    agentRunId = reserve.agent_run_id as string;
    const holdId = (reserve.hold_id as string | undefined) ?? null;

    // ── Persist canonical search run record ───────────────────────────────────
    // Written immediately after successful reservation so the run is always
    // visible — even if the background task dispatch fails.
    try {
      await serviceClient.rpc("insert_job_search_run", {
        p_agent_run_id:       agentRunId,
        p_user_id:            user.id,
        p_original_query:     searchQuery,
        p_raw_location:       rawLocation,
        p_normalized_query:   canonicalScope.normalizedQuery,
        p_location_scope:     canonicalScope.location.scope,
        p_location_key:       canonicalScope.location.locationKey,
        p_country_code:       canonicalScope.location.countryCode,
        p_city:               canonicalScope.location.city,
        p_display_location:   canonicalScope.location.displayName,
        p_search_fingerprint: canonicalScope.fingerprint,
        p_hold_id:            holdId,
        p_estimated_credits:  creditsToReserve,
      });
    } catch (runInsertError) {
      // Non-fatal: log and continue — settlement will still work via legacy path.
      console.warn("[jobs-search] Failed to insert job_search_run record", {
        agentRunId,
        error: runInsertError,
      });
    }
    const searchStartedAt = new Date().toISOString();

    const isAsync = body?.async === true;

    if (isAsync) {
      const { data: task, error: enqueueError } = await serviceClient
        .from("job_intelligence_tasks")
        .insert({
          user_id: user.id,
          type: "scout_search",
          title: `Scout search: ${searchQuery}`,
          message: "Queued for background search.",
          progress_total: 3,
          params: {
            search_query: searchQuery,
            location,
            locationScope,
            limit: requestedLimit,
            sources: sourceFocus,
            targetDomains,
            freshnessDays,
            agent_run_id: agentRunId,
            search_started_at: searchStartedAt,
          },
        })
        .select("id")
        .single();

      if (enqueueError) {
        await settleJobSearchRunCredits(serviceClient, {
          agentRunId,
          userId: user.id,
          searchQuery,
          location,
          searchStartedAt,
          maxCredits: creditsToReserve,
          searchFailed: true,
          failureReason: "Failed to enqueue background search task",
        });
        throw enqueueError;
      }

      const processTaskUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-task`;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (serviceRoleKey) {
        try {
          const dispatchResponse = await fetch(processTaskUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ taskId: task.id }),
          });
          if (!dispatchResponse.ok) {
            console.error("[jobs-search] Failed to dispatch async scout task", {
              taskId: task.id,
              status: dispatchResponse.status,
              body: await dispatchResponse.text().catch(() => ""),
            });
          }
        } catch (dispatchError) {
          console.error("[jobs-search] Async scout task dispatch failed", {
            taskId: task.id,
            error: dispatchError,
          });
        }
      } else {
        console.warn("[jobs-search] SUPABASE_SERVICE_ROLE_KEY missing; relying on DB trigger for async scout task", {
          taskId: task.id,
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: "queued",
          taskId: task.id,
          agent_run_id: agentRunId,
          searchStartedAt,
          // V2: canonical search scope for frontend to save — used to fetch
          // results by agentRunId instead of re-matching raw query strings.
          canonicalSearch: {
            normalizedQuery:  canonicalScope.normalizedQuery,
            locationScope:    canonicalScope.location.scope,
            locationKey:      canonicalScope.location.locationKey,
            locationName:     canonicalScope.location.displayName,
            fingerprint:      canonicalScope.fingerprint,
          },
          creditReservation: {
            holdId,
            reservedCredits: creditsToReserve,
          },
        }),
        {
          status: 202,
          headers: { ...corsHeaders, "content-type": "application/json" },
        }
      );
    }

    let searchFailed = false;
    let failureReason: string | undefined;
    let discoveredJobs: any[] = [];
    let warnings: any[] = [];
    let totalInserted = 0;

    try {
      console.log("[jobs-search] RTRVR-led discovery", {
        userId: user.id,
        searchQuery,
        location,
        sourceFocus,
        targetDomains,
        requestedLimit,
        effectiveLimit,
        subscriptionTier,
      });

      const pendingFormatting: Promise<unknown>[] = [];
      const result = await discoverJobsHybrid(
        {
          serviceClient,
          userId: user.id,
          searchQuery,
          location,
          limit: effectiveLimit,
          sourceFocus,
          targetDomains,
          freshnessDays,
        },
        async (batch) => {
          const { jobsInserted: batchInserted, formattingTask } = await persistDiscoveredJobs(
            serviceClient,
            batch,
            {
              userId: user.id,
              searchQuery,
              location,
              trigger: "live_search",
              requestedLimit,
              effectiveLimit,
              subscriptionTier,
              // V2: link discovered jobs to this agent run
              agentRunId,
            },
          );
          if (formattingTask) pendingFormatting.push(formattingTask);
          totalInserted += batchInserted;
        },
      );
      
      discoveredJobs = result.jobs;
      warnings = result.warnings;

      // Deferred cosmetic formatting must land before this request returns.
      if (pendingFormatting.length > 0) {
        await Promise.allSettled(pendingFormatting);
      }

    } catch (err: any) {
      console.error("[jobs-search] Search failed", err);
      searchFailed = true;
      failureReason = serializeError(err);
    }

    const jobsInserted = totalInserted;

    // V2: unique key for idempotent settlement via settle_search_run_v2
    const settlementIdempotencyKey = `settle:${agentRunId}:${Date.now()}`;

    const { displayableJobCount, creditsCharged, currentBalance } = await settleJobSearchRunCredits(
      serviceClient,
      {
        agentRunId,
        userId: user.id,
        searchQuery,
        location,
        searchStartedAt,
        maxCredits: creditsToReserve,
        searchFailed,
        failureReason,
        jobsInserted,
        jobsDiscovered: discoveredJobs.length,
        settlementIdempotencyKey,
      },
    );

    searchSettled = true;

    if (searchFailed) {
      return new Response(
        JSON.stringify({
          error: "Search failed. Your credits have been refunded.",
          code: "search_failed",
          details: failureReason,
          creditsCharged: 0,
          current_balance: currentBalance,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "content-type": "application/json" },
        }
      );
    }
    
    const actualCredits = creditsCharged;
    const creditsDeducted = actualCredits;
    const remainingBalance = currentBalance;
    let providerCreditSync: Record<string, unknown> | null = null;

    try {
      const syncResult = await syncRtrvrCreditUsage(serviceClient, {
        source: "jobs-search",
        userId: user.id,
        requestedLimit,
        effectiveLimit,
        jobsInserted,
        jobsBilled: actualCredits,
      });
      providerCreditSync = {
        remainingCredits: syncResult.usage.remainingCredits,
        planCredits: syncResult.usage.planCredits,
        billingPeriodStart: syncResult.usage.billingPeriodStart,
        billingPeriodEnd: syncResult.usage.billingPeriodEnd,
        alert: syncResult.alert,
      };
    } catch (providerCreditError) {
      console.warn("[jobs-search] RTRVR credit ledger sync failed", providerCreditError);
    }

    console.info("[jobs-search] Completed", {
      userId: user.id,
      requestedLimit,
      effectiveLimit,
      discoveredCount: discoveredJobs.length,
      jobsInserted,
      displayableJobCount,
      jobsBilled: actualCredits,
      creditsDeducted,
      remainingBalance,
      warningCount: warnings.length,
      elapsed_ms: Date.now() - startedAt,
    });

    return new Response(
      JSON.stringify({
        success: true,
        status: "completed",
        agent_run_id: agentRunId,
        requestedLimit,
        effectiveLimit,
        planCap,
        creditsBalance,
        subscriptionTier,
        jobsInserted,
        newCount: jobsInserted,
        duplicateCount: Math.max(0, discoveredJobs.length - jobsInserted),
        displayedCount: displayableJobCount,
        displayableJobCount,
        jobsBilled: actualCredits,
        creditsDeducted,
        remainingBalance,
        providerCreditSync,
        jobs: discoveredJobs.map((job) => ({
          title: job.title,
          company: job.company,
          location: job.location,
          url: job.url,
          description: job.description,
          salary_min: job.salary_min ?? null,
          salary_max: job.salary_max ?? null,
          salary_currency: job.salary_currency ?? null,
          posted_at: job.posted_at,
          source_kind: job.source_kind,
          source_confidence: job.source_confidence,
          verification_status: job.verification_status,
          is_tracked_company: job.is_tracked_company,
        })),
        count: discoveredJobs.length,
        sourceFocus,
        targetDomains,
        freshnessDays,
        warnings,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("jobs-search.error", error);
    if (agentRunId && !searchSettled && serviceClientRef) {
      try {
        await settleJobSearchRunCredits(serviceClientRef, {
          agentRunId,
          userId,
          searchQuery,
          location,
          maxCredits: creditsToReserve || 0,
          searchFailed: true,
          failureReason: error instanceof Error ? error.message : "Unhandled search failure",
        });
      } catch (fallbackSettleErr) {
        console.error("[jobs-search] Emergency fallback settlement failed:", fallbackSettleErr);
      }
    }
    return subscriptionErrorResponse(error, corsHeaders);
  }
});

````


### Scout Company Edge Function

Source: `backend/supabase/functions/scout-company/index.ts`

````typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ScoutRequest {
  companyName: string;
  jobId?: string;
  applicationId?: string;
  jobTitle?: string;
  jobDescription?: string;
  applyUrl?: string;
  limit?: number;
}

type RoleKind =
  | "recruiter"
  | "hiring_manager"
  | "team_lead"
  | "director"
  | "employee"
  | "unknown";

type EmailStatus =
  | "source_verified"
  | "provider_verified"
  | "domain_valid"
  | "pattern_only"
  | "unverified"
  | "not_found";

interface SearchItem {
  url: string;
  title: string;
  description: string;
  markdown: string;
  sourceQuery: string;
}

interface RecruiterContact {
  fullName: string;
  title: string;
  roleKind: RoleKind;
  linkedinUrl: string;
  linkedinSourceUrl: string;
  workEmail: string;
  emailStatus: EmailStatus;
  emailConfidence: number;
  emailSourceUrl: string;
  relevanceScore: number;
  evidence: Array<Record<string, unknown>>;
  safeToContact: boolean;
}

interface JobContext {
  id: string | null;
  applicationId: string | null;
  title: string;
  company: string;
  description: string;
  applyUrl: string;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

const ALLOWED_ORIGINS = new Set([
  "https://app.jobraker.io",
  "https://admin.jobraker.io",
  "https://jobraker.io",
  "https://www.jobraker.io",
  "https://jobraker-tau.vercel.app",
  "https://jobraker.vercel.app",
  "https://jobraker.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
]);

const BLOCKED_OFFICIAL_HOSTS = new Set([
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "crunchbase.com",
  "facebook.com",
  "x.com",
  "twitter.com",
  "instagram.com",
  "youtube.com",
  "wikipedia.org",
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "workday.com",
  "myworkdayjobs.com",
  "smartrecruiters.com",
]);

const ATS_HOST_PATTERNS = [
  /(^|\.)greenhouse\.io$/i,
  /(^|\.)lever\.co$/i,
  /(^|\.)ashbyhq\.com$/i,
  /(^|\.)myworkdayjobs\.com$/i,
  /(^|\.)smartrecruiters\.com$/i,
  /(^|\.)workable\.com$/i,
  /(^|\.)jobvite\.com$/i,
];

const COUNTRY_SECOND_LEVEL_SUFFIXES = new Set([
  "co.uk",
  "org.uk",
  "ac.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.nz",
  "co.jp",
  "co.in",
  "com.br",
  "com.ng",
  "co.za",
]);

const TIER_RANK: Record<string, number> = {
  Free: 0,
  Basics: 1,
  Pro: 2,
  Ultimate: 3,
};

const SCOUT_LIMITS: Record<string, { perMinute: number; perDay: number }> = {
  Basics: { perMinute: 3, perDay: 15 },
  Pro: { perMinute: 8, perDay: 40 },
  Ultimate: { perMinute: 15, perDay: 100 },
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeInput(value: unknown, maxLength: number): string {
  return asString(value)
    .slice(0, maxLength)
    .replace(/ignore all previous instructions|disregard previous instructions|system prompt/gi, "[REDACTED]")
    .trim();
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(max, Math.max(min, Math.floor(parsed)))
    : fallback;
}

function corsHeaders(req: Request): Record<string, string> {
  const requestedOrigin = asString(req.headers.get("origin")).replace(/\/+$/, "");
  const origin = ALLOWED_ORIGINS.has(requestedOrigin)
    ? requestedOrigin
    : "https://app.jobraker.io";
  const requestedHeaders = asString(req.headers.get("access-control-request-headers"));
  const headers = new Set(
    "authorization, x-client-info, apikey, content-type, accept, prefer"
      .split(",")
      .map((item) => item.trim()),
  );
  requestedHeaders.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean)
    .forEach((item) => headers.add(item));
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": Array.from(headers).join(", "),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function normalizeUrl(value: unknown): string {
  const raw = asString(value);
  if (!raw) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!/^https?:$/.test(url.protocol)) return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function hostname(value: unknown): string {
  const url = normalizeUrl(value);
  if (!url) return "";
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function registrableDomain(host: string): string {
  const clean = host.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  const parts = clean.split(".").filter(Boolean);
  if (parts.length <= 2) return clean;
  const lastTwo = parts.slice(-2).join(".");
  return COUNTRY_SECOND_LEVEL_SUFFIXES.has(lastTwo)
    ? parts.slice(-3).join(".")
    : lastTwo;
}

function domainsCompatible(left: string, right: string): boolean {
  return Boolean(left && right && registrableDomain(left) === registrableDomain(right));
}

function isAtsHost(host: string): boolean {
  return ATS_HOST_PATTERNS.some((pattern) => pattern.test(host));
}

function isBlockedOfficialHost(host: string): boolean {
  return !host || BLOCKED_OFFICIAL_HOSTS.has(host) || isAtsHost(host);
}

function isLinkedInProfileUrl(value: unknown): boolean {
  const url = normalizeUrl(value);
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "") === "linkedin.com" &&
      /^\/in\/[a-z0-9_%\-]+\/?/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function normalizeLinkedInProfileUrl(value: unknown): string {
  const url = normalizeUrl(value);
  if (!isLinkedInProfileUrl(url)) return "";
  const parsed = new URL(url);
  parsed.search = "";
  parsed.hash = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed.toString();
}

function compactText(value: unknown, maxLength = 500): string {
  return asString(value).replace(/\s+/g, " ").slice(0, maxLength);
}

function sourceText(item: SearchItem): string {
  return `${item.title}\n${item.description}\n${item.markdown}`.trim();
}

function companyTokens(company: string): string[] {
  const stop = new Set([
    "inc", "incorporated", "llc", "ltd", "limited", "plc", "corp",
    "corporation", "company", "group", "holdings", "technologies",
    "technology", "international",
  ]);
  return company.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/)
    .filter((token) => token.length >= 3 && !stop.has(token));
}

function hostLooksLikeCompany(host: string, company: string): boolean {
  const flatHost = registrableDomain(host).replace(/[^a-z0-9]/g, "");
  return companyTokens(company).some((token) => flatHost.includes(token));
}

function extractEmails(text: string): string[] {
  const matches = text.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi) || [];
  return Array.from(new Set(matches.map((email) => email.toLowerCase().replace(/[),.;:]+$/, ""))));
}

function dedupeSearchItems(items: SearchItem[]): SearchItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeUrl(item.url).toLowerCase().replace(/\/$/, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractTeamKeywords(description: string, title: string): string[] {
  const text = `${description}\n${title}`.replace(/\s+/g, " ");
  const candidates: string[] = [];
  const patterns = [
    /\b(?:the|our|join(?:ing)?|within|support(?:ing)?)\s+([a-z0-9][a-z0-9&/+\-]*(?:\s+[a-z0-9][a-z0-9&/+\-]*){0,7})\s+(?:team|department|group|organization|org|function|unit)\b/gi,
    /\b([A-Z][A-Za-z0-9&/+\-]*(?:\s+[A-Z][A-Za-z0-9&/+\-]*){0,7})\s+(?:Team|Department|Group|Organization|Function|Unit)\b/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = compactText(match[1], 120)
        .replace(/^(?:a|an|and|for|in|of|on|the|to|with)\s+/i, "")
        .trim();
      if (value.length >= 3 && value.split(/\s+/).length <= 8) candidates.push(value);
    }
  }
  const titleCore = title
    .replace(/\b(?:senior|sr\.?|junior|jr\.?|principal|staff|intern|internship|remote|contract)\b/gi, " ")
    .replace(/[^a-z0-9+#./-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (titleCore.length >= 3) candidates.push(titleCore);
  const seen = new Set<string>();
  return candidates.filter((value) => {
    const key = value.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

function inferRoleKind(title: string): RoleKind {
  const value = title.toLowerCase();
  if (/hiring manager/.test(value)) return "hiring_manager";
  if (/recruit|talent acquisition|talent partner|people partner|sourcer/.test(value)) return "recruiter";
  if (/team lead|engineering manager|product manager|design manager| manager\b|lead\b/.test(value)) return "team_lead";
  if (/director|head of|vice president|\bvp\b|chief/.test(value)) return "director";
  return title.trim() ? "employee" : "unknown";
}

function roleBaseScore(kind: RoleKind): number {
  return {
    hiring_manager: 98,
    recruiter: 94,
    team_lead: 88,
    director: 82,
    employee: 58,
    unknown: 45,
  }[kind];
}

function relevanceScore(
  title: string,
  roleKind: RoleKind,
  evidence: string,
  company: string,
  keywords: string[],
): number {
  const haystack = `${title} ${evidence}`.toLowerCase();
  let score = roleBaseScore(roleKind);
  score += Math.min(5, companyTokens(company).filter((token) => haystack.includes(token)).length * 2);
  score += Math.min(8, keywords.filter((keyword) => keyword.toLowerCase().split(/\s+/)
    .some((token) => token.length > 2 && haystack.includes(token))).length * 3);
  return Math.min(100, score);
}

function parseLinkedInResult(item: SearchItem): { fullName: string; title: string } | null {
  if (!isLinkedInProfileUrl(item.url)) return null;
  const clean = item.title.replace(/\s*\|\s*LinkedIn.*$/i, "").trim();
  const parts = clean.split(/\s+(?:-|–|—)\s+/).map((part) => part.trim()).filter(Boolean);
  const fullName = parts[0] || "";
  const title = parts.slice(1).join(" - ").slice(0, 240);
  if (fullName.split(/\s+/).length < 2 || fullName.length > 120) return null;
  return { fullName, title };
}

function officialDomainFrom(items: SearchItem[], company: string): string {
  const tokens = companyTokens(company);
  return items.map((item) => {
    const host = hostname(item.url);
    if (isBlockedOfficialHost(host)) return { host: "", score: -1 };
    const domain = registrableDomain(host);
    const flat = domain.replace(/[^a-z0-9]/g, "");
    let score = tokens.filter((token) => flat.includes(token)).length * 15;
    if (/careers?|jobs?|about us|official/i.test(sourceText(item))) score += 5;
    return { host: domain, score };
  }).filter((entry) => entry.host && entry.score >= 0)
    .sort((a, b) => b.score - a.score)[0]?.host || "";
}

function careersUrlFrom(items: SearchItem[], officialDomain: string): string {
  return items.map((item) => {
    const url = normalizeUrl(item.url);
    const host = hostname(url);
    const text = `${url} ${sourceText(item)}`.toLowerCase();
    let score = 0;
    if (/careers?|jobs?|join us|open roles|vacancies/.test(text)) score += 20;
    if (officialDomain && domainsCompatible(host, officialDomain)) score += 20;
    if (isAtsHost(host)) score += 10;
    if (isLinkedInProfileUrl(url)) score -= 50;
    return { url, score };
  }).filter((entry) => entry.url && entry.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.url || "";
}

function normalizePersonToken(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");
}

function nameParts(fullName: string): { first: string; last: string } | null {
  const parts = fullName.replace(/\([^)]*\)/g, " ").split(/\s+/)
    .map(normalizePersonToken).filter(Boolean);
  return parts.length >= 2 ? { first: parts[0], last: parts[parts.length - 1] } : null;
}

function personAppearsInText(fullName: string, text: string): boolean {
  const parts = nameParts(fullName);
  if (!parts) return false;
  const normalized = normalizePersonToken(text);
  return normalized.includes(parts.first) && normalized.includes(parts.last);
}

function emailPatterns(fullName: string, domain: string): string[] {
  const parts = nameParts(fullName);
  if (!parts || !domain) return [];
  const { first, last } = parts;
  return Array.from(new Set([
    `${first}.${last}@${domain}`,
    `${first}${last}@${domain}`,
    `${first[0]}${last}@${domain}`,
    `${first}${last[0]}@${domain}`,
    `${last}.${first}@${domain}`,
    `${first}_${last}@${domain}`,
  ]));
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function searchWeb(apiKey: string, query: string, limit: number): Promise<SearchItem[]> {
  try {
    return await withRetry(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort("firecrawl_timeout"), 25_000);
      try {
        const response = await fetch("https://api.firecrawl.dev/v2/search", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ query, limit, sources: ["web"] }),
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout));
        if (!response.ok) throw new Error(`Search provider failed: ${response.status}`);
        const payload = await response.json();
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        return rows.map((row: any) => ({
          url: normalizeUrl(row?.url),
          title: compactText(row?.title, 500),
          description: compactText(row?.description, 1800),
          markdown: compactText(row?.markdown, 2400),
          sourceQuery: query,
        })).filter((item: SearchItem) => Boolean(item.url));
      } catch (err) {
        clearTimeout(timeout);
        throw err;
      }
    }, 3);
  } catch (error) {
    console.warn(`[searchWeb] Search provider connectivity error for query "${query}":`, error);
    return [];
  }
}

function parseVerifierResponse(payload: any) {
  const value = payload?.data && typeof payload.data === "object" ? payload.data : payload;
  const status = asString(value?.status || value?.result || value?.verdict).toLowerCase();
  const valid = value?.valid === true || value?.is_valid === true ||
    value?.deliverable === true || value?.is_deliverable === true ||
    ["valid", "deliverable", "safe", "ok", "verified"].includes(status);
  const catchAll = value?.catch_all === true || value?.is_catch_all === true ||
    value?.accept_all === true || value?.is_accept_all === true ||
    ["catch_all", "accept_all"].includes(status);
  const rawScore = Number(value?.confidence ?? value?.score ?? value?.probability);
  return {
    valid: valid && !catchAll,
    confidence: Number.isFinite(rawScore)
      ? Math.min(0.99, Math.max(0.5, rawScore > 1 ? rawScore / 100 : rawScore))
      : 0.92,
  };
}

async function verifyEmail(email: string, fullName: string, company: string) {
  const verifierUrl = asString(Deno.env.get("RECRUITER_EMAIL_VERIFIER_URL"));
  if (!verifierUrl) return { valid: false, confidence: 0 };
  const apiKey = asString(Deno.env.get("RECRUITER_EMAIL_VERIFIER_API_KEY"));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("email_verifier_timeout"), 15_000);
  try {
    const response = await fetch(verifierUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}`, "X-API-Key": apiKey } : {}),
      },
      body: JSON.stringify({ email, fullName, company }),
      signal: controller.signal,
    });
    return response.ok ? parseVerifierResponse(await response.json().catch(() => null)) : { valid: false, confidence: 0 };
  } catch {
    return { valid: false, confidence: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

async function enrichEmail(
  contact: RecruiterContact,
  officialDomain: string,
  firecrawlKey: string,
  company: string,
): Promise<RecruiterContact> {
  if (!officialDomain) return contact;
  try {
    const items = await searchWeb(firecrawlKey, `"${contact.fullName}" "${company}" "@${officialDomain}"`, 5);
    for (const item of items) {
      const text = sourceText(item);
      if (!personAppearsInText(contact.fullName, text)) continue;
      const email = extractEmails(text).find((candidate) =>
        domainsCompatible(candidate.split("@")[1] || "", officialDomain));
      if (!email) continue;
      const officialSource = domainsCompatible(hostname(item.url), officialDomain);
      return {
        ...contact,
        workEmail: email,
        emailStatus: "source_verified",
        emailConfidence: officialSource ? 0.98 : 0.88,
        emailSourceUrl: item.url,
        safeToContact: true,
        evidence: [...contact.evidence, {
          type: "published_work_email",
          sourceUrl: item.url,
          excerpt: compactText(text, 380),
        }],
      };
    }
  } catch {
    // Continue to an optional verifier. Never create a user-visible guess.
  }
  for (const candidate of emailPatterns(contact.fullName, officialDomain)) {
    const result = await verifyEmail(candidate, contact.fullName, company);
    if (!result.valid) continue;
    return {
      ...contact,
      workEmail: candidate,
      emailStatus: "provider_verified",
      emailConfidence: result.confidence,
      emailSourceUrl: asString(Deno.env.get("RECRUITER_EMAIL_VERIFIER_URL")),
      safeToContact: true,
      evidence: [...contact.evidence, {
        type: "provider_verified_pattern",
        provider: asString(Deno.env.get("RECRUITER_EMAIL_VERIFIER_URL")),
      }],
    };
  }
  return { ...contact, workEmail: "", emailStatus: "not_found", emailConfidence: 0, emailSourceUrl: "", safeToContact: false };
}

function verifiedRecruitmentInbox(items: SearchItem[], officialDomain: string) {
  const localPattern = /^(?:jobs?|careers?|recruit(?:ing|ment)?|talent|hiring|hr|people)(?:[._+-].*)?@/i;
  for (const item of items) {
    for (const email of extractEmails(sourceText(item))) {
      if (domainsCompatible(email.split("@")[1] || "", officialDomain) && localPattern.test(email)) {
        return { email, sourceUrl: item.url };
      }
    }
  }
  return null;
}

async function authenticate(req: Request) {
  const authHeader = asString(req.headers.get("authorization"));
  if (!authHeader) throw new HttpError(401, "Missing authorization header");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) throw new Error("Supabase runtime configuration is incomplete");
  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) throw new HttpError(401, "Unauthorized");
  const serviceClient = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: rawTier } = await serviceClient.rpc("get_user_tier", { p_user_id: user.id });
  const aliases: Record<string, string> = {
    Basic: "Basics", Starter: "Basics", Professional: "Pro",
    Executive: "Ultimate", Enterprise: "Ultimate", "Ultimate Plan": "Ultimate",
  };
  const tier = aliases[asString(rawTier)] || asString(rawTier) || "Free";
  if ((TIER_RANK[tier] || 0) < TIER_RANK.Basics) {
    throw new HttpError(403, "Recruiter and hiring-team discovery requires the Basics plan or higher.");
  }
  return { user, serviceClient, tier };
}

async function enforceRateLimit(serviceClient: any, userId: string, tier: string) {
  const limit = SCOUT_LIMITS[tier] || SCOUT_LIMITS.Basics;
  const now = Date.now();
  const count = async (since: number) => {
    const { count, error } = await serviceClient.from("feature_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("feature_key", "scout_company")
      .gte("created_at", new Date(since).toISOString());
    if (error) throw new Error("Could not verify feature rate limits.");
    return count || 0;
  };
  const [perMinute, perDay] = await Promise.all([count(now - 60_000), count(now - 86_400_000)]);
  if (perMinute >= limit.perMinute) throw new HttpError(429, "Too many recruiter discovery requests. Please wait about a minute.");
  if (perDay >= limit.perDay) throw new HttpError(429, "You have reached today's recruiter discovery limit.");
}

async function recordUsage(serviceClient: any, userId: string, tier: string, metadata: Record<string, unknown>) {
  const { error } = await serviceClient.from("feature_usage_events").insert({
    user_id: userId,
    feature_key: "scout_company",
    quantity: 1,
    reference_type: "rate_limit",
    metadata: { subscription_tier: tier, ...metadata },
  });
  if (error) console.warn("feature usage recording failed", error);
}

async function resolveJob(serviceClient: any, userId: string, request: ScoutRequest, company: string): Promise<JobContext> {
  let application: any = null;
  let job: any = null;
  if (request.applicationId) {
    const { data } = await serviceClient.from("applications")
      .select("id, job_id, job_title, company, app_url")
      .eq("id", request.applicationId).eq("user_id", userId).maybeSingle();
    application = data;
  }
  const jobId = request.jobId || asString(application?.job_id);
  if (jobId) {
    const { data } = await serviceClient.from("jobs")
      .select("id, title, company, description, apply_url, raw_data")
      .eq("id", jobId).eq("user_id", userId).maybeSingle();
    job = data;
  }
  if (!job) {
    const { data } = await serviceClient.from("jobs")
      .select("id, title, company, description, apply_url, raw_data, created_at")
      .eq("user_id", userId).ilike("company", company)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    job = data;
  }
  return {
    id: asString(job?.id) || null,
    applicationId: asString(application?.id) || asString(request.applicationId) || null,
    title: sanitizeInput(request.jobTitle || job?.title || application?.job_title, 240),
    company: sanitizeInput(job?.company || application?.company || company, 200),
    description: sanitizeInput(request.jobDescription || job?.description || job?.raw_data?.description, 25_000),
    applyUrl: normalizeUrl(request.applyUrl || job?.apply_url || application?.app_url),
  };
}

async function createRun(serviceClient: any, userId: string, job: JobContext, keywords: string[], queries: string[]) {
  const { data, error } = await serviceClient.from("recruiter_discovery_runs").insert({
    user_id: userId,
    job_id: job.id,
    application_id: job.applicationId,
    company: job.company,
    job_title: job.title || null,
    team_keywords: keywords,
    status: "pending",
    query_plan: { queries, version: "recruiter_discovery_v2" },
  }).select("id").single();
  if (error) {
    console.warn("recruiter discovery run insert failed", error);
    return null;
  }
  return asString(data?.id) || null;
}

async function updateRun(serviceClient: any, runId: string | null, patch: Record<string, unknown>) {
  if (!runId) return;
  const { error } = await serviceClient.from("recruiter_discovery_runs")
    .update({ ...patch, updated_at: new Date().toISOString() }).eq("id", runId);
  if (error) console.warn("recruiter discovery run update failed", error);
}

async function hash(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function persistContacts(serviceClient: any, userId: string, runId: string | null, job: JobContext, contacts: RecruiterContact[]) {
  if (!contacts.length) return;
  const now = new Date().toISOString();
  const rows = await Promise.all(contacts.map(async (contact) => ({
    user_id: userId,
    discovery_run_id: runId,
    job_id: job.id,
    application_id: job.applicationId,
    identity_key: await hash((contact.linkedinUrl || `${job.company}|${contact.fullName}|${contact.title}`).toLowerCase()),
    company: job.company,
    full_name: contact.fullName,
    title: contact.title || null,
    role_kind: contact.roleKind,
    linkedin_url: contact.linkedinUrl || null,
    linkedin_source_url: contact.linkedinSourceUrl || null,
    work_email: contact.workEmail || null,
    email_status: contact.emailStatus,
    email_confidence: contact.emailConfidence,
    email_source_url: contact.emailSourceUrl || null,
    relevance_score: contact.relevanceScore,
    evidence: contact.evidence,
    safe_to_contact: contact.safeToContact,
    discovered_at: now,
    last_verified_at: contact.safeToContact ? now : null,
    updated_at: now,
  })));
  const { error } = await serviceClient.from("recruiter_contacts")
    .upsert(rows, { onConflict: "user_id,identity_key" });
  if (error) console.warn("recruiter contacts upsert failed", error);
}

serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, headers);

  let runId: string | null = null;
  let serviceClient: any = null;
  try {
    const context = await authenticate(req);
    serviceClient = context.serviceClient;
    await enforceRateLimit(serviceClient, context.user.id, context.tier);

    const request = (await req.json()) as ScoutRequest;
    const companyName = sanitizeInput(request.companyName, 200);
    if (!companyName) throw new HttpError(400, "companyName is required");

    const job = await resolveJob(serviceClient, context.user.id, request, companyName);
    const teamKeywords = extractTeamKeywords(job.description, job.title);
    const isYcCompany = /yc|y combinator|workatastartup|ycombinator/i.test(`${job.company} ${job.title} ${job.description} ${job.applyUrl}`);
    const officialQuery = isYcCompany
      ? `site:ycombinator.com/companies/ "${job.company}" OR site:workatastartup.com/companies/ "${job.company}" OR "${job.company}" official website`
      : `"${job.company}" official website careers jobs`;
    const recruiterQuery = `site:linkedin.com/in/ "${job.company}" (${keywordQuery}) (recruiter OR "talent acquisition" OR "talent partner" OR sourcer)`;
    const managerQuery = `site:linkedin.com/in/ "${job.company}" (${keywordQuery}) ("hiring manager" OR founder OR CEO OR CTO OR manager OR lead OR director OR "head of")`;
    const ycQuery = `site:ycombinator.com/companies/ "${job.company}" founder team hiring`;
    const queries = [officialQuery, recruiterQuery, managerQuery, ...(isYcCompany ? [ycQuery] : [])];
    runId = await createRun(serviceClient, context.user.id, job, teamKeywords, queries);

    const firecrawlKey = asString(Deno.env.get("FIRECRAWL_API_KEY"));
    if (!firecrawlKey) throw new Error("Search provider API key is not configured.");
    const searchPromises = [
      searchWeb(firecrawlKey, officialQuery, 7),
      searchWeb(firecrawlKey, recruiterQuery, 8),
      searchWeb(firecrawlKey, managerQuery, 8),
    ];
    if (isYcCompany) {
      searchPromises.push(searchWeb(firecrawlKey, ycQuery, 6));
    }
    const searchResults = await Promise.all(searchPromises);
    const officialItems = searchResults[0] || [];
    const recruiterItems = searchResults[1] || [];
    const managerItems = searchResults[2] || [];
    const ycItems = searchResults[3] || [];
    const allItems = dedupeSearchItems([...officialItems, ...recruiterItems, ...managerItems, ...ycItems]);
    
    let officialDomain = officialDomainFrom(officialItems, job.company);
    if (!officialDomain && isYcCompany) {
      officialDomain = `${job.company.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
    }
    const careersPageUrl = careersUrlFrom(officialItems, officialDomain) || 
      (isYcCompany ? `https://www.ycombinator.com/companies/${job.company.toLowerCase().replace(/[^a-z0-9]/g, "")}` : "");

    const contactsByUrl = new Map<string, RecruiterContact>();
    for (const item of allItems) {
      const linkedinUrl = normalizeLinkedInProfileUrl(item.url);
      if (!linkedinUrl || contactsByUrl.has(linkedinUrl)) continue;
      const parsed = parseLinkedInResult(item);
      if (!parsed) continue;
      const evidence = sourceText(item);
      const companyMatch = companyTokens(job.company).some((token) => evidence.toLowerCase().includes(token));
      if (!companyMatch) continue;
      const roleKind = inferRoleKind(parsed.title);
      const score = relevanceScore(parsed.title, roleKind, evidence, job.company, teamKeywords);
      if (roleKind === "unknown" || score < 65) continue;
      contactsByUrl.set(linkedinUrl, {
        fullName: parsed.fullName,
        title: parsed.title,
        roleKind,
        linkedinUrl,
        linkedinSourceUrl: item.url,
        workEmail: "",
        emailStatus: "not_found",
        emailConfidence: 0,
        emailSourceUrl: "",
        relevanceScore: score,
        evidence: [{
          type: "public_linkedin_search_result",
          sourceUrl: item.url,
          sourceQuery: item.sourceQuery,
          excerpt: compactText(evidence, 450),
        }],
        safeToContact: false,
      });
    }

    const limit = clamp(request.limit, 5, 1, 8);
    const ranked = Array.from(contactsByUrl.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, limit);
    const contacts: RecruiterContact[] = [];
    for (const contact of ranked) {
      contacts.push(await enrichEmail(contact, officialDomain, firecrawlKey, job.company));
    }
    await persistContacts(serviceClient, context.user.id, runId, job, contacts);

    const genericInbox = verifiedRecruitmentInbox(officialItems, officialDomain);
    const bestEmail = contacts.filter((contact) => contact.safeToContact && contact.workEmail)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)[0]?.workEmail || genericInbox?.email || "";
    const safeCount = contacts.filter((contact) => contact.safeToContact).length;
    const confidence = safeCount > 0 ? "high" : contacts.length || careersPageUrl ? "medium" : "low";
    const publicContactChannels: string[] = [];
    if (careersPageUrl) publicContactChannels.push(`Careers page | ${careersPageUrl}`);
    for (const contact of contacts) {
      publicContactChannels.push(`LinkedIn | ${contact.fullName} | ${contact.title || contact.roleKind} | ${contact.linkedinUrl} | relevance=${contact.relevanceScore}`);
      if (contact.safeToContact && contact.workEmail) {
        publicContactChannels.push(`Verified work email | ${contact.fullName} | ${contact.workEmail} | ${contact.emailStatus} | source=${contact.emailSourceUrl}`);
      }
    }
    if (genericInbox && genericInbox.email !== bestEmail) {
      publicContactChannels.push(`Verified recruitment inbox | ${genericInbox.email} | source=${genericInbox.sourceUrl}`);
    }
    if (!publicContactChannels.length) publicContactChannels.push("No evidence-backed recruiter contact was found.");

    await updateRun(serviceClient, runId, {
      official_domain: officialDomain || null,
      careers_page_url: careersPageUrl || null,
      status: contacts.length || careersPageUrl ? "completed" : "partial",
      result_summary: {
        contacts: contacts.length,
        safe_contacts: safeCount,
        verified_individual_emails: contacts.filter((contact) => contact.safeToContact && contact.workEmail).length,
        verified_recruitment_inbox: genericInbox?.email || null,
      },
      error: null,
    });
    await recordUsage(serviceClient, context.user.id, context.tier, {
      company_name: job.company,
      job_id: job.id,
      confidence,
      contacts: contacts.length,
      safe_contacts: safeCount,
      has_email: Boolean(bestEmail),
      source: "public_indexed_recruiter_discovery_v2",
    });

    return jsonResponse({
      domain: officialDomain,
      careersPageUrl,
      contactEmail: bestEmail,
      publicContactChannels,
      confidence,
      foundSource: "Public indexed web and LinkedIn profile results, ranked against the job's team keywords. Work emails are returned only when published in evidence or confirmed by a configured non-catch-all verifier.",
      job,
      teamKeywords,
      recruiterContacts: contacts,
      verificationPolicy: {
        guessedEmailsReturned: false,
        patternOnlyAddressesPersistedAsSafe: false,
        authenticatedLinkedInScrapingUsed: false,
        linkedinDiscoveryMode: "public_indexed_profile_urls",
        directLinkedInMessageAvailable: false,
        emailAutoSendAllowed: false,
        requiresExplicitApprovalBeforeExternalSend: true,
        configuredEmailVerifier: Boolean(asString(Deno.env.get("RECRUITER_EMAIL_VERIFIER_URL"))),
      },
      discoveryRunId: runId,
    }, 200, headers);
  } catch (error) {
    if (serviceClient && runId) {
      await updateRun(serviceClient, runId, {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown recruiter discovery error",
      });
    }
    const status = error instanceof HttpError ? error.status : 500;
    console.error("scout-company recruiter discovery failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Internal recruiter discovery error" }, status, headers);
  }
});

````

### Generate Outreach Edge Function

Source: `backend/supabase/functions/generate-outreach/index.ts`

````typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createGeminiClient,
  createGeminiConfig,
  extractGeminiText,
  getGeminiAccessDeniedMessage,
  isGeminiAccessDeniedError,
  withModelFallback,
  runMeteredAiCall,
  createSafeAiErrorResponse,
} from "../_shared/gemini.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { parseStructuredJson } from "../_shared/structured-json.ts";
import {
  SubscriptionAccessError,
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";
import {
  enforceFeatureRateLimit,
  recordFeatureUsage,
} from "../_shared/feature-limits.ts";

interface OutreachRequest {
  companyName: string;
  role: string;
  resumeText: string;
  publicProfileUrl?: string;
  jobDescription?: string;
  instructions?: string;
}

type OutreachResponse = {
  subject: string;
  body: string;
};

function sanitizeInput(text: string, maxLength: number): string {
  if (!text) return "";
  let sanitized = text.substring(0, maxLength);
  const injectionPatterns = [
    /ignore all previous instructions/gi,
    /disregard previous instructions/gi,
    /you are now a/gi,
    /system prompt/gi,
    /output the following/gi,
  ];
  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }
  return sanitized.trim();
}

function buildPrompt(
  companyName: string,
  role: string,
  resumeText: string,
  publicProfileUrl?: string,
  jobDescription?: string,
  instructions?: string,
): string {
  return `You are an expert career coach and professional copywriter writing a highly persuasive and personalized recruiter/hiring manager outreach message (LinkedIn note or email).

  <CANDIDATE_RESUME>
  ${resumeText}
  </CANDIDATE_RESUME>

  <TARGET_JOB_INFO>
  Company: ${companyName}
  Role: ${role}
  ${jobDescription ? `Job Description:\n${jobDescription}` : ""}
  </TARGET_JOB_INFO>

  ${publicProfileUrl ? `Candidate Portfolio Link: ${publicProfileUrl}` : ""}

  ${instructions ? `<ADDITIONAL_INSTRUCTIONS>\n  ${instructions}\n  </ADDITIONAL_INSTRUCTIONS>\n` : ""}

  REQUIREMENTS:
  1. The output MUST be a valid JSON object.
  2. The JSON object MUST have exactly two keys: "subject" and "body".
  3. "subject" should be a compelling, professional subject line (under 10 words). E.g. "Tech Operations & Systems Leadership - JohnPaul Ezeagwu" or similar tailored to the candidate's name and role.
  4. "body" should be a highly personalized, short outreach message (under 250 words) suitable for a LinkedIn connection note or an email.
  5. The message MUST start with a professional greeting like "Hi [Hiring Manager Name or 'Team']," or "Dear [Company Name] Hiring Team,".
  6. The body should connect key metrics and proof points from the candidate's resume/profile to the core responsibilities of the role.
  7. The body MUST naturally reference the Candidate Portfolio Link (if provided) using a friendly CTA. E.g. "You can view my full professional profile and project portfolio here: 👉 ${publicProfileUrl}".
  8. Return ONLY the raw JSON object. Do not wrap in markdown code blocks like \`\`\`json.
  `;
}

function buildFallbackOutreachResponse(
  companyName: string,
  role: string,
  publicProfileUrl?: string,
): OutreachResponse {
  const urlSnippet = publicProfileUrl
    ? `\n\nYou can view my full professional profile and project portfolio here: 👉 ${publicProfileUrl}`
    : "";

  return {
    subject: `Application interest: ${role} - JobRaker Candidate`,
    body: `Hi ${companyName} Hiring Team,\n\nI am writing to express my interest in the ${role} position at ${companyName}. Given my background in operations, execution, and project leadership, I am excited about the opportunity to contribute to your team's success.${urlSnippet}\n\nI would love to connect and share more about my experiences.\n\nBest,\nJobRaker Candidate`,
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { user, serviceClient, subscriptionTier } = await requireSubscriptionTier(
      req,
      "Basics",
      "AI outreach generation",
    );

    // Use the outreach feature limits / billing key
    await enforceFeatureRateLimit({
      userId: user.id,
      featureKey: "generate_outreach",
      serviceClient,
      subscriptionTier,
    });

    const {
      companyName,
      role,
      resumeText,
      publicProfileUrl,
      jobDescription,
      instructions,
    } = (await req.json()) as OutreachRequest;

    if (!companyName || !role || !resumeText) {
      return new Response(
        JSON.stringify({ error: "companyName, role, and resumeText are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const safeCompanyName = sanitizeInput(companyName, 200);
    const safeRole = sanitizeInput(role, 200);
    const safeResume = sanitizeInput(resumeText, 25000);
    const safePublicProfileUrl = publicProfileUrl ? sanitizeInput(publicProfileUrl, 1000) : undefined;
    const safeJobDesc = jobDescription ? sanitizeInput(jobDescription, 15000) : undefined;
    const safeInstructions = instructions ? sanitizeInput(instructions, 2000) : undefined;

    const prompt = buildPrompt(
      safeCompanyName,
      safeRole,
      safeResume,
      safePublicProfileUrl,
      safeJobDesc,
      safeInstructions,
    );

    let outreach: OutreachResponse;
    try {
      const ai = createGeminiClient();
      const metered = await runMeteredAiCall({
        userId: user.id,
        featureKey: "generate_outreach",
        promptTextLength: prompt.length,
        execute: async () => {
          const { result: rawResponse, modelUsed } = await withModelFallback((model) =>
            ai.models.generateContent({
              model,
              config: createGeminiConfig({
                systemInstruction:
                  "You are an expert recruiter outreach assistant. Return ONLY valid JSON matching the requested schema.",
                responseMimeType: "application/json",
              }),
              contents: [{ role: "user", parts: [{ text: prompt }] }],
            })
          );
          return {
            result: rawResponse,
            usageMetadata: (rawResponse as any)?.usageMetadata,
            modelUsed,
          };
        },
      });

      const text = extractGeminiText(metered.result);
      if (!text) throw new Error("Empty response from AI");
      const parsed = parseStructuredJson(text) as Record<string, unknown>;

      outreach = {
        subject: typeof parsed.subject === "string" ? parsed.subject : `Application interest: ${safeRole}`,
        body: typeof parsed.body === "string" ? parsed.body : `Hi ${safeCompanyName} Hiring Team,...`,
      };
    } catch (error: any) {
      console.error("generate-outreach falling back", error);
      if (isGeminiAccessDeniedError(error)) {
        console.warn(getGeminiAccessDeniedMessage("AI outreach generation"));
      }
      outreach = buildFallbackOutreachResponse(
        safeCompanyName,
        safeRole,
        safePublicProfileUrl,
      );
    }

    await recordFeatureUsage({
      userId: user.id,
      featureKey: "generate_outreach",
      serviceClient,
      subscriptionTier,
      metadata: {
        company_name: safeCompanyName,
        role: safeRole,
        has_public_profile: Boolean(safePublicProfileUrl),
      },
    });

    return new Response(JSON.stringify(outreach), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    console.error("Error in generate-outreach:", error);
    return createSafeAiErrorResponse(error, corsHeaders);
  }
});

````


## Appendix C Embedded New Shared Modules

These modules are part of the Cold Mail deployment bundle and contain the new idempotency and Composio response-contract behavior.

### Cold Mail Draft Idempotency Helper

Source: `backend/supabase/functions/_shared/cold-mail-draft-idempotency.ts`

````typescript
export type ColdMailDraftAttemptRow = {
  id: string;
  status: "creating" | "created" | "uncertain";
  provider_draft_id: string | null;
  provider_message_id: string | null;
  provider_thread_id: string | null;
  draft_from: string | null;
  recipient_email: string;
};

const asString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export async function fingerprintColdMailPreparationToken(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function resolveColdMailDraftAttempt(
  row: ColdMailDraftAttemptRow | null,
) {
  if (!row) return { action: "create" as const };

  const draftId = asString(row.provider_draft_id);
  if (row.status === "created" && draftId) {
    return {
      action: "replay" as const,
      response: {
        success: true,
        draftId,
        messageId: asString(row.provider_message_id) || null,
        threadId: asString(row.provider_thread_id) || null,
        draftFrom: asString(row.draft_from) || null,
        to: asString(row.recipient_email),
        idempotentReplay: true,
      },
    };
  }

  return {
    action: "block" as const,
    response: {
      success: false,
      code: "gmail_draft_state_uncertain",
      error:
        "A Gmail draft attempt already exists but is not safely repeatable. Check Gmail drafts before trying again.",
    },
  };
}

````

### Composio Tool Contract Helper

Source: `backend/supabase/functions/_shared/composio-tool-contract.ts`

````typescript
/**
 * Direct Composio execution requires a dated toolkit version when application
 * code parses the response. Keep this pin aligned with the Gmail toolkit
 * catalog before adopting a newer output schema.
 */
export const GMAIL_TOOLKIT_VERSION = "20260828_00";

export const buildComposioExecuteBody = (
  userId: string,
  args: Record<string, unknown>,
) => ({
  user_id: userId,
  arguments: args,
  version: GMAIL_TOOLKIT_VERSION,
});

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const looksLikeToolPayload = (value: Record<string, unknown>) =>
  [
    "messages",
    "labels",
    "id",
    "draft_id",
    "draftId",
    "message_id",
    "messageId",
    "thread_id",
    "threadId",
  ].some((key) => key in value);

/** Unwraps the SDK and REST envelopes while preserving draft-specific IDs. */
export function unwrapComposioToolData(
  result: unknown,
): Record<string, unknown> {
  const root = asRecord(result);
  if (!root) return {};

  const successful = root.successful ?? root.success;
  if (successful === false) {
    const error = asRecord(root.error);
    const message = typeof root.error === "string" ? root.error : error?.message;
    throw new Error(
      typeof message === "string" && message
        ? message
        : "Composio reported the Gmail action as unsuccessful",
    );
  }

  for (const key of ["data", "response_data", "result"]) {
    const nested = asRecord(root[key]);
    if (!nested) continue;
    const deeper = asRecord(nested.response_data) ?? asRecord(nested.data);
    return deeper && looksLikeToolPayload(deeper) ? deeper : nested;
  }

  return root;
}

````

## Appendix D Required Deployment Tree

The CLI deployment must run against the repository tree, not reconstructed code copied from this report. The functions import the following implementation areas directly or transitively:

```text
backend/supabase/
├── config.toml
├── migrations/
│   └── 20260905064539_cold_mail_draft_idempotency.sql
└── functions/
    ├── cold-mail/
    │   ├── index.ts
    │   └── deno.json
    ├── jobs-search/
    │   └── index.ts
    ├── scout-company/
    │   └── index.ts
    ├── generate-outreach/
    │   ├── index.ts
    │   └── deno.json
    └── _shared/
        ├── cold-mail-contract.ts
        ├── cold-mail-draft-idempotency.ts
        ├── composio-connected-account.ts
        ├── composio-gmail.ts
        ├── composio-tool-contract.ts
        ├── cors.ts
        ├── discovery-hybrid.ts
        ├── firecrawl.ts
        ├── gemini.ts
        ├── gmail-job-agent-tools.ts
        ├── jobs.ts
        ├── metered-ai.ts
        ├── metered-composio.ts
        ├── provider-credits.ts
        ├── search-normalization.ts
        ├── structured-json.ts
        └── subscription.ts
```

The complete implementations of existing supporting functions and mature shared modules are intentionally not duplicated again in this report. They are required deployment inputs and are included automatically when the named functions are deployed from `backend` using the CLI. The embedded entrypoints above identify their exact imports.

## Appendix E Relevant Function Configuration

The current Supabase configuration declares the required functions as follows:

```toml
[functions.generate-outreach]
enabled = true
# Browser OPTIONS preflight must reach the handler; auth is enforced in requireSubscriptionTier.
verify_jwt = false
import_map = "./functions/generate-outreach/deno.json"
entrypoint = "./functions/generate-outreach/index.ts"

[functions.cold-mail]
enabled = true
# Browser OPTIONS preflight must reach the handler; auth is enforced in requireSubscriptionTier.
verify_jwt = false
import_map = "./functions/cold-mail/deno.json"
entrypoint = "./functions/cold-mail/index.ts"

[functions.scout-company]
enabled = true
verify_jwt = false
entrypoint = "./functions/scout-company/index.ts"

[functions.jobs-search]
enabled = true
# Browser OPTIONS preflight must reach the handler; auth is enforced in requireAuthenticatedUser.
verify_jwt = false
entrypoint = "./functions/jobs-search/index.ts"
```
