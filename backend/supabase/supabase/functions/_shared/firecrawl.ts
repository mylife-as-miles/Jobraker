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
        const delay = baseDelayMs * Math.pow(2, i);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// Centralized Firecrawl API key resolution
async function resolveFirecrawlApiKey(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId?: string,
  headerKey?: string
): Promise<string> {
  const trimmedHeaderKey = headerKey?.trim() || '';
  if (trimmedHeaderKey) {
    console.info('firecrawl.key_source', { user_id: userId, used: 'header' });
    return trimmedHeaderKey;
  }

  if (userId) {
    try {
      const { data: settingsRow } = await supabaseAdmin
        .from('job_source_settings')
        .select('firecrawl_api_key')
        .eq('user_id', userId)
        .maybeSingle();
      if (settingsRow?.firecrawl_api_key) {
        console.info('firecrawl.key_source', { user_id: userId, used: 'db' });
        return settingsRow.firecrawl_api_key;
      }
    } catch (e) {
      console.warn('firecrawl.key_lookup_failed', { user_id: userId, message: (e as any)?.message });
    }
  }

  const envKey = Deno.env.get('FIRECRAWL_API_KEY') || '';
  if (envKey) {
    console.info('firecrawl.key_source', { user_id: userId, used: 'env' });
    return envKey;
  }

  console.error('firecrawl.key_missing', { user_id: userId });
  throw new Error('No Firecrawl API key configured (header, user settings, or environment).');
}

// Centralized Firecrawl API call function
async function firecrawlFetch(path: string, apiKey: string, body: any, userId?: string) {
  const url = `https://api.firecrawl.dev/v2${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Firecrawl ${path} failed: ${res.status} ${text}`);
    (err as any).status = res.status;
    (err as any).body = text;
    if (res.status === 401) {
      console.error(`firecrawl.unauthorized`, { user_id: userId, path });
    }
    throw err;
  }
  return res.json();
}

export { withRetry, resolveFirecrawlApiKey, firecrawlFetch };