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
    let type = (url.searchParams.get("type") || "").trim();
    if (req.method !== "GET") {
      try {
        const body = await req.json();
        q = (body?.q ?? q ?? "").trim();
        location = (body?.location ?? location ?? "").trim();
        type = (body?.type ?? type ?? "").trim();
      } catch (_) {
        // ignore missing/invalid JSON
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let query = supabase
      .from("job_listings")
      .select("job_title, company_name, location, work_type, full_job_description, source_url, source, posted_at, salary_min, salary_max")
      .order("posted_at", { ascending: false })
      .limit(100);

    if (q) {
      query = query.ilike("job_title", `%${q}%`);
    }
    if (location) {
      query = query.ilike("location", `%${location}%`);
    }
    if (type) {
      query = query.eq("work_type", type);
    }

    const { data, error } = await query;
    if (error) throw error;

    return new Response(JSON.stringify({ jobs: data }), { headers: { ...corsHeaders, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
  }
});
