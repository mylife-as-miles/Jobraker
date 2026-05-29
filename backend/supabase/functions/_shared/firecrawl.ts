// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';

// Centralized retry logic
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 500): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        let delay = baseDelayMs * Math.pow(2, i); // Default exponential backoff

        // Check for rate limit error and respect retry-after header
        if (e.status === 429 && e.message) {
          const retryAfterMatch = e.message.match(/retry after (\d+)s/);
          if (retryAfterMatch && retryAfterMatch[1]) {
            const retryAfterSeconds = parseInt(retryAfterMatch[1], 10);
            delay = retryAfterSeconds * 1000 + 500; // Use recommended delay + a small buffer
            console.warn(`firecrawl.rate_limited`, { message: e.message, retry_delay_ms: delay });
          }
        }

        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// Centralized Firecrawl API key resolution (env-only)
async function resolveFirecrawlApiKey(): Promise<string> {
  const envKey = (Deno.env.get('FIRECRAWL_API_KEY') || '').trim();
  if (envKey) {
    console.info('firecrawl.key_source', { used: 'env' });
    return envKey;
  }
  console.error('firecrawl.key_missing');
  throw new Error('Search provider API key is not configured.');
}

// Centralized Firecrawl API call function
async function firecrawlFetch(
  path: string,
  apiKey: string,
  body: any,
  userId?: string,
  timeoutMs = 20000,
) {
  const url = `https://api.firecrawl.dev/v2${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("firecrawl_timeout"), timeoutMs);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Search provider failed: ${res.status} ${text}`) as any;
    (err as any).status = res.status;
    (err as any).body = text;
    // Attach retry-after seconds if present in header or body
    const hdr = res.headers.get('retry-after');
    if (hdr) {
      const secs = parseInt(hdr, 10);
      if (!Number.isNaN(secs)) (err as any).retryAfterSeconds = secs;
    }
    // Try parsing seconds from body message pattern "retry after 55s"
    if (!(err as any).retryAfterSeconds && text) {
      const m = text.match(/retry after\s+(\d+)s/i);
      if (m && m[1]) {
        const secs = parseInt(m[1], 10);
        if (!Number.isNaN(secs)) (err as any).retryAfterSeconds = secs;
      }
    }
    if (res.status === 401) {
      console.error(`firecrawl.unauthorized`, { user_id: userId, path });
    }
    throw err;
  }
  const json = await res.json().catch(() => null);
  if (json && typeof json.success === 'boolean' && json.success === false) {
    const code = json.error || json.message || 'request_failed';
    const err = new Error(`Search provider error: ${code}`) as any;
    err.firecrawlError = code;
    throw err;
  }
  return json;
}

async function getFirecrawlCreditUsage(apiKey: string, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("firecrawl_credit_timeout"), timeoutMs);
  const res = await fetch("https://api.firecrawl.dev/v2/team/credit-usage", {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Credit usage check failed: ${res.status} ${text}`) as any;
    err.status = res.status;
    err.body = text;
    throw err;
  }

  const json = await res.json().catch(() => null);
  const data = json?.data && typeof json.data === "object" ? json.data : {};

  return {
    remainingCredits: Number(data.remainingCredits ?? 0),
    planCredits: Number(data.planCredits ?? 0),
    billingPeriodStart: data.billingPeriodStart ?? null,
    billingPeriodEnd: data.billingPeriodEnd ?? null,
    raw: json,
  };
}

async function getFirecrawlHistoricalCreditUsage(apiKey: string, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("firecrawl_historical_credit_timeout"), timeoutMs);
  const res = await fetch("https://api.firecrawl.dev/v2/team/credit-usage/historical", {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Historical credit usage check failed: ${res.status} ${text}`) as any;
    err.status = res.status;
    err.body = text;
    throw err;
  }

  const json = await res.json().catch(() => null);
  return {
    periods: Array.isArray(json?.periods) ? json.periods : [],
    raw: json,
  };
}

export {
  withRetry,
  resolveFirecrawlApiKey,
  firecrawlFetch,
  getFirecrawlCreditUsage,
  getFirecrawlHistoricalCreditUsage,
};
