// @ts-nocheck
// Return latest job_listings for the app, optionally filtered by query/location/type
// GET /?q=software&location=Remote&type=Remote
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/types.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const url = new URL(req.url);
  let q = (url.searchParams.get("q") || "").trim();
  let location = (url.searchParams.get("location") || "").trim();
    // support multiple types via comma or repeated params
    const typeParams = url.searchParams.getAll("type");
    let types: string[] = [];
    if (typeParams.length) {
      for (const t of typeParams) {
        for (const part of t.split(",")) {
          const v = part.trim();
          if (v) types.push(v);
        }
      }
    }
    // Parse requirements/benefits filters (repeatable or comma-separated)
    const collectMulti = (name: string) => {
      const out: string[] = [];
      const vals = url.searchParams.getAll(name);
      for (const v of vals) {
        for (const p of v.split(',')) {
          const s = p.trim();
          if (s) out.push(s);
        }
      }
      return Array.from(new Set(out));
    };
    let reqKeywords: string[] = collectMulti('req');
    let benKeywords: string[] = collectMulti('benefit');
    // Parse salary and posted-since filters
    const num = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    let minSalary: number | undefined = num(url.searchParams.get('minSalary') || url.searchParams.get('min_salary'));
    let maxSalary: number | undefined = num(url.searchParams.get('maxSalary') || url.searchParams.get('max_salary'));
    let postedSinceDays: number | undefined = num(url.searchParams.get('posted') || url.searchParams.get('postedSince') || url.searchParams.get('posted_since_days'));

    if (req.method !== "GET") {
      try {
        const body = await req.json();
        q = (body?.q ?? q ?? "").trim();
        location = (body?.location ?? location ?? "").trim();
  if (Array.isArray(body?.type)) {
          types = body.type.map((s: string) => String(s).trim()).filter(Boolean);
        } else if (typeof body?.type === 'string') {
          for (const part of String(body.type).split(',')) {
            const v = part.trim();
            if (v) types.push(v);
          }
        }
  if (body?.minSalary != null) minSalary = num(body.minSalary);
  if (body?.maxSalary != null) maxSalary = num(body.maxSalary);
  if (body?.posted != null) postedSinceDays = num(body.posted);
  if (body?.postedSince != null) postedSinceDays = num(body.postedSince);
  if (body?.posted_since_days != null) postedSinceDays = num(body.posted_since_days);
        if (Array.isArray(body?.requirements)) {
          reqKeywords = Array.from(new Set(body.requirements.map((s: string) => String(s).trim()).filter(Boolean)));
        } else if (typeof body?.requirements === 'string') {
          reqKeywords = Array.from(new Set(String(body.requirements).split(',').map((s) => s.trim()).filter(Boolean)));
        }
        if (Array.isArray(body?.benefits)) {
          benKeywords = Array.from(new Set(body.benefits.map((s: string) => String(s).trim()).filter(Boolean)));
        } else if (typeof body?.benefits === 'string') {
          benKeywords = Array.from(new Set(String(body.benefits).split(',').map((s) => s.trim()).filter(Boolean)));
        }
      } catch (_) {
        // ignore missing/invalid JSON
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://yquhsllwrwfvrwolqywh.supabase.co";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
    const supabase = createClient(
      supabaseUrl,
      serviceKey!
    );

  let query = supabase
      .from("job_listings")
  .select("job_title, company_name, location, work_type, full_job_description, source_url, source, posted_at, salary_min, salary_max, salary_period, salary_currency, requirements, benefits")
      .order("posted_at", { ascending: false })
      .limit(100);

    // Normalize types
    const normalizeType = (s: string) => {
      const v = s.toLowerCase();
      if (v === 'remote') return 'Remote';
      if (v === 'hybrid') return 'Hybrid';
      if (v === 'on-site' || v === 'onsite' || v === 'on_site' || v === 'on site') return 'On-site';
      return s;
    };
    const typesNorm = Array.from(new Set(types.map(normalizeType)));

    if (q) {
      // Match Job Title OR Full Description
      query = query.or(`job_title.ilike.%${q}%,full_job_description.ilike.%${q}%`);
    }
    if (location) {
      const locLower = location.toLowerCase();
      if (locLower === 'remote' || locLower === 'hybrid' || locLower === 'on-site' || locLower === 'onsite') {
        const m = normalizeType(location);
        // location says a work type; match either work_type or location text
        query = query.or(`work_type.eq.${m},location.ilike.%${location}%`);
      } else {
        query = query.ilike("location", `%${location}%`);
      }
    }
    if (typesNorm.length === 1) {
      query = query.eq("work_type", typesNorm[0]);
    } else if (typesNorm.length > 1) {
      // supabase-js in() support
      (query as any) = (query as any).in("work_type", typesNorm);
    }

    // Exact contains on arrays (server-side)
    if (reqKeywords.length) {
      (query as any) = (query as any).contains('requirements', reqKeywords);
    }
    if (benKeywords.length) {
      (query as any) = (query as any).contains('benefits', benKeywords);
    }

    // Salary filters: accept overlap logic when both provided
    if (typeof minSalary === 'number' && typeof maxSalary === 'number') {
      query = query.lte('salary_min', maxSalary).gte('salary_max', minSalary);
    } else if (typeof minSalary === 'number') {
      // salary_min >= min OR salary_max >= min
      (query as any) = (query as any).or(`salary_min.gte.${minSalary},salary_max.gte.${minSalary}`);
    } else if (typeof maxSalary === 'number') {
      // salary_min <= max OR salary_max <= max
      (query as any) = (query as any).or(`salary_min.lte.${maxSalary},salary_max.lte.${maxSalary}`);
    }

    // Posted time filter: within last N days
    if (typeof postedSinceDays === 'number' && postedSinceDays > 0) {
      const since = new Date(Date.now() - postedSinceDays * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('posted_at', since);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Facet counts from returned rows
    const reqCounts: Record<string, number> = {};
    const benCounts: Record<string, number> = {};
    for (const row of (data || [])) {
      if (Array.isArray(row.requirements)) {
        for (const r of row.requirements) {
          const key = String(r).trim();
          if (!key) continue;
          reqCounts[key] = (reqCounts[key] ?? 0) + 1;
        }
      }
      if (Array.isArray(row.benefits)) {
        for (const b of row.benefits) {
          const key = String(b).trim();
          if (!key) continue;
          benCounts[key] = (benCounts[key] ?? 0) + 1;
        }
      }
    }
    const toSortedList = (m: Record<string, number>) => Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([value, count]) => ({ value, count }));

    return new Response(JSON.stringify({ jobs: data, facets: { requirements: toSortedList(reqCounts), benefits: toSortedList(benCounts) } }), { headers: { ...corsHeaders, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
  }
});
