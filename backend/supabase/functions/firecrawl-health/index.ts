// @ts-nocheck
// Lightweight health endpoint to validate the configured Firecrawl API key without running a full job discovery.
// It attempts a cheap scrape call against https://example.com and reports:
// - key source (header | db | env)
// - key length & fingerprint (sha256 first 12 chars) for correlation without exposing the raw key
// - whether the call was authorized, and HTTP status/body snippet
// CORS friendly: allow preflight.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/types.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

async function sha256Hex(input: string) {
  const enc = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function testFirecrawl(apiKey: string) {
  const start = performance.now();
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    const ms = Math.round(performance.now() - start);
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      ms,
      body_snippet: text.slice(0, 140),
    };
  } catch (e) {
    return { ok: false, status: 0, ms: Math.round(performance.now() - start), error: e?.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Optional auth: if Authorization provided, use it to load user-specific key from job_source_settings.
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    let dbKey: string | null = null;
    if (authHeader) {
      try {
        const supabaseAuthed = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
          { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user } } = await supabaseAuthed.auth.getUser();
        if (user) {
          userId = user.id;
          const { data: settingsRow } = await supabaseAdmin
            .from('job_source_settings')
            .select('firecrawl_api_key')
            .eq('user_id', userId)
            .maybeSingle();
          if (settingsRow?.firecrawl_api_key) dbKey = settingsRow.firecrawl_api_key.trim();
        }
      } catch (e) {
        console.warn('firecrawl-health.user_lookup_failed', { message: e?.message });
      }
    }

    const headerKey = req.headers.get('x-firecrawl-api-key')?.trim() || '';
    const envKey = (Deno.env.get('FIRECRAWL_API_KEY') || '').trim();
    const apiKey = headerKey || dbKey || envKey;

    if (!apiKey) {
      return new Response(JSON.stringify({
        error: 'firecrawl_key_missing',
        detail: 'No API key found in header, user settings, or environment.',
        key_sources: { header: !!headerKey, db: !!dbKey, env: !!envKey }
      }), { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    const fingerprint = (await sha256Hex(apiKey)).slice(0, 12);
    const test = await testFirecrawl(apiKey);

    let classification = 'unknown';
    if (test.status === 401) classification = 'unauthorized_invalid_key';
    else if (test.status === 403) classification = 'forbidden_or_exhausted';
    else if (test.status === 429) classification = 'rate_limited';
    else if (test.ok) classification = 'authorized';

    return new Response(JSON.stringify({
      success: true,
      classification,
      key: {
        source: headerKey ? 'header' : dbKey ? 'db' : 'env',
        length: apiKey.length,
        fingerprint,
        header_present: !!headerKey,
        db_present: !!dbKey,
        env_present: !!envKey,
        user_id: userId,
      },
      firecrawl_test: test,
    }), { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } });

  } catch (e) {
    console.error('firecrawl-health.error', e?.message);
    return new Response(JSON.stringify({ error: e?.message || 'Unexpected error' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } });
  }
});
