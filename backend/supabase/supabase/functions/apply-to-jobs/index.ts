// @ts-nocheck
// Apply to jobs by triggering a Skyvern workflow with a list of job URLs.
// POST body accepts:
// {
//   job_urls: string[] | string(JSON array) | { sourceUrl?: string; url?: string }[],
//   additional_information?: string,
//   resume?: string, // e.g., s3:// or https://
//   cover_letter?: string, // optional: plaintext cover letter content
//   cover_letter_template?: string, // optional: template name/variant for the cover letter
//   workflow_id?: string, // defaults to env SKYVERN_WORKFLOW_ID
//   proxy_location?: string, // optional, forwarded to Skyvern
//   webhook_url?: string // optional, forwarded to Skyvern
// }
// Returns the Skyvern run response.

import { corsHeaders } from "../_shared/types.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const SKYVERN_ENDPOINT = "https://api.skyvern.com/v1/run/workflows";

function asArray(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    // Try to parse JSON array string, otherwise treat as a single URL
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {
      // fallthrough
    }
    const trimmed = val.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try { const parsed = JSON.parse(trimmed); if (Array.isArray(parsed)) return parsed; } catch {}
    }
    if (trimmed) return [trimmed];
  }
  if (val && typeof val === "object") return [val];
  return [];
}

function extractJobUrls(input: any): string[] {
  const arr = asArray(input);
  const urls: string[] = [];
  for (const item of arr) {
    if (typeof item === "string") {
      urls.push(item);
    } else if (item && typeof item === "object") {
      const u = item.sourceUrl || item.url || item.source_url;
      if (typeof u === "string" && u) urls.push(u);
    }
  }
  // Deduplicate and keep order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) { if (!seen.has(u)) { seen.add(u); out.push(u); } }
  return out;
}

function stringifyArrayForSkyvern(urls: string[]): string {
  // Skyvern example shows job_urls as a JSON string representing an array.
  // We'll pretty-print for readability in provider logs.
  return JSON.stringify(urls, null, 2);
}

async function withRetry(fn: () => Promise<any>, attempts = 3, baseDelayMs = 500) {
  let last: any;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      if (i < attempts - 1) {
        const delay = baseDelayMs * Math.pow(2, i);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw last;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "content-type": "application/json" } });
  }

  try {
  const body = await req.json().catch(() => ({}));
    // Accept flexible inputs
    // 1) job_urls directly (string[] or JSON string)
    // 2) jobs array with objects that contain sourceUrl/url
  const jobUrlsFromJobUrls = extractJobUrls(body?.job_urls);
  const jobUrlsFromJobs = extractJobUrls(body?.jobs);
  const job_urls = (jobUrlsFromJobUrls.length ? jobUrlsFromJobUrls : jobUrlsFromJobs);

  let additional_information = typeof body?.additional_information === "string" ? body.additional_information : "";
  let resume = typeof body?.resume === "string" ? body.resume : "";
  const cover_letter = typeof body?.cover_letter === "string" ? body.cover_letter : undefined;
  const cover_letter_template = typeof body?.cover_letter_template === "string" ? body.cover_letter_template : undefined;
  const proxy_location = typeof body?.proxy_location === "string" ? body.proxy_location : undefined;
  // Allow override, else use our function URL if configured
  let webhook_url = typeof body?.webhook_url === "string" ? body.webhook_url : undefined;
  const title = typeof body?.title === "string" ? body.title : undefined;

    // Secrets: prefer environment over header to avoid client override
    const envKey = Deno.env.get("SKYVERN_API_KEY");
    const headerKey = req.headers.get("x-skyvern-api-key") || req.headers.get("x-api-key");
    const apiKey = envKey || headerKey;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "SKYVERN_API_KEY missing (env or x-skyvern-api-key header)" }), { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const workflow_id = (typeof body?.workflow_id === "string" && body.workflow_id) ? body.workflow_id : (Deno.env.get("SKYVERN_WORKFLOW_ID") || "");
    if (!workflow_id) {
      return new Response(JSON.stringify({ error: "workflow_id not provided and SKYVERN_WORKFLOW_ID env not set" }), { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    if (!job_urls.length) {
      return new Response(JSON.stringify({ error: "job_urls is required (array of URLs or jobs with sourceUrl)" }), { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } });
    }
    // Enrichment (profile/resume) if either missing
    try {
      if (!additional_information || !resume) {
        const authHeader = req.headers.get('authorization') || '';
        const token = authHeader.startsWith('Bearer ')? authHeader.slice(7) : null;
        if (token) {
          const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
          const anon = Deno.env.get('SUPABASE_ANON_KEY') || '';
          if (supabaseUrl && anon) {
            const sb = createClient(supabaseUrl, anon);
            try { (sb as any).auth.setAuth(token); } catch {}
            // Profile
            if (!additional_information) {
              const { data: prof } = await sb.from('profiles')
                .select('id,first_name,last_name,job_title,experience_years,location,goals')
                .limit(1).maybeSingle();
              const { data: authUser } = await (sb.auth as any).getUser();
              const email = (authUser as any)?.user?.email;
              if (prof) {
                const parts: string[] = [];
                const fullName = [prof.first_name, prof.last_name].filter(Boolean).join(' ').trim();
                if (fullName) parts.push(`Name: ${fullName}`);
                if (email) parts.push(`Email: ${email}`);
                if (prof.job_title) parts.push(`Current Title: ${prof.job_title}`);
                if (prof.experience_years != null) parts.push(`Experience: ${prof.experience_years} years`);
                if (prof.location) parts.push(`Location: ${prof.location}`);
                if (Array.isArray(prof.goals) && prof.goals.length) parts.push(`Goals: ${prof.goals.join(', ')}`);
                if (parts.length) additional_information = parts.join('\n');
                console.log('apply-to-jobs: enriched profile', { user_id: prof.id, job_count: job_urls.length });
              } else {
                console.log('apply-to-jobs: profile missing', { job_count: job_urls.length });
              }
            }
            // Resume
            if (!resume) {
              const { data: resumes } = await sb.from('resumes')
                .select('file_path,is_favorite,updated_at,user_id')
                .not('file_path','is',null)
                .order('is_favorite', { ascending: false })
                .order('updated_at', { ascending: false })
                .limit(1);
              const top = Array.isArray(resumes) && resumes.length ? resumes[0] : null;
              if (top?.file_path) {
                const { data: signed, error: signErr } = await (sb.storage as any)
                  .from('resumes')
                  .createSignedUrl(top.file_path, 60 * 60);
                if (!signErr && signed?.signedUrl) {
                  resume = signed.signedUrl;
                  console.log('apply-to-jobs: enriched resume', { user_id: (top as any).user_id, job_count: job_urls.length });
                } else {
                  console.log('apply-to-jobs: resume sign error', { err: signErr?.message, job_count: job_urls.length });
                }
              } else {
                console.log('apply-to-jobs: resume missing', { job_count: job_urls.length });
              }
            }
          }
        }
      }
    } catch (enrichErr) {
      try { console.log('apply-to-jobs enrichment error', (enrichErr as any)?.message); } catch {}
    }

    // Prepare Skyvern payload
    const parameters: Record<string, any> = {
      job_urls: stringifyArrayForSkyvern(job_urls),
      additional_information,
      resume,
    };
    if (cover_letter && cover_letter.trim()) parameters.cover_letter = cover_letter;
    if (cover_letter_template && cover_letter_template.trim()) parameters.cover_letter_template = cover_letter_template;
  const skyvernRun: Record<string, any> = { workflow_id, parameters };
    if (proxy_location) skyvernRun.proxy_location = proxy_location;
    if (!webhook_url) {
      try {
        const url = new URL(req.url);
        let fallback = '';
        if (url.hostname.endsWith('.functions.supabase.co')) {
          // Called via the Functions domain; webhook is sibling function
          fallback = `${url.origin}/skyvern-webhook`;
        } else {
          // Called via platform API domain; use SUPABASE_URL if provided
          const base = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
          if (base) fallback = `${base}/functions/v1/skyvern-webhook`;
        }
        if (fallback) webhook_url = fallback;
      } catch {}
    }
    if (webhook_url) skyvernRun.webhook_url = webhook_url;
    if (title) skyvernRun.title = title;

    const res = await withRetry(() => fetch(SKYVERN_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(skyvernRun),
    }), 2, 700);

    const text = await res.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Skyvern run failed", status: res.status, data }), { status: 502, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    // Return provider response and echo useful fields
    return new Response(JSON.stringify({
      ok: true,
      skyvern: data,
      submitted: { workflow_id, count: job_urls.length },
    }), { headers: { ...corsHeaders, "content-type": "application/json" }, status: 200 });
  } catch (e) {
    const msg = (e && e.message) ? String(e.message) : "Unknown error";
    try { console.error("apply-to-jobs error", msg); } catch {}
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
  }
});
