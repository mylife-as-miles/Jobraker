# Cold Mail Gmail Draft Audit Report

**Audit date:** 2026-09-02  
**Repository:** JobRaker  
**Starting revision:** `c3d0a2c7` (`main`)  
**Current integration base:** `84a7e1e5` (`main`, synchronized 2026-09-04)  
**Working branch:** `codex/fix-cold-mail-draft`  
**Status:** Local remediation implemented and verified; not committed, pushed, deployed, or live-tested against Gmail

## 1. Executive summary

The Cold Mail failure was not only a frontend display problem. The audit found three defects across the real drafting path:

1. AI Chat reduced a searched job to its title and company before calling the `cold-mail` Edge Function. The stable application URL shown in the search result was discarded. The Edge Function then attempted a weaker company/title database lookup and returned the observed business `404` when it could not match the saved job.
2. The shared Composio Gmail transport directly executed Gmail tools without a required toolkit version. Composio requires a dated version for direct execution when application code parses the response.
3. A successful Gmail response could contain `draft_id` inside `data.response_data`. The existing unwrapping logic did not recognize that draft-specific shape, so JobRaker could report an unconfirmed draft even when the provider returned one.

The local fix preserves the selected job URL, resolves the user-owned saved job by that URL, pins the Gmail toolkit version, and recognizes nested Gmail draft identifiers. No visual design, dependency manifest, database migration, model configuration, or unrelated application section was changed.

The implementation is not yet proof of production Gmail drafting. That proof requires deploying both the frontend change and the `cold-mail` Edge Function, then creating—but not sending—a controlled draft through an authorized test Gmail account.

## 2. Scope and constraints

The audit was intentionally limited to making the existing independent Cold Mail skill create a real Gmail draft after explicit user approval.

In scope:

- Selecting one job from the current AI Chat job-search result.
- Resolving that job against the authenticated user's saved `jobs` rows.
- Preparing the existing reviewed and signed Cold Mail payload.
- Executing Composio's Gmail draft tool.
- Confirming success only when Gmail returns a draft identifier.
- Adding regression coverage for the failed paths.

Out of scope:

- Changing the frontend layout or visual design.
- Sending email automatically.
- Implementing reply tracking, sent-email tracking, or campaign analytics.
- Changing models, providers, database schema, or the broader agent architecture.
- Fixing unrelated browser iframe or network-resource errors.
- Fixing existing repository-wide TypeScript errors outside Cold Mail.

## 3. Evidence reviewed

### 3.1 Browser evidence

The supplied browser screenshots showed:

- `POST .../functions/v1/cold-mail` returning HTTP `404`.
- Cold Mail progressing to **Resolving individual job context**.
- The user-facing error: **That individual job was not found in the current saved job search.**
- A separate cross-origin iframe navigation warning between `app.jobraker.io` and `jobraker.io`.
- A separate `ERR_CONNECTION_CLOSED` resource failure.

The response text matched an intentional `RequestError(404, ...)` inside the deployed `cold-mail` function. This established that the Edge Function route was reachable and that the reported `404` represented a failed job lookup, not a missing function endpoint.

The iframe-origin warning and connection-closed error remain separate deployment/network concerns. Neither explains the matching `cold-mail` business response.

### 3.2 Application flow reviewed

The audited draft path was:

```text
AI Chat job-search result
  -> Cold Mail skill context parser
  -> cold-mail Edge Function: prepare
  -> saved jobs lookup
  -> scout-company Edge Function
  -> generate-outreach Edge Function
  -> signed preparation token and user approval
  -> cold-mail Edge Function: create_gmail_draft
  -> agentCreateJobRelatedDraft
  -> composioGmailCreateDraft
  -> GMAIL_CREATE_EMAIL_DRAFT
  -> require a returned draftId before reporting success
```

The previously updated `send-email` Edge Function is not part of this draft-creation path.

### 3.3 Files reviewed

- `src/lib/chatSkills/coldMail.ts`
- `src/lib/chatSkills/coldMail.test.ts`
- `src/screens/Dashboard/pages/ChatPage.tsx`
- `backend/supabase/functions/ai-chat/index.ts`
- `backend/supabase/functions/process-task/index.ts`
- `backend/supabase/functions/_shared/jobs.ts`
- `backend/supabase/functions/cold-mail/index.ts`
- `backend/supabase/functions/_shared/cold-mail-contract.ts`
- `backend/supabase/functions/_shared/gmail-job-agent-tools.ts`
- `backend/supabase/functions/_shared/composio-gmail.ts`
- `src/services/supabase/invokeProtectedFunction.ts`
- Existing Cold Mail and Composio contract tests.

### 3.4 External contracts reviewed

- [Composio direct tool execution](https://docs.composio.dev/docs/tools-direct/executing-tools): direct execution requires a toolkit version; a dated version is appropriate when code parses the output.
- [Composio Gmail toolkit catalog](https://docs.composio.dev/toolkits/gmail): confirmed `GMAIL_CREATE_EMAIL_DRAFT` and Gmail toolkit version `20260828_00` at audit time.
- [Supabase changelog](https://supabase.com/changelog): reviewed for current platform changes affecting the Edge Function approach; no change was found that required altering this implementation.

## 4. Findings

### Finding A — Selected job identity was lost

**Severity:** High  
**Confirmed:** Yes

AI Chat formatted each result with title, company, metadata, and an application URL. `extractColdMailJobReferences` retained only `jobTitle` and `companyName`. Unless a separate `jobId` happened to be supplied, the Edge Function received no stable identity for the selected result.

The backend fallback used an exact case-insensitive company comparison and then an in-memory title comparison. Company formatting differences, title differences, or missing persistence could therefore produce the observed `404`.

### Finding B — Composio direct execution lacked a toolkit version

**Severity:** High  
**Confirmed:** Yes

`executeComposioTool` called `tools.execute` with `userId` and `arguments`, but no `version`. The result is parsed programmatically to extract Gmail identifiers, so the provider contract requires a dated toolkit version rather than an unguarded `latest` schema.

Without the version, direct Composio execution can reject the call before Gmail draft creation.

### Finding C — Nested Gmail draft IDs were not recognized

**Severity:** High  
**Confirmed:** Yes

The Composio response unwrapping logic descended into `response_data` only when it saw generic keys such as `id`, `messages`, or `labels`. It did not recognize `draft_id` or `draftId`.

A response shaped as follows could therefore lose its confirmed draft identifier:

```json
{
  "successful": true,
  "data": {
    "response_data": {
      "draft_id": "draft-123",
      "message": { "id": "message-123" }
    }
  }
}
```

### Finding D — Existing tests did not cover the complete failure path

**Severity:** Medium  
**Confirmed:** Yes

Existing tests covered basic search-result parsing, signed preparation tokens, recipient evidence, and draft confirmation with a fabricated top-level `draftId`. They did not verify:

- application URL preservation;
- transmission of that URL to the Edge Function;
- a versioned Composio execution request; or
- nested `response_data.draft_id` extraction.

### Finding E — Screenshot contained unrelated browser errors

**Severity:** Separate investigation  
**Confirmed:** Yes

The `app.jobraker.io` versus `jobraker.io` iframe warning indicates an origin mismatch. The connection-closed message indicates a separate resource/network failure. These should be investigated independently if they continue after deployment, but they were not required to correct the Cold Mail business `404` or Composio draft call.

## 5. Local remediation completed

### 5.1 Stable job identity

- Extended `ColdMailJobReference` with an optional `applyUrl`.
- Updated search-result parsing to associate the URL immediately following each numbered job.
- Passed the selected URL in the `cold-mail` prepare request.
- Added `applyUrl` bounds checking in the Edge Function.
- Added a user-scoped exact `jobs.apply_url` lookup before the existing company/title fallback.
- Limited the URL query to one matching row to avoid ambiguous `maybeSingle` behavior.

### 5.2 Deterministic Composio execution

- Added a small shared Composio execution contract.
- Preserved the updated main branch's REST-only Gmail execution path.
- Pinned Gmail toolkit version `20260828_00` in the direct REST execution body.
- Did not upgrade `@composio/core` or add a dependency.

### 5.3 Reliable draft confirmation

- Moved provider-envelope unwrapping into a testable shared helper.
- Added recognition for `draft_id`, `draftId`, message IDs, and thread IDs.
- Preserved the existing fail-closed behavior: JobRaker reports success only when a non-empty draft ID is present.

### 5.4 Files changed by the remediation

- `src/lib/chatSkills/coldMail.ts`
- `src/lib/chatSkills/coldMail.test.ts`
- `backend/supabase/functions/cold-mail/index.ts`
- `backend/supabase/functions/_shared/composio-gmail.ts`
- `backend/supabase/functions/_shared/composio-tool-contract.ts` (new)
- `src/__tests__/cold-mail-contract.test.ts`

## 6. Verification results

| Check | Result | Notes |
|---|---|---|
| Regression tests before implementation | Failed as expected | Reproduced missing URL and missing response-unwrapping behavior. |
| Focused Cold Mail tests | Passed | 15 tests passed across 2 files. |
| Full Vitest suite | Passed | 32 test files and 148 tests passed. |
| Production frontend build | Passed | Vite completed successfully; existing bundle-size warnings remain. |
| Edge Function TypeScript syntax bundle | Passed | Local esbuild syntax/bundle check completed with remote imports externalized. |
| Diff whitespace validation | Passed | `git diff --check` returned no errors. |
| Scope-creep classifier | Passed | No tracked-file creep, dependency, config, CI, rename, formatting-only, or oversized-hunk signals. The new shared helper was also manually reviewed as directly required. |
| Repository-wide TypeScript check | Baseline failure | Errors remain in unrelated existing admin, analytics, chat, UI, and dashboard files; none referenced the changed Cold Mail files. |
| Native Deno type check | Not run | Deno is not installed on this workstation. |
| Live Gmail draft creation | Not run | Requires deployed code, an authorized test Gmail account, and explicit approval to create a real draft. |

## 7. Scope audit

The remediation touches two necessary layers:

- `src`: extracts and transports the selected job identity and supplies regression tests.
- `backend`: resolves the saved job and executes/parses the Gmail provider call.

No changes were made to:

- React page layout, styling, or visible component design;
- package manifests or lockfiles;
- database migrations or RLS policies;
- CI/CD configuration;
- model names or model configuration;
- email sending behavior; or
- unrelated product sections.

The pre-existing untracked `docs/DEPENDENCY_VULNERABILITY_REPORT.md` was preserved and was not modified as part of this work.

## 8. Remaining risks and limitations

1. **Production code is unchanged until deployment.** The local fix cannot affect the currently deployed frontend or Supabase function.
2. **A real Gmail draft is not yet confirmed.** Automated tests prove the application contract, not the external OAuth account and production provider configuration.
3. **Composio configuration must exist.** `COMPOSIO_API_KEY` and an active user-scoped Gmail connection are required in production.
4. **Toolkit upgrades must be deliberate.** Before changing `20260828_00`, compare the new Gmail input/output schema and rerun the contract tests.
5. **Fallback matching remains intentionally available.** Requests without an application URL still use the existing company/title lookup and are inherently less precise.
6. **Separate browser-origin errors may remain.** The iframe origin mismatch and connection-closed resource should receive their own audit if reproducible after deployment.

## 9. Required production validation

After review, commit, push, merge, frontend deployment, and `cold-mail` Edge Function deployment:

1. Use an authorized non-personal test Gmail account connected through JobRaker Settings → Integrations.
2. Run a new job search in AI Chat.
3. Select one result by number, company, or role.
4. Invoke Cold Mail for that result.
5. Confirm the preparation shows the intended company, role, recipient, subject, and body.
6. Explicitly approve **Create Gmail draft**.
7. Verify a new item exists in Gmail's Drafts folder.
8. Verify the Edge Function response contains a non-empty `draftId`.
9. Confirm no message was sent.
10. Capture sanitized request IDs and function logs if any step fails; do not copy OAuth tokens, API keys, or email contents into the report.

## 10. Release decision

**Local engineering status:** Ready for commit and pull-request review.  
**Deployment status:** Not deployed.  
**Operational status:** Not yet confirmed in a real Gmail account.  
**Database migration required:** No.  
**New dependency required:** No.  
**Frontend design change required:** No.

The Cold Mail issue should be considered fully resolved only after the controlled production validation returns a real Gmail `draftId` and the draft is visible in the authorized Gmail account.
