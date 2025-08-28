# Configure Job Sources for JobRaker

This guide shows how to configure and schedule job ingestion sources for the `jobs-cron` Supabase Edge Function.

## Prerequisites
- A Supabase project with Edge Functions deployed (jobs-cron, get-jobs, process-and-match)
- Project access to set environment variables

## 1) Set the schedule (optional)
Use a cron expression to run the cron function automatically.

- Key: `JOBS_CRON_EXPR`
- Example (every 6 hours):
  - `0 */6 * * *`

Add this under Supabase → Project Settings → Functions → Environment Variables.

## 2) Define job sources
Configure sources via a JSON array stored in `JOB_SOURCES`. Supported source types:

- `remotive` (remote jobs; supports `query`)
- `remoteok` (remote jobs)
- `arbeitnow` (jobs board; supports `query`)
- `json` (custom JSON feed; requires `url`)

Example:
```json
[
  { "type": "remotive", "query": "software engineer" },
  { "type": "remoteok" },
  { "type": "arbeitnow", "query": "typescript" },
  { "type": "json", "url": "https://your.cdn.example/jobs.json" }
]
```

Add this under Supabase → Project Settings → Functions → Environment Variables.

## 3) Custom JSON feed format
When using `{"type":"json","url":"..."}`, each item in your feed can include:

- `id` or `external_id` (string)
- `title` (string)
- `company` (string)
- `location` (string)
- `url` (string)
- `source` (string, optional; e.g., "myboard")
- `posted_at` (ISO timestamp string)
- `description` (string)
- `tags` (string array)
- `salary_min` (number)
- `salary_max` (number)
- `work_type` (string; e.g., `Remote`, `On-site`, `Hybrid`)

Notes:
- The cron function de-duplicates rows using `source_url` (derived from `url`).
- `work_type` defaults to `Remote` for Remotive/RemoteOK if not present.

## 4) What gets stored
The `jobs-cron` function upserts to `public.job_listings` with fields:
- `job_title`, `company_name`, `location`, `work_type`, `full_job_description`
- `source_url` (unique), `source`, `external_id`, `posted_at`, `tags`
- `salary_min`, `salary_max`, `updated_at`

## 5) Verify ingestion
- Trigger a run by calling the function endpoint (or wait for the schedule):
  - `jobs-cron` → should respond with JSON including `fetched`, `unique`, and `upserted` counts.
- Check `public.job_listings` in Supabase Studio to see new rows.
- Call `get-jobs` to retrieve recent jobs, optionally filtered by `q`, `location`, and `type`.

## 6) Troubleshooting
- If a source returns zero jobs:
  - Verify your `JOB_SOURCES` JSON is valid.
  - Confirm the source endpoint is reachable and not rate-limited.
- If rows aren’t appearing in `job_listings`:
  - Check Edge Function logs for errors.
  - Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are available to functions.
- For custom JSON feeds:
  - Confirm your feed items include at least `title`, `company`, and `url`.

## 7) UI behavior
- The Job Search page first tries live scraping via `process-and-match`.
- If no results, it falls back to `get-jobs` (DB), and shows a small `Source` badge derived from the stored `source`.

---

Need help? Open an issue or ping us on Discord.

---

Related secrets

If you use the `process-and-match` function (live scraping/extraction), you can either:

1) Forward your Vercel env var as a header to Supabase (recommended):

- In Vercel, set `FIRECRAWL_API_KEY` as an Environment Variable.
- When calling the function from your server code, add the header `x-firecrawl-api-key: <process.env.FIRECRAWL_API_KEY>`.

2) Or set it directly in Supabase as a secret:

- `FIRECRAWL_API_KEY` — your Firecrawl API key.

You can set it via CLI:

```
supabase secrets set FIRECRAWL_API_KEY="<your-firecrawl-api-key>" --project-ref <your-project-ref>
```
