# jobs-cron-scheduled

Dedicated internal scheduler for Jobraker background job discovery.

## Authentication

This function is intentionally deployed with Supabase gateway JWT verification disabled because `pg_cron` is not a signed-in user. It is **not public in practice**: every POST must include `x-jobraker-scheduler-token`, and the handler verifies that value against the random `jobs_cron_scheduler_token` stored in Supabase Vault by migration `20260814175500_fix_job_search_auto_apply_reliability.sql`.

The token is generated inside Postgres and is never committed to source control.

## Deployment

Use the repository command so `--no-verify-jwt` is not missed:

```bash
npm run supabase:deploy:jobs-cron-scheduled
```

After the migration is applied, the database cron invokes this function every six hours at minute 5.
