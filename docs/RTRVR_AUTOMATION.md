# rtrvr Automation Provider

JobRaker uses RTRVR for job discovery and governed auto-apply. It is the single external web provider for these workflows.

## Runtime

The official `@rtrvr-ai/sdk` is Node 18+ and ESM. Run the worker in a trusted Node 20 environment:

```bash
npm run automation:worker:build
npm run automation:worker
npm run automation:worker:http
```

The queue worker polls Supabase for rtrvr-queued applications. The HTTP worker exposes:

- `POST /tools/rtrvr` for AI Chat tool calls from the `rtrvr-tools` Edge Function.
- `POST /webhooks/rtrvr` for rtrvr webhook callbacks.

## Server Secrets

Set these only in Supabase Edge Function secrets, the Node worker environment, or the deployment secret manager:

```bash
RTRVR_API_KEY=
RTRVR_ENABLED=true
RTRVR_DEFAULT_TARGET=auto
RTRVR_PREFER_EXTENSION=false
RTRVR_TIMEOUT_MS=300000
RTRVR_WEBHOOK_SECRET=
RTRVR_WEBHOOK_URL=https://automation-worker.yourdomain.com/webhooks/rtrvr
RTRVR_GREENHOUSE_RECORDING_CONTEXT=
RTRVR_LEVER_RECORDING_CONTEXT=
RTRVR_ASHBY_RECORDING_CONTEXT=
RTRVR_WORKDAY_RECORDING_CONTEXT=
RTRVR_ICIMS_RECORDING_CONTEXT=
RTRVR_DEFAULT_APPLICATION_RECORDING_CONTEXT=
AUTOMATION_WORKER_URL=https://automation-worker.yourdomain.com
AUTOMATION_WORKER_PUBLIC_URL=https://automation-worker.yourdomain.com
AUTOMATION_WORKER_SECRET=
AUTOMATION_WORKER_HMAC_MAX_AGE_SECONDS=300
AUTOMATION_WORKER_LEASE_SECONDS=900
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Do not add rtrvr secrets to `VITE_` variables.

## Provider Routing

Auto Apply queues one durable application run with `automation_provider = 'rtrvr'`. The Supabase queue hands RTRVR rows to the Node worker. The worker atomically claims rows with `FOR UPDATE SKIP LOCKED`, writes `automation_claimed_by`, `automation_lease_token`, `automation_lease_expires_at`, `automation_heartbeat_at`, and `automation_attempt_number`, renews the lease while a run is active, and releases the lease when a result is written.

`automation_lease_token` is a per-claim fencing value. Heartbeats, completion, failure, and fallback writes include both the worker id and this token, so a stale worker cannot update an application after another worker has reclaimed the row.

CAPTCHA, TOTP, login/security verification, legal-question gaps, local-device offline, and uncertain submission states stop as user handoff. A failed or uncertain RTRVR execution is never re-run through a second provider, preventing duplicate applications.

When a run is paused with `provider_status = 'waiting_for_user'`, call `resume_waiting_rtrvr_auto_apply_job(application_id)` after the user resolves the challenge. The RPC verifies the authenticated user owns the application, requires the same durable idempotency key, rejects active leases or submitted results, requeues the same application row as `waiting_worker`, clears stale lease fields, and lets the worker claim the next attempt without creating a duplicate application.

Internal Edge Function to worker calls use timestamped HMAC authentication over `timestamp.nonce.sha256(body)`. The worker computes the body hash from the exact raw request body, checks a bounded timestamp window, and atomically claims the nonce in `automation_worker_nonces` before processing. Replayed nonces are rejected across worker instances, and old nonce rows expire through the claim RPC cleanup. rtrvr webhooks continue to use the bearer authentication that rtrvr documents; JobRaker stores webhook events idempotently by event id or payload hash.

## External Setup

In the rtrvr dashboard or extension setup:

- Create an API key and store it as `RTRVR_API_KEY`.
- Configure the Chrome extension for users who choose My Chrome.
- Point rtrvr webhooks to `RTRVR_WEBHOOK_URL` using bearer auth with `RTRVR_WEBHOOK_SECRET`.
- Optional rtrvr recording context strings can be stored as `RTRVR_GREENHOUSE_RECORDING_CONTEXT`, `RTRVR_LEVER_RECORDING_CONTEXT`, `RTRVR_ASHBY_RECORDING_CONTEXT`, `RTRVR_WORKDAY_RECORDING_CONTEXT`, `RTRVR_ICIMS_RECORDING_CONTEXT`, and `RTRVR_DEFAULT_APPLICATION_RECORDING_CONTEXT`.

## Current SDK Limitation

`@rtrvr-ai/sdk` is pinned to exactly `0.2.1` because npm marks that version deprecated and the public package has no stronger compatibility signal. The worker performs a startup contract check for `client.run`, `client.scrape.route`, `client.devices.list`, `client.profile.capabilities`, `client.tools.extract`, and `client.tools.act`.

The SDK and docs expose `recordingContext` / recording context as request context. They do not document a public `client.workflows.run(...)` or `client.recordings.replay(...)` API. JobRaker therefore does not treat configured ATS values as executable workflow IDs. Recording context may be passed as grounding context only; the generic rtrvr agent path remains the source of execution until rtrvr confirms a dedicated recording/subroutine execution API.

## Migration Verification

Run migrations from an empty disposable local database before enabling production traffic:

```bash
npm run supabase:reset
```

The rtrvr migration intentionally fails if the `supabase_realtime` publication is missing. Duplicate publication membership is ignored because it only means the table was already added.
