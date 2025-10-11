// @ts-nocheck
// Enrich jobs after insert/update by inferring missing fields using OpenAI.
// Fills: employment_type, experience_level, tags, salary_min, salary_max, salary_currency, location, apply_link when possible.
// POST body: { job_ids?: string[], sinceMinutes?: number, limit?: number }
// - If job_ids provided, process those. Otherwise process jobs created within last sinceMinutes (default 60), up to limit (default 20).

import OpenAI from "npm:openai";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function trim(s: any): string { return (typeof s === 'string' ? s : '').trim(); }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'content-type': 'application/json' } });

  try {
    const body = await req.json().catch(() => ({}));
    const jobIds: string[] | undefined = Array.isArray(body?.job_ids) ? body.job_ids.filter(Boolean) : undefined;
    const sinceMinutes = Number.isFinite(Number(body?.sinceMinutes)) ? Math.max(1, Number(body.sinceMinutes)) : 60;
    const limit = Number.isFinite(Number(body?.limit)) ? Math.max(1, Math.min(50, Number(body.limit))) : 20;

    // Auth header for user scope (optional). We'll use service role for updates safely.
    const authHeader = req.headers.get('authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sbUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const sbAdmin = createClient(supabaseUrl, serviceKey);

    // Select candidate jobs to enrich
    let jobs: any[] = [];
    if (jobIds && jobIds.length) {
      const { data, error } = await sbUser
        .from('jobs')
        .select('*')
        .in('id', jobIds)
        .limit(limit);
      if (error) throw new Error(`Failed to fetch jobs: ${error.message}`);
      jobs = data || [];
    } else {
      const sinceIso = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString();
      const { data, error } = await sbUser
        .from('jobs')
        .select('*')
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(`Failed to fetch recent jobs: ${error.message}`);
      jobs = data || [];
    }

    // Filter to those with missing key fields
    const targets = jobs.filter(j => (
      j.salary_min == null || j.salary_max == null || j.salary_currency == null ||
      !j.employment_type || !j.experience_level || !Array.isArray(j.tags)
    ));

    if (!targets.length) {
      return new Response(JSON.stringify({ updated: 0, message: 'No jobs require enrichment' }), { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY') || '';
    if (!apiKey) return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    const openai = new OpenAI({ apiKey });

    let updated = 0;

    for (const job of targets) {
      const title = trim(job.title);
      const company = trim(job.company);
      const location = trim(job.location) || trim(job?.raw_data?.scraped_data?.location);
      const salaryRaw = trim(job?.raw_data?.scraped_data?.salary) || '';
      const apply = trim(job.apply_url) || trim(job?.raw_data?.scraped_data?.apply_link) || '';

      // Prefer full markdown/html from raw_data if saved there; else description
      const desc = trim(job.description || '')
        || trim(job?.raw_data?.markdown)
        || trim(job?.raw_data?.html)
        || trim(job?.raw_data?.scraped_data?.description || '');

      const system = 'You are an assistant that infers missing structured fields from job postings. Be conservative and avoid over-claiming.';
      const schemaHint = `Return strictly a JSON object with these fields: {
  employment_type: "Full-time"|"Part-time"|"Contract"|"Temporary"|"Internship"|"Freelance"|null,
  experience_level: "Junior"|"Mid"|"Senior"|"Lead"|"Manager"|null,
  tags: string[] | null,
  salary_min: number | null, // annual in local currency
  salary_max: number | null,
  salary_currency: "USD"|"GBP"|"EUR"|"CAD"|"AUD"|null,
  location: string | null,
  apply_link: string | null
}
Rules:
- If ranges are hourly/daily, estimate annual with reasonable assumptions (40h/week, 52 weeks) and note uncertainty by leaving fields null if too speculative.
- Use currency symbols/codes in text to pick salary_currency.
- Only include tags you are confident about from the content.
- Never include explanatory text outside JSON.`;

      const user = [
        `Title: ${title}`,
        `Company: ${company}`,
        location && `Location: ${location}`,
        salaryRaw && `Salary (raw): ${salaryRaw}`,
        apply && `Apply Link: ${apply}`,
        '',
        'Description:',
        desc || '(no description)'
      ].filter(Boolean).join('\n');

      let patch: any = {};
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: schemaHint + "\n\n" + user },
          ],
        });
        const content = completion?.choices?.[0]?.message?.content?.trim() || '';
        // Extract JSON block
        const jsonMatch = content.match(/\{[\s\S]*\}$/);
        const jsonText = jsonMatch ? jsonMatch[0] : content;
        const enriched = JSON.parse(jsonText);

        const toNumber = (n: any) => (typeof n === 'number' && isFinite(n) ? Math.round(n) : null);
        const toString = (s: any) => (typeof s === 'string' && s.trim().length ? s.trim() : null);
        const toArray = (a: any) => (Array.isArray(a) ? a.map((x) => String(x)).filter(Boolean) : null);

        if (job.employment_type == null && toString(enriched.employment_type)) patch.employment_type = toString(enriched.employment_type);
        if (job.experience_level == null && toString(enriched.experience_level)) patch.experience_level = toString(enriched.experience_level);
        if ((!Array.isArray(job.tags) || job.tags == null) && toArray(enriched.tags)) patch.tags = toArray(enriched.tags);

        if (job.salary_min == null && toNumber(enriched.salary_min) != null) patch.salary_min = toNumber(enriched.salary_min);
        if (job.salary_max == null && toNumber(enriched.salary_max) != null) patch.salary_max = toNumber(enriched.salary_max);
        if (job.salary_currency == null && toString(enriched.salary_currency)) patch.salary_currency = toString(enriched.salary_currency);

        if (job.location == null && toString(enriched.location)) patch.location = toString(enriched.location);
        if (job.apply_url == null && toString(enriched.apply_link)) patch.apply_url = toString(enriched.apply_link);
      } catch (e) {
        try { console.error('enrich-jobs.openai_error', { id: job.id, message: String(e?.message || e) }); } catch {}
      }

      if (Object.keys(patch).length) {
        patch.updated_at = new Date().toISOString();
        const { error: upErr } = await sbAdmin.from('jobs').update(patch).eq('id', job.id);
        if (!upErr) updated += 1;
      }
    }

    return new Response(JSON.stringify({ updated, processed: targets.length }), { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } });
  } catch (e) {
    const msg = (e && e.message) ? String(e.message) : 'Unknown error';
    try { console.error('enrich-jobs error', msg); } catch {}
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } });
  }
});
