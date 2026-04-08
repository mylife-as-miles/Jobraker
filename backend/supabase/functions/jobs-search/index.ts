// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/types.ts";
import { discoverJobsHybrid } from "../_shared/discovery-hybrid.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing token" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const searchQuery = (body?.searchQuery || body?.query || "").trim();
    const location = (body?.location || "Remote").trim();
    const limit = Number.isFinite(Number(body?.limit))
      ? Math.max(1, Math.min(30, Number(body.limit)))
      : 10;

    if (!searchQuery) {
      return new Response(JSON.stringify({ error: "searchQuery is required" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const supabaseAuthed = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAuthed.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    console.log(
      `[jobs-search] Hybrid discovery for user ${user.id}: ${searchQuery} in ${location}`,
    );

    const discoveredJobs = await discoverJobsHybrid({
      serviceClient: supabaseAdmin,
      userId: user.id,
      searchQuery,
      location,
      limit,
    });

    if (discoveredJobs.length > 0) {
      const nowIso = new Date().toISOString();
      const rows = discoveredJobs.map((job) => ({
        user_id: user.id,
        source_type: job.source_type,
        source_id: job.source_id,
        title: job.title,
        company: job.company,
        location: job.location,
        apply_url: job.url,
        status: "active",
        canonical_status: "discovered",
        verification_status: job.verification_status,
        source_kind: job.source_kind,
        source_confidence: job.source_confidence,
        is_tracked_company: job.is_tracked_company,
        discovered_at: nowIso,
        last_verified_at: nowIso,
        description: job.description,
        raw_data: {
          ...(job.raw_data || {}),
          discovery: {
            mode: "hybrid",
            source_kind: job.source_kind,
            source_confidence: job.source_confidence,
            verification_status: job.verification_status,
            search_query: searchQuery,
            location,
          },
        },
      }));

      const { error: upsertError } = await supabaseAdmin
        .from("jobs")
        .upsert(rows, { onConflict: "user_id,source_id" });

      if (upsertError) {
        console.error("jobs-search upsert error", upsertError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        jobs: discoveredJobs.map((job) => ({
          title: job.title,
          company: job.company,
          location: job.location,
          url: job.url,
          description: job.description,
          posted_at: job.posted_at,
          source_kind: job.source_kind,
          source_confidence: job.source_confidence,
          verification_status: job.verification_status,
          is_tracked_company: job.is_tracked_company,
        })),
        count: discoveredJobs.length,
        status: "completed",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("jobs-search.error", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unexpected error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  }
});
