// @ts-nocheck
// Lightweight health endpoint to validate the configured Firecrawl API key without running a full job discovery.
// It attempts a cheap scrape call against https://example.com and reports:
// - key source (header | db | env)
// - key length & fingerprint (sha256 first 12 chars) for correlation without exposing the raw key
// - whether the call was authorized, and HTTP status/body snippet
// CORS friendly: allow preflight.

import { corsHeaders } from '../_shared/types.ts';

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
    const envKey = (Deno.env.get('FIRECRAWL_API_KEY') || '').trim();
    if (!envKey) {
      return new Response(JSON.stringify({
        error: 'firecrawl_key_missing',
        detail: 'No API key configured in function secrets.',
      }), { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    const fingerprint = (await sha256Hex(envKey)).slice(0, 12);
    const test = await testFirecrawl(envKey);

    let classification = 'unknown';
    if (test.status === 401) classification = 'unauthorized_invalid_key';
    else if (test.status === 403) classification = 'forbidden_or_exhausted';
    else if (test.status === 429) classification = 'rate_limited';
    else if (test.ok) classification = 'authorized';

    return new Response(JSON.stringify({
      success: true,
      classification,
      key: {
        source: 'env',
        length: envKey.length,
        fingerprint,
      },
      firecrawl_test: test,
    }), { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } });

  } catch (e) {
    console.error('firecrawl-health.error', e?.message);
    return new Response(JSON.stringify({ error: e?.message || 'Unexpected error' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } });
  }
});
