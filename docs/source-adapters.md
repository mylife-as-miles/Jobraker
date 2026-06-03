# Jobraker Source Adapter Contract

Every job source should normalize listings into one small contract before the job can enter discovery, quality scoring, feedback learning, or persistence.

## Normalized Job Shape

Required fields:

- `title`: Human-readable role title.
- `company`: Hiring company name.
- `url`: Canonical apply or job detail URL.
- `description`: Job description text. Empty string is allowed, but the quality gate will penalize thin listings.
- `source_id`: Stable source identifier. Use the canonical URL when the platform has no durable ID.
- `source_type`: `adapter` for first-party source adapters, `web_search` for broad search results.
- `source_kind`: `greenhouse`, `lever`, `ashby`, `workable`, `direct`, or `firecrawl`.
- `source_confidence`: Number from `0` to `0.99` representing trust in the source normalization.
- `verification_status`: `verified`, `stale`, `failed`, or `unverified`.
- `is_tracked_company`: Whether this came from a user-tracked company/source.
- `raw_data`: Source-specific metadata for debugging and auditability.

Optional fields:

- `location`
- `posted_at`

## Adapter Rules

- Normalize before saving. Do not write source-native payloads directly into `jobs`.
- Prefer canonical ATS/company URLs over aggregator redirect URLs.
- Use stable IDs where possible: ATS job ID, company slug plus job ID, or canonical URL.
- Keep `raw_data` useful but bounded. Store source IDs, provider payload snippets, extraction warnings, and source URL history.
- Do not silently invent companies, titles, or dates. Missing context should flow into the quality gate as a penalty.
- Return user-facing warnings separately from debug metadata.

## Validation Helper

Use the shared helper for new Edge Function adapters:

```ts
import {
  normalizeSourceAdapterJob,
  type JobSourceAdapter,
} from "../_shared/source-adapter-contract.ts";
```

`normalizeSourceAdapterJob()` throws on missing title, missing company, or invalid URL. That is intentional: bad source output should be rejected before it contaminates the pipeline.

## Why This Exists

Jobraker now has a stricter path:

1. Source adapter returns normalized jobs.
2. Quality gate scores freshness, description depth, company presence, URL validity, spam signals, source confidence, and seniority fit.
3. Feedback-learning ranker adjusts the score based on prior user labels.
4. Jobs are saved with `lead_quality_score`, `lead_quality_reason`, and `lead_quality_tags`.

This keeps LinkedIn, Indeed, ATS, company career pages, and future data sources interchangeable without weakening the rest of the product.
