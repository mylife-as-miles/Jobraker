# Recruiter Contact Discovery v2

Jobraker AI Chat now follows a job-aware, evidence-backed workflow for finding the people most likely to influence an application. The system must never present a generated email pattern as a verified address.

## Workflow

1. Resolve the user's saved job or application.
2. Read the job title and description.
3. Extract exact team, department, function, and role keywords.
4. Resolve the company's official domain and careers page from public sources.
5. Search publicly indexed LinkedIn profile URLs using the company plus team keywords.
6. Rank recruiters, hiring managers, team leads, and directors by role and team relevance.
7. Search public sources for an exact work email tied to that person and official domain.
8. Optionally submit hidden email-pattern candidates to a configured verifier service.
9. Store the source evidence, verification state, and `safe_to_contact` decision.
10. Return the ranked LinkedIn profiles and only source-backed or provider-verified emails to AI Chat.

## Verification policy

The following email states are stored:

- `source_verified`: the exact address was published in a source that also identifies the person and company.
- `provider_verified`: an external verifier reported the exact candidate as deliverable and non-catch-all.
- `domain_valid`: reserved for an official generic recruiting inbox published on a trusted source.
- `pattern_only`: a generated candidate that has not been verified. It is never returned to the user and is never safe to contact.
- `unverified`: an address was observed but the evidence is insufficient.
- `not_found`: no address was found.

`safe_to_contact` is true only for source-backed or provider-verified addresses. Email domain matching by itself is not enough to prove mailbox ownership.

## LinkedIn boundary

The implementation searches only publicly indexed profile URLs. It does not use LinkedIn's private Voyager endpoints, authenticated page scraping, session cookies, or automated direct messages.

The current Composio LinkedIn toolkit supports profile, company, post, comment, and social-content operations, but it does not expose employee search or direct-message tools. Jobraker therefore returns the profile URL for manual review and contact. A browser-assisted, user-approved LinkedIn action can be added later behind a separate compliance review.

## Data model

### `recruiter_discovery_runs`

One row per discovery operation. It stores job/application links, exact team keywords, official company domain, query plan, status, and summary.

### `recruiter_contacts`

One row per discovered person and user. It stores:

- name, title, and role classification
- LinkedIn URL and discovery source
- work email and verification state
- source evidence and relevance score
- job/application/run links
- `safe_to_contact`

Both tables use row-level security and are scoped to the authenticated user.

## Runtime configuration

The existing Firecrawl and Gemini configuration is reused.

Optional email-verifier adapter:

```text
RECRUITER_EMAIL_VERIFIER_URL=https://your-verifier.example/verify
RECRUITER_EMAIL_VERIFIER_API_KEY=...
```

Expected verifier request:

```json
{
  "email": "candidate@company.com",
  "companyDomain": "company.com",
  "fullName": "Candidate Name"
}
```

The adapter accepts common response fields such as `valid`, `deliverable`, `status`, `score`, and `catchAll`. Only an affirmative deliverability result with `catchAll !== true` is treated as provider verified.

## Open-source verifier options reviewed

### Recommended adapter candidates

- **Truemail Rack**: MIT-licensed HTTP wrapper around Truemail with regex, DNS, and SMTP validation. Suitable as a self-hosted verifier service after infrastructure and privacy review.
- **Email Verifier by umuterturk**: MIT-licensed syntax, domain, MX, and disposable-domain checks. Useful for domain hygiene, but its own documentation notes it cannot prove that a mailbox exists.

### Licensing or operational caution

- **Reacher / check-if-email-exists**: mature and recently maintained, but distributed under AGPL with a commercial licensing option. Do not embed it in Jobraker's proprietary service without licensing review.
- **CrossLinked**: useful reference for search-engine-based public employee discovery, but Jobraker should keep its own narrow, job-specific ranking and source evidence.
- **OpenOutreach**: uses Playwright stealth and LinkedIn's internal Voyager API. It is not integrated because of account, platform-policy, privacy, and operational risks.
- **Exa MCP server**: can be an optional public people-search provider, but it is a hosted data/search dependency rather than a fully self-contained open dataset.

## Outreach guardrails

- Never send to `pattern_only`, `unverified`, or `not_found` contacts.
- Never contact multiple people at the same company automatically.
- Require explicit user approval before creating or sending an outbound message.
- Prefer one recruiter or direct hiring manager over a senior executive.
- Stop follow-ups when a reply is detected.
- Keep LinkedIn outreach manual until an approved integration supports the needed action.

## Remaining integration work

The AI Chat backend currently restricts native Gmail actions to a single allowlisted account. Before recruiter outreach can be available to every user, replace that allowlist with per-user connected-account checks and gate each outbound message on the selected contact's `safe_to_contact` value and explicit user confirmation.
