# Supabase Operator Handoff: Deploy the Cold Mail Skill

Export date: 2026-09-01
Project: Jobraker
Supabase project reference: `yquhsllwrwfvrwolqywh`
Feature branch: `codex/independent-cold-mail-skill`

## Who This Document Is For

Give this entire document to the engineer responsible for Jobraker's Supabase project. That engineer can paste it into an AI coding agent that has:

- access to the Jobraker repository and the feature branch above,
- permission to inspect and edit `backend/supabase`,
- a locally configured Supabase access token,
- permission to manage Edge Function secrets and deployments for project `yquhsllwrwfvrwolqywh`, and
- access to an authorized Jobraker test user with a connected Gmail account.

Do not paste access tokens, service-role keys, Gmail credentials, or provider secrets into an AI chat. Put them in the operator's local environment or Supabase secret manager.

## AI Agent Assignment

Copy the following assignment into the Supabase operator's AI agent together with this document:

> You are responsible for making Jobraker's independent Cold Mail skill operational in Supabase project `yquhsllwrwfvrwolqywh`. Work from branch `codex/independent-cold-mail-skill`. Inspect the repository before acting. Verify the committed `cold-mail` function configuration, verify the required existing database objects and secret names, deploy only the Edge Functions listed as required in this document, and perform an authenticated end-to-end smoke test that creates a real Gmail draft. Do not send email. Do not alter frontend design, models, libraries, database architecture, unrelated Edge Functions, or the 44 pre-existing dependency findings. Never print or commit secrets. Stop and report clearly if a required credential, Gmail connection, database object, or contact-provider configuration is unavailable. Do not claim success unless the provider returns a non-empty Gmail `draftId` and the draft is visible in the connected Gmail account.

## Required Outcome

The assignment is complete only when all of the following are true:

1. `cold-mail`, `scout-company`, and `generate-outreach` are active and compatible in the target Supabase project.
2. `composio-auth` can confirm the test user's Gmail connection.
3. The `cold-mail` `prepare` action returns a signed reviewable preparation for one saved job and one verified recipient.
4. The user approves the reviewed message.
5. The `create_gmail_draft` action returns `success: true` and a non-empty `draftId`.
6. The same recipient, subject, and body are visible in the user's Gmail Drafts folder.
7. No email is sent.

## Scope and Change Restrictions

The Supabase operator or AI agent is authorized to:

- verify the committed `[functions.cold-mail]` block in `backend/supabase/config.toml`,
- configure the listed Supabase secrets without exposing their values,
- deploy the four functions described in this document,
- inspect the required tables, RPCs, function logs, and deployment versions,
- run read-only checks and the single authorized Gmail draft smoke test, and
- make a narrowly scoped correction only when it is required for this exact runtime chain and is reported in the completion summary.

The operator or AI agent must not:

- redesign or otherwise change the frontend,
- change model names or model configuration,
- update packages or address the 44 pre-existing dependency findings,
- replace Composio, Firecrawl, Gemini, Supabase, or the existing contact-verifier interface,
- deploy unrelated Edge Functions,
- create a new database architecture or migration unless a required object is genuinely absent and the owner explicitly approves it,
- weaken authentication, ownership checks, CORS restrictions, contact-verification policy, or Gmail success confirmation,
- create multiple test drafts, or
- send any email.

## Operator Inputs Required Before Starting

The human Supabase operator must provide these through local environment configuration or the Supabase Dashboard:

```text
SUPABASE_ACCESS_TOKEN
GEMINI_API_KEY
FIRECRAWL_API_KEY
COMPOSIO_API_KEY
COMPOSIO_GMAIL_CONFIG_ID
PUBLIC_APP_URL
COLD_MAIL_SIGNING_SECRET
RECRUITER_EMAIL_VERIFIER_URL
RECRUITER_EMAIL_VERIFIER_API_KEY
```

The operator must also identify one authorized `Basics`-or-higher test user that has a saved job, candidate evidence, and permission to connect Gmail. If any of these inputs are unavailable, the AI agent must stop at the relevant gate and report exactly what is missing.

## Execution Summary for the AI Agent

Follow this order; the detailed commands and contracts appear later in this document.

1. Confirm the repository, branch, and clean understanding of existing changes.
2. Inspect current Supabase CLI help/version and authenticate without printing the token.
3. Verify the committed `cold-mail` block in `backend/supabase/config.toml`.
4. Confirm required tables and RPCs exist; do not create replacements speculatively.
5. Confirm required secret names are present; never print secret values.
6. Compile/check the three core functions locally.
7. Deploy or verify `composio-auth`.
8. Deploy `scout-company`.
9. Deploy `generate-outreach`.
10. Deploy `cold-mail` last.
11. Check deployment status and logs.
12. Connect or confirm Gmail for the authorized test user.
13. Run one Cold Mail preparation and review it.
14. After explicit approval, create one Gmail draft.
15. Verify the provider `draftId` and the actual Gmail Drafts entry.
16. Return the completion report defined at the end of this document.

## Purpose

This document is the deployment and integration manifest for the independent **Cold Mail** skill in AI Chat. The skill works on one saved job, researches an evidence-backed recruiter contact, writes a personalized email, pauses for user approval, and then creates a real draft in the user's connected Gmail account.

The browser must never claim success based only on generated text. Completion is confirmed only when the Gmail provider returns a non-empty `draftId`.

## Required Runtime Chain

```text
AI Chat Cold Mail skill button
        |
        | authenticated user JWT
        v
1. cold-mail (orchestrator)
        |
        +--> 2. scout-company
        |       +--> public web research
        |       +--> optional/required contact verifier adapter
        |
        +--> 3. generate-outreach
        |       +--> Gemini
        |
        +--> shared Gmail draft helper
                +--> Composio Gmail connected account

4. composio-auth
        +--> establishes and checks the user's Gmail connection
        +--> required before draft creation if Gmail is not connected
```

## Function Inventory

| Function | Classification | Deploy? | Responsibility |
| --- | --- | --- | --- |
| `cold-mail` | Core orchestrator | Yes | Resolves the job, invokes specialists, signs the reviewed preparation, and creates the Gmail draft. |
| `scout-company` | Core specialist | Yes | Performs public research and returns only source-backed or provider-verified contacts. |
| `generate-outreach` | Core specialist | Yes | Uses candidate evidence and job context to generate the subject and email body. |
| `composio-auth` | Gmail connection support | Yes, unless the current deployed version is already active and compatible | Connects, checks, and disconnects per-user Gmail accounts through Composio. |

The first three functions are required on every Cold Mail deployment. `composio-auth` must also be available to users who need to connect Gmail.

---

## 1. `cold-mail`

### Source

- Entrypoint: `backend/supabase/functions/cold-mail/index.ts`
- Function config/import map: `backend/supabase/functions/cold-mail/deno.json`
- Shared integrity contract: `backend/supabase/functions/_shared/cold-mail-contract.ts`

### Role

This is the only Edge Function invoked directly by the independent Cold Mail chat skill. It owns the workflow and exposes two actions:

1. `prepare`
2. `create_gmail_draft`

### `prepare` request

```json
{
  "action": "prepare",
  "jobId": "optional-saved-job-id",
  "companyName": "Acme",
  "jobTitle": "Backend Engineer",
  "instructions": "Optional user drafting preferences"
}
```

The function resolves exactly one job owned by the authenticated user. If more than one job is present in chat context, the frontend skill asks the user to select one before this request is made.

### `prepare` internal sequence

1. Authenticate the Supabase user and require at least the `Basics` subscription tier.
2. Resolve the selected job using `jobs.user_id = authenticated user id`.
3. Invoke `scout-company` with the same user authorization header.
4. Select only a safe recipient:
   - `source_verified`, or
   - `provider_verified`, or
   - a public recruitment inbox with an HTTP(S) evidence URL.
5. Load candidate evidence from the user's resume or profile records.
6. Invoke `generate-outreach` with the job and candidate evidence.
7. Validate subject and body bounds.
8. Sign the user ID, job, recipient, subject, and body into a short-lived HMAC preparation token.
9. Return `needs_approval`; do not touch Gmail yet.

### `prepare` success response

```json
{
  "success": true,
  "status": "needs_approval",
  "preparation": {
    "jobId": "job-id",
    "companyName": "Acme",
    "jobTitle": "Backend Engineer",
    "recipient": {
      "email": "recruiter@acme.com",
      "name": "Recruiter Name",
      "title": "Technical Recruiter",
      "source": "https://evidence-or-verifier.example",
      "confidence": "high"
    },
    "subject": "Subject for review",
    "body": "Email body for review"
  },
  "preparationToken": "signed-short-lived-token",
  "agents": [
    { "id": "job_context", "status": "completed" },
    { "id": "recruiter_scout", "status": "completed" },
    { "id": "candidate_evidence", "status": "completed" },
    { "id": "outreach_writer", "status": "completed" },
    { "id": "gmail_draft", "status": "awaiting_approval" }
  ]
}
```

### `create_gmail_draft` request

```json
{
  "action": "create_gmail_draft",
  "preparationToken": "signed-short-lived-token-returned-by-prepare"
}
```

### `create_gmail_draft` internal sequence

1. Re-authenticate the user.
2. Verify the HMAC signature and expiration.
3. Verify that the signed token belongs to the authenticated user.
4. Use the existing server-only `agentCreateJobRelatedDraft` helper.
5. Resolve the user's active Composio Gmail connected account.
6. Validate the outbound content with the existing job-email guardrails.
7. Ask Composio Gmail to create the draft.
8. Return success only when a non-empty provider `draftId` exists.

### Confirmed success response

```json
{
  "success": true,
  "draftId": "gmail-provider-draft-id",
  "messageId": "gmail-message-id-or-null",
  "threadId": "gmail-thread-id-or-null",
  "draftFrom": "connected-user@gmail.com",
  "to": "recruiter@acme.com"
}
```

If Gmail reports success without a draft ID, the function returns HTTP `502` with `gmail_draft_unconfirmed`. The UI remains in an error state and does not say the draft was created.

### Required shared modules

The Supabase bundler includes these automatically because they are imported by the entrypoint:

```text
backend/supabase/functions/_shared/cold-mail-contract.ts
backend/supabase/functions/_shared/cors.ts
backend/supabase/functions/_shared/subscription.ts
backend/supabase/functions/_shared/gmail-job-agent-tools.ts
backend/supabase/functions/_shared/composio-gmail.ts
backend/supabase/functions/_shared/composio-connected-account.ts
```

### Required function configuration

This section is committed in `backend/supabase/config.toml` and must be verified before deployment:

```toml
[functions.cold-mail]
enabled = true
# Browser OPTIONS reaches the handler; requireSubscriptionTier performs auth.
verify_jwt = false
import_map = "./functions/cold-mail/deno.json"
entrypoint = "./functions/cold-mail/index.ts"
```

This repository's authenticated browser functions use `verify_jwt = false` so CORS preflight can reach the handler, then authenticate inside the function with `requireSubscriptionTier`. Do not remove the application-level authentication check.

---

## 2. `scout-company`

### Source

- Entrypoint: `backend/supabase/functions/scout-company/index.ts`
- Existing documentation: `docs/recruiter-contact-discovery.md`

### Role

This is the recruiter/contact research specialist. The Cold Mail orchestrator invokes it server-to-server using the original user's authorization header.

### Request used by Cold Mail

```json
{
  "companyName": "Acme",
  "jobId": "saved-job-id",
  "jobTitle": "Backend Engineer",
  "jobDescription": "Saved job description",
  "applyUrl": "https://company.example/jobs/123",
  "limit": 5
}
```

### Responsibilities

- Confirm the job belongs to the authenticated user.
- Resolve the official company domain and careers page.
- Search publicly indexed company and LinkedIn results.
- Rank recruiters, talent staff, hiring managers, and team leaders against job keywords.
- Find exact published work emails.
- Optionally test hidden candidates through the configured verifier adapter.
- Mark a contact `safeToContact` only when evidence meets policy.
- Persist recruiter discovery runs and contacts for the user.

### Contact states accepted by Cold Mail

```text
source_verified
provider_verified
```

The skill rejects `pattern_only`, `unverified`, `domain_valid` without direct source evidence, and `not_found` contacts. It never drafts to a synthesized email pattern.

### Required custom secret

```text
FIRECRAWL_API_KEY
```

### Contact-provider adapter

To satisfy the planned **public web research plus contact provider** workflow reliably, configure:

```text
RECRUITER_EMAIL_VERIFIER_URL
RECRUITER_EMAIL_VERIFIER_API_KEY
```

The verifier URL must be an HTTP(S) endpoint. The current adapter sends:

```json
{
  "email": "candidate@company.com",
  "fullName": "Candidate Name",
  "company": "Company Name"
}
```

Only an affirmative deliverability response with `catchAll !== true` becomes `provider_verified`.

Without the verifier, the function can still return an exact email published in public evidence, but it may find fewer usable recipients.

### Existing function configuration

```toml
[functions.scout-company]
enabled = true
verify_jwt = false
entrypoint = "./functions/scout-company/index.ts"
```

---

## 3. `generate-outreach`

### Source

- Entrypoint: `backend/supabase/functions/generate-outreach/index.ts`
- Import map: `backend/supabase/functions/generate-outreach/deno.json`

### Role

This is the specialist writer. It receives server-loaded candidate evidence and the resolved saved job. It does not choose a recipient and cannot create or send Gmail messages.

### Request used by Cold Mail

```json
{
  "companyName": "Acme",
  "role": "Backend Engineer",
  "resumeText": "Candidate resume or profile evidence",
  "publicProfileUrl": "https://app.jobraker.io/u/profile-slug",
  "jobDescription": "Saved job description",
  "instructions": "Optional user preferences"
}
```

### Response

```json
{
  "subject": "Short professional subject",
  "body": "Personalized message under the configured limits"
}
```

### Guardrails already present

- Authenticated subscription-tier enforcement.
- Feature rate limiting and usage recording.
- Input length limits.
- Basic prompt-injection phrase redaction.
- Structured JSON parsing.
- Safe fallback draft if the model call fails.
- Central model configuration through the existing shared Gemini helper.

### Required custom secret

```text
GEMINI_API_KEY
```

No model name or model configuration needs to be changed for Cold Mail.

### Existing function configuration

```toml
[functions.generate-outreach]
enabled = true
verify_jwt = false
import_map = "./functions/generate-outreach/deno.json"
entrypoint = "./functions/generate-outreach/index.ts"
```

---

## 4. `composio-auth`

### Source

- Entrypoint: `backend/supabase/functions/composio-auth/index.ts`
- Connection normalization: `backend/supabase/functions/_shared/composio-connected-account.ts`
- Gmail adapter: `backend/supabase/functions/_shared/composio-gmail.ts`

### Role

This function manages the per-user Gmail OAuth connection used later by `cold-mail`. It is called from Settings > Integrations, not from the Cold Mail preparation flow.

### Required actions for Gmail

| Action | Purpose |
| --- | --- |
| `status` | Confirm that this user owns an active Gmail connection. |
| `initiate` | Start the Composio Gmail authorization flow. |
| `disconnect` | Remove the user's Gmail connected account. |

### Connection sequence

1. User opens Settings > Integrations.
2. Frontend calls `composio-auth` with `action: "initiate"` and the Gmail toolkit/config ID.
3. User completes Google's authorization flow in the Composio window.
4. Frontend polls `composio-auth` with `action: "status"`.
5. `cold-mail` later resolves the same active Gmail connection by authenticated user ID.

### Required custom secrets/configuration

```text
COMPOSIO_API_KEY
COMPOSIO_GMAIL_CONFIG_ID
PUBLIC_APP_URL=https://app.jobraker.io
```

The frontend can alternatively provide the Gmail configuration ID with:

```text
VITE_COMPOSIO_GMAIL_CONFIG_ID
```

Server-side `COMPOSIO_GMAIL_CONFIG_ID` is a useful fallback. The Composio auth configuration must allow the Gmail toolkit action used by the server adapter: `GMAIL_CREATE_EMAIL_DRAFT`.

### Existing function configuration

```toml
[functions.composio-auth]
enabled = true
verify_jwt = false
entrypoint = "./functions/composio-auth/index.ts"
```

The repository deployment record shows `composio-auth` was active as version 65 on 2026-07-31. Confirm the remote version still contains the current per-user ownership checks before relying on it.

---

## Shared Supabase Environment Variables

Supabase provides these hosted Edge Function values automatically:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

The current implementation still reads the legacy anon/service-role environment names. Supabase's current documentation says hosted functions continue to receive those legacy variables alongside newer publishable/secret key collections. Do not expose the service-role value to the browser.

### Complete custom configuration matrix

| Variable | Required? | Used by | Purpose |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | Yes | `generate-outreach` | Produces the personalized draft. |
| `FIRECRAWL_API_KEY` | Yes | `scout-company` | Performs public company/recruiter research. |
| `COMPOSIO_API_KEY` | Yes | `composio-auth`, Gmail shared adapter | Manages connected accounts and creates Gmail drafts. |
| `COMPOSIO_GMAIL_CONFIG_ID` | Recommended/usually required | `composio-auth` | Server-side Gmail auth configuration fallback. |
| `VITE_COMPOSIO_GMAIL_CONFIG_ID` | Alternative frontend configuration | Settings integration UI | Supplies the Gmail auth configuration from the frontend build. |
| `PUBLIC_APP_URL` | Recommended | `composio-auth` | Restricts the OAuth return URL to the production app. |
| `COLD_MAIL_SIGNING_SECRET` | Strongly recommended | `cold-mail` | Signs reviewed draft preparations. If absent, the function currently falls back to the server-only service-role key. |
| `RECRUITER_EMAIL_VERIFIER_URL` | Required for provider verification | `scout-company` | Contact-provider endpoint. |
| `RECRUITER_EMAIL_VERIFIER_API_KEY` | Required when the provider needs authentication | `scout-company` | Authenticates verifier requests. |

Generate `COLD_MAIL_SIGNING_SECRET` as a high-entropy random secret and store it only in Supabase Edge Function secrets.

---

## Database Prerequisites

No new migration is introduced by the Cold Mail orchestrator, but the remote project must already contain the tables/RPCs used by the existing specialists:

### Job and candidate context

```text
jobs
resumes
parsed_resumes
profiles
profile_experiences
profile_education
profile_skills
public_profile_sites
```

### Recruiter research

```text
applications
recruiter_discovery_runs
recruiter_contacts
```

### Subscription and usage infrastructure

```text
user_subscriptions
subscription_plans
feature_usage_events
user_feature_quotas
get_user_tier RPC
check_tier_access RPC
```

The Edge Functions use a server-side service client only after validating the user. Job, resume, profile, and recruiter queries remain scoped to the authenticated user ID.

---

## Functions That Are Not Required for This Milestone

| Function | Why it is not required |
| --- | --- |
| `ai-chat` | The independent skill registry calls `cold-mail` directly. The general model tool loop is not part of this approval path. |
| `gmail-auth` | Legacy/custom Gmail OAuth path. Cold Mail uses the current Composio connected-account adapter. |
| `sync-gmail-application-events` | Used for reading and classifying recruiter/application emails, not creating a draft. This belongs to later reply tracking. |
| `send-email` | Cold Mail creates a draft only; it does not send. |
| `send_gmail_job_email` inside `ai-chat` | Sending is explicitly outside this milestone. |
| Background `outreach_agent` / `process-task` | Multi-touch campaigns and asynchronous outreach are later phases. |

Do not deploy unrelated functions merely to enable Cold Mail.

---

## GitHub and Production Release Order

There are two different actions that are often both called "deploying to GitHub":

### Safe now: push the feature branch and open a pull request

The code can be pushed to GitHub on `codex/independent-cold-mail-skill` and reviewed before the Supabase work is completed. This gives the Supabase operator and their AI agent access to the exact implementation.

Pushing a branch or opening a pull request does not activate the feature for production users unless the repository is configured to deploy every branch as a public production release.

### Wait: merge or deploy the frontend to production

Do not merge this feature into the production branch or trigger the production frontend deployment until the required Edge Functions, secrets, Gmail connection, and live draft smoke test are complete.

There is currently no documented feature flag hiding the Cold Mail skill. If the frontend is released first, users can see and invoke the button while `cold-mail` is absent or unconfigured, causing a failed request instead of a Gmail draft.

### Recommended release sequence

```text
1. Push feature branch to GitHub
2. Open pull request and review code
3. Supabase operator checks out the same branch
4. Configure secrets and config.toml
5. Deploy/verify required Edge Functions
6. Run authorized Gmail draft smoke test
7. Record successful draftId and verify Gmail Drafts
8. Merge the pull request
9. Deploy the frontend/application to production
10. Monitor Cold Mail errors and latency after release
```

If GitHub automatically deploys pull-request previews, a preview deployment is acceptable for review, but its Cold Mail action should not be treated as operational until it points to the prepared Supabase environment.

## Deployment Order

Run commands from the repository's `backend` directory, which contains the `supabase` folder.

### 1. Authenticate the CLI

PowerShell:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "<set-locally-do-not-commit>"
npx.cmd supabase login --token $env:SUPABASE_ACCESS_TOKEN
```

### 2. Configure custom secrets

Prefer an ignored local environment file or the Supabase Dashboard. Never put real values in source control.

```powershell
npx.cmd supabase secrets set --env-file .\supabase\.env.production --project-ref yquhsllwrwfvrwolqywh
```

Minimum secret set:

```text
GEMINI_API_KEY
FIRECRAWL_API_KEY
COMPOSIO_API_KEY
COMPOSIO_GMAIL_CONFIG_ID
PUBLIC_APP_URL
COLD_MAIL_SIGNING_SECRET
RECRUITER_EMAIL_VERIFIER_URL
RECRUITER_EMAIL_VERIFIER_API_KEY
```

Supabase documents that production secrets become available immediately after `supabase secrets set`; a function redeploy is not required solely for a secret-value update.

### 3. Deploy connection support if needed

```powershell
npx.cmd supabase functions deploy composio-auth --project-ref yquhsllwrwfvrwolqywh --use-api
```

### 4. Deploy specialists

```powershell
npx.cmd supabase functions deploy scout-company --project-ref yquhsllwrwfvrwolqywh --use-api
npx.cmd supabase functions deploy generate-outreach --project-ref yquhsllwrwfvrwolqywh --use-api
```

### 5. Deploy the orchestrator last

```powershell
npx.cmd supabase functions deploy cold-mail --project-ref yquhsllwrwfvrwolqywh --use-api
```

Deploying the orchestrator last ensures it cannot call a missing or outdated specialist. Supabase officially supports `--use-api` deployment without Docker.

### Nested-call capacity note

`cold-mail` makes two nested function-to-function requests per preparation: one to `scout-company` and one to `generate-outreach`. Supabase introduced a hosted nested-call rate limit in March 2026 with a minimum shared budget of 5,000 calls per minute per request chain. This workflow is far below that limit under normal use, but the chain should still be monitored.

---

## Pre-deployment Verification

From the repository root:

```powershell
npm.cmd test -- src/lib/chatSkills/coldMail.test.ts src/lib/chat/chatSkillsPalette.test.ts src/components/chat/ColdMailSkillCard.test.tsx src/__tests__/cold-mail-contract.test.ts
npm.cmd run lint
npm.cmd run build
```

Deno check:

```powershell
npx.cmd -y deno check --config .\backend\supabase\functions\cold-mail\deno.json --node-modules-dir=auto .\backend\supabase\functions\cold-mail\index.ts
```

Current local verification status at export time:

```text
Focused Cold Mail tests: 22 passed
Full repository tests: 144 passed
Lint: passed
Production build: passed
Cold Mail Deno check: passed
```

The repository-wide TypeScript check still reports unrelated pre-existing errors outside the Cold Mail implementation. No dependency or stack changes are included here.

---

## Authorized Live Gmail Smoke Test

This is the proof that the feature is operational rather than frontend-only.

1. Deploy the four functions above.
2. Sign in to Jobraker as a `Basics`-or-higher user.
3. Open Settings > Integrations.
4. Connect Gmail through Composio and confirm the UI reports `Connected`.
5. Ensure the user has:
   - at least one saved job,
   - a resume or meaningful profile evidence,
   - a target whose recruiter/public recruitment address can be verified.
6. In AI Chat, run a job search or reference one saved job.
7. Invoke:

   ```text
   @ColdMail draft for the second job
   ```

8. Confirm the review card contains:
   - the intended individual job,
   - the verified recipient and source,
   - a subject,
   - a complete email body.
9. Click **Create Gmail draft**.
10. Require the backend response to include:

    ```json
    {
      "success": true,
      "draftId": "non-empty-value"
    }
    ```

11. Open the connected Gmail account and verify the same recipient, subject, and body exist in the Drafts folder.
12. If there is no `draftId`, treat the test as failed even if the UI has generated copy.

## Expected Failure States

| Failure | Expected result |
| --- | --- |
| Gmail is not connected | Stop with `gmail_not_connected`; no success state. |
| No verified recipient exists | Stop before approval; no Gmail call. |
| Candidate has no resume/profile evidence | Stop with an evidence-required error. |
| Preparation token is changed | Reject as invalid. |
| Preparation token is expired | Reject as expired. |
| Token belongs to another user | Return `403`. |
| Gmail provider returns no draft ID | Return `502 gmail_draft_unconfirmed`. |
| User is below the required tier | Return subscription access error. |

---

## Operational Boundaries

- This milestone creates Gmail drafts only.
- It never automatically sends an email.
- It never drafts to guessed or pattern-only addresses.
- It handles one individual job and one recipient at a time.
- It requires an explicit user click after reviewing the message.
- It does not implement reply tracking, follow-ups, campaign metrics, or sending.
- The signed preparation is currently short-lived but not persisted as a one-time-use database record. The UI prevents ordinary duplicate clicks; persistent idempotency can be added later if needed.

## Official Supabase References

- [Edge Functions overview](https://supabase.com/docs/guides/functions)
- [Edge Functions quickstart and API deployment](https://supabase.com/docs/guides/functions/quickstart)
- [Edge Function environment variables and production secrets](https://supabase.com/docs/guides/functions/secrets)
- [Securing Edge Functions](https://supabase.com/docs/guides/functions/auth)
- [March 2026 nested Edge Function call rate limit](https://supabase.com/changelog/43644-edge-functions-rate-limits-on-recursive-nested-edge-functions-calls)
- [Supabase breaking-change changelog](https://supabase.com/changelog?types=breaking-change)

## Required AI Agent Completion Report

The Supabase operator's AI agent must return a report in this format. It must not include secret values, access tokens, authorization headers, or full user JWTs.

```markdown
# Cold Mail Supabase Deployment Report

## Result
- Status: SUCCESS | PARTIAL | BLOCKED | FAILED
- Supabase project: yquhsllwrwfvrwolqywh
- Git branch/commit tested: <branch and commit SHA>
- Test user identifier: <non-sensitive internal identifier or redacted email>

## Configuration
- [functions.cold-mail] added and verified: yes/no
- Required database objects present: yes/no
- Required secret names present: yes/no
- Missing configuration: <names only; never values>

## Function Deployment
| Function | Deployed/verified | Remote version/status | Notes |
| --- | --- | --- | --- |
| composio-auth | | | |
| scout-company | | | |
| generate-outreach | | | |
| cold-mail | | | |

## Validation
- Local compile/check result:
- Authentication check result:
- Subscription-tier check result:
- Gmail connection status:
- Verified recipient source found: yes/no
- Prepare action result: needs_approval/failed
- Approval obtained before Gmail call: yes/no
- Gmail provider returned success: yes/no
- Non-empty draftId returned: yes/no
- Draft visible in Gmail Drafts: yes/no
- Email sent: must be no

## Smoke-Test Artifact
- Draft ID: <record only if permitted; otherwise state "recorded securely">
- Recipient: <redacted if required>
- Subject matched reviewed preparation: yes/no
- Body matched reviewed preparation: yes/no

## Logs and Monitoring
- New cold-mail errors observed:
- Nested specialist errors observed:
- Approximate preparation latency:
- Approximate Gmail draft latency:

## Changes Made
- <exact files/configuration changed>

## Remaining Risks or Blockers
- <none, or precise blocker and required owner action>

## Rollback Readiness
- Previous function versions identified: yes/no
- Rollback method verified: yes/no
```

The status may be `SUCCESS` only when the real Gmail draft is visible and the provider returned a non-empty `draftId`. A successful function deployment without that smoke test is `PARTIAL`, not `SUCCESS`.

## Rollback Plan

No database migration is introduced by this feature, so rollback is limited to application and Edge Function code.

Trigger rollback if authentication/ownership checks fail, the wrong recipient or message reaches Gmail, draft creation produces duplicates unexpectedly, error rate exceeds twice the normal baseline, or a security issue is discovered.

Rollback sequence:

1. Stop or revert the production frontend release so users cannot invoke the Cold Mail button.
2. Identify the previously deployed versions of `composio-auth`, `scout-company`, and `generate-outreach` from the Supabase Dashboard before changing them.
3. If an existing specialist was updated and regressed, check out its last known-good Git revision and redeploy that exact function source.
4. Leave `cold-mail` unexposed by the frontend, or redeploy its last known-good revision if one exists.
5. Do not delete user Gmail connections or recruiter data as part of a code rollback.
6. Confirm existing AI Chat, company scouting, outreach writing, and Gmail integrations still behave normally.
7. Record the rollback reason, affected function versions, and verification result.

For the first production hour, monitor the Supabase function logs for `cold-mail failed`, specialist HTTP failures, `gmail_not_connected`, and `gmail_draft_unconfirmed`. Also track preparation latency, Gmail draft latency, and repeated approval attempts.

## Final Deployment Checklist

- [ ] Verify `[functions.cold-mail]` in `backend/supabase/config.toml`.
- [ ] Confirm all custom secrets are configured remotely.
- [ ] Confirm Gmail Composio auth configuration includes draft permission.
- [ ] Confirm `composio-auth` works for the target user.
- [ ] Deploy `composio-auth` if its remote source is outdated.
- [ ] Deploy `scout-company`.
- [ ] Deploy `generate-outreach`.
- [ ] Deploy `cold-mail` last.
- [ ] Run the authorized smoke test.
- [ ] Record the returned Gmail `draftId`.
- [ ] Confirm the draft is visible in the connected Gmail account.
