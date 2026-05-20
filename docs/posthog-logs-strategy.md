# PostHog Logs Strategy for Supabase Edge Functions

This repo should keep product analytics and operational logs separate.

## Current decision

- Use `posthog-js` plus the `track-posthog` Edge Function for product analytics.
- Do not mix OpenTelemetry log shipping into the current analytics helpers.
- Keep Edge Function runtime logs on `console.*` for now so they continue to flow through Supabase's native function logs.

## Why not implement Logs now

- Most server-side runtime code in Jobraker runs in Supabase Edge Functions on Deno, not in a long-lived Node.js process.
- PostHog Logs uses OTLP and is a better fit when we can introduce a Deno-compatible log exporter or a dedicated forwarding step.
- Shipping logs now without a clear sampling and redaction policy would increase risk around PII, prompt contents, resumes, and auth payloads.

## Recommended phased approach

### Phase 1: Standardize structured logs in Edge Functions

- Keep using `console.log`, `console.warn`, and `console.error`.
- Normalize payload shape across functions:
  - `function_name`
  - `request_id`
  - `user_id`
  - `run_id`
  - `job_id`
  - `subscription_tier`
  - `duration_ms`
  - `outcome`
- Avoid logging raw resume text, auth tokens, provider secrets, or full third-party payloads.

### Phase 2: Add a shared logging facade

Add a future helper under `backend/supabase/functions/_shared`, for example:

- `logInfo(event, context)`
- `logWarn(event, context)`
- `logError(event, context, error)`

This should:

- emit structured JSON to stdout for Supabase logs
- redact sensitive fields before logging
- preserve compatibility with later OTLP export

### Phase 3: Introduce PostHog Logs as a separate sink

When ready, add a dedicated OTLP-compatible path for Edge Function logs by choosing one of:

- a Deno-compatible OTLP HTTP exporter
- a small log-forwarding Edge Function or worker
- a platform log drain that forwards structured logs to PostHog

At that point, logs sent to PostHog should include:

- `service.name=jobraker-edge-functions`
- `deployment.environment`
- `function_name`
- `user_id` when available
- `request_id`
- `severity_text`

## Guardrails

- Product events and logs must remain separate concerns.
- `captureClientEvent` and `captureServerEvent` should not be reused for logs.
- Any future OTLP integration must redact PII by default and allow opt-in verbose logging only in controlled environments.
