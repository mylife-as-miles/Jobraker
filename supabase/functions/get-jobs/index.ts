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
      .select("job_title, company_name, location, work_type, full_job_description, source_url, source, posted_at, salary_min, salary_max")
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

    const { data, error } = await query;
    if (error) throw error;

    return new Response(JSON.stringify({ jobs: data }), { headers: { ...corsHeaders, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
  }
});
