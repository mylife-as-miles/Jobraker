// Compatibility module for the former Firecrawl call sites.
// All traffic now goes to RTRVR. Keep this filename temporarily so older Edge
// Functions continue to import one shared provider boundary while they are
// migrated to rtrvr.ts in a later cleanup.
import { createClient } from 'npm:@supabase/supabase-js@2';

const RTRVR_API_BASE = 'https://api.rtrvr.ai';

export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 500): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) break;
      const retryAfterSeconds = Number((error as { retryAfterSeconds?: unknown })?.retryAfterSeconds);
      const delay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000 + 500
        : baseDelayMs * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export async function resolveRtrvrApiKey(): Promise<string> {
  const apiKey = (Deno.env.get('RTRVR_API_KEY') || '').trim();
  if (apiKey) return apiKey;
  console.error('rtrvr.key_missing');
  throw new Error('RTRVR_API_KEY is not configured.');
}

// Deprecated export name retained only while legacy Edge Function imports are
// migrated. It reads RTRVR_API_KEY and never reads FIRECRAWL_API_KEY.
export const resolveFirecrawlApiKey = resolveRtrvrApiKey;

function getAdminSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function unwrapOutput(payload: unknown): Record<string, unknown> {
  const root = asRecord(payload);
  const candidates = [
    root,
    root.json,
    asRecord(root.result).json,
    asRecord(root.data).json,
    asRecord(root.output).json,
    asRecord(root.response).json,
    root.output,
    root.result,
    root.data,
    root.response,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const rec = candidate as Record<string, unknown>;
      if (Array.isArray(rec.web) || Array.isArray(rec.links) || Array.isArray(rec.items) || Array.isArray(rec.results)) {
        return rec;
      }
    }
    if (typeof candidate === 'string') {
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const rec = parsed as Record<string, unknown>;
          if (Array.isArray(rec.web) || Array.isArray(rec.links) || Array.isArray(rec.items) || Array.isArray(rec.results)) {
            return rec;
          }
          return rec;
        }
      } catch {
        // Not JSON; continue
      }
    }
  }
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return candidate as Record<string, unknown>;
    }
  }
  return root;
}

function responseText(payload: unknown): string {
  const root = asRecord(payload);
  const candidates = [
    root.text,
    root.markdown,
    asRecord(root.output).text,
    asRecord(root.output).markdown,
    asRecord(root.result).text,
    asRecord(root.data).text,
  ];
  return candidates.find((value): value is string => typeof value === 'string') || '';
}

function usageUnits(payload: unknown): number {
  const root = asRecord(payload);
  const usage = asRecord(root.usage);
  const candidates = [
    usage.creditsUsed,
    usage.credits_used,
    root.creditsUsed,
    root.credits_used,
    asRecord(root.metadata).creditsUsed,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
  }
  return 1;
}

async function requestRtrvr(
  endpoint: '/agent' | '/scrape',
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('rtrvr_timeout'), timeoutMs);
  try {
    const response = await fetch(`${RTRVR_API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let payload: unknown = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text }; }
    if (!response.ok) {
      const error = new Error(`RTRVR ${endpoint} failed: ${response.status} ${text}`) as Error & {
        status?: number; retryAfterSeconds?: number;
      };
      error.status = response.status;
      const retryAfter = Number(response.headers.get('retry-after'));
      if (Number.isFinite(retryAfter) && retryAfter > 0) error.retryAfterSeconds = retryAfter;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function searchSchema() {
  return {
    type: 'object',
    properties: {
      web: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' }, url: { type: 'string' },
            description: { type: 'string' }, markdown: { type: 'string' },
            publishedDate: { type: 'string' },
          },
          required: ['title', 'url'],
        },
      },
    },
    required: ['web'],
  };
}

function mapSchema() {
  return {
    type: 'object',
    properties: { links: { type: 'array', items: { type: 'object', properties: {
      url: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' },
    }, required: ['url'] } } },
    required: ['links'],
  };
}

function jsonSchemaFromScrapeBody(body: Record<string, unknown>): Record<string, unknown> | undefined {
  for (const format of asArray(body.formats)) {
    const formatRecord = asRecord(format);
    if (formatRecord.type === 'json' && asRecord(formatRecord.schema).type) {
      return asRecord(formatRecord.schema);
    }
  }
  return undefined;
}

async function rtrvrFetch(
  path: string,
  apiKey: string,
  body: Record<string, unknown>,
  userId?: string,
  timeoutMs = 30_000,
): Promise<unknown> {
  const operationClass = path.includes('scrape') ? 'scrape' : 'run';
  const execute = async () => {
    let result: unknown;
    if (path.includes('/search')) {
      result = await requestRtrvr('/agent', apiKey, {
        input: `Search the public web for this query: ${String(body.query || '')}. Return only real, reachable results.`,
        schema: searchSchema(),
        response: { verbosity: 'final', inlineOutputMaxBytes: 1_000_000 },
      }, timeoutMs);
      const unwrapped = unwrapOutput(result);
      const web = asArray(unwrapped.web || unwrapped.items || unwrapped.results || (result as any)?.web || (result as any)?.items);
      return { result: { success: true, data: { web } }, confirmedUnits: usageUnits(result) };
    }

    if (path.includes('/map')) {
      const url = String(body.url || '');
      result = await requestRtrvr('/agent', apiKey, {
        input: `Inspect ${url} and return links that lead to individual job postings or application pages. Exclude navigation, privacy, and login links.`,
        urls: url ? [url] : [], schema: mapSchema(), response: { verbosity: 'final' },
      }, timeoutMs);
      const unwrapped = unwrapOutput(result);
      const links = asArray(unwrapped.links || unwrapped.items || (result as any)?.links);
      return { result: { success: true, links }, confirmedUnits: usageUnits(result) };
    }

    if (path.includes('/scrape') || path.includes('/extract')) {
      const urls = path.includes('/extract')
        ? asArray(body.urls).filter((value): value is string => typeof value === 'string')
        : [String(body.url || '')].filter(Boolean);
      const schema = path.includes('/extract') ? asRecord(body.schema) : jsonSchemaFromScrapeBody(body);
      const prompt = String(body.prompt || (path.includes('/extract')
        ? 'Extract the requested structured data from the supplied job-listing URLs. Never invent facts.'
        : 'Extract the structured job-posting data from this page. Never invent facts.'));
      result = await requestRtrvr('/agent', apiKey, {
        input: prompt, urls, ...(schema && Object.keys(schema).length ? { schema } : {}),
        response: { verbosity: 'final', inlineOutputMaxBytes: 1_000_000 },
      }, timeoutMs);
      const output = unwrapOutput(result);
      return { result: { success: true, id: asRecord(result).trajectoryId || asRecord(result).id || crypto.randomUUID(), data: { json: output, markdown: responseText(result) }, metadata: { creditsUsed: usageUnits(result) } }, confirmedUnits: usageUnits(result) };
    }

    throw new Error(`Unsupported RTRVR compatibility operation: ${path}`);
  };

  if (!userId) return (await execute()).result;
  const { runMeteredRtrvrCall } = await import('./metered-provider-credits.ts');
  return runMeteredRtrvrCall({
    serviceClient: getAdminSupabaseClient(), userId, operationClass,
    featureKey: 'job_discovery', payload: body, execute,
  });
}

// Deprecated alias: all requests are served by RTRVR, not Firecrawl.
const firecrawlFetch = rtrvrFetch;

export { rtrvrFetch, firecrawlFetch };
