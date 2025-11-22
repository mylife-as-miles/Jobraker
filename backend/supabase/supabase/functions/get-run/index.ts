// @ts-nocheck
// Fetch a Skyvern run by id and return normalized data.
// Method: GET /?run_id=WR_OR_TSK_ID or path /:run_id (Supabase functions only get querystring, so we'll use query param)
// Query params:
//   run_id (required) - Skyvern workflow_run id (e.g., wr_...) or task run id
//   raw=1 (optional) - include full raw response
// Auth: Requires SKYVERN_API_KEY env or x-skyvern-api-key / x-api-key header override (env preferred).
// CORS: Allow GET & OPTIONS.
// Response: { ok: boolean, run: {...subset}, raw?: any, error?: string }

import { getCorsHeaders } from "../_shared/types.ts";

const SKYVERN_BASE = 'https://api.skyvern.com/v1/runs';

function pick<T extends Record<string, any>>(obj: T | null | undefined, keys: string[]): Record<string, any> {
  const out: Record<string, any> = {};
  if (!obj) return out;
  for (const k of keys) {
    if (k in obj) out[k] = obj[k];
  }
  return out;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
  }
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'content-type': 'application/json' } });
  }

  try {
    const url = new URL(req.url);
    const run_id = url.searchParams.get('run_id') || '';
    const includeRaw = url.searchParams.get('raw') === '1';
    if (!run_id) {
      return new Response(JSON.stringify({ error: 'run_id required' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    const envKey = Deno.env.get('SKYVERN_API_KEY');
    const headerKey = req.headers.get('x-skyvern-api-key') || req.headers.get('x-api-key');
    const apiKey = envKey || headerKey;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'SKYVERN_API_KEY missing (env or x-skyvern-api-key header)' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    const skyvernRes = await fetch(`${SKYVERN_BASE}/${encodeURIComponent(run_id)}`, {
      method: 'GET',
      headers: { 'x-api-key': apiKey },
    });
    const text = await skyvernRes.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!skyvernRes.ok) {
      return new Response(JSON.stringify({ error: 'Skyvern fetch failed', status: skyvernRes.status, data }), { status: 502, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    const subset = pick(data, [
      'run_id','status','failure_reason','recording_url','screenshot_urls','downloaded_files','created_at','started_at','finished_at','modified_at','run_type','app_url'
    ]);
    // Flatten some nested helpful outputs if present
    if (data?.output?.parsed_resume_output?.output) {
      subset.parsed_resume_output = data.output.parsed_resume_output.output;
    }
    if (Array.isArray(data?.output?.extracted_information)) {
      subset.extracted_information = data.output.extracted_information;
    }
    if (data?.run_request?.parameters) {
      subset.request_parameters = data.run_request.parameters;
    }
    if (data?.run_request?.workflow_id) {
      subset.workflow_id = data.run_request.workflow_id;
    }

    return new Response(JSON.stringify({ ok: true, run: subset, raw: includeRaw ? data : undefined }), { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } });
  } catch (e) {
    const msg = (e as any)?.message || 'Unknown error';
    try { console.error('get-run error', msg); } catch {}
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } });
  }
});
