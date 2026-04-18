import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/types.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } },
      },
    );

    const url = new URL(req.url);
    const qs = url.searchParams;
    let body: any = null;
    try {
      if (req.headers.get("content-type")?.includes("application/json")) {
        body = await req.json();
      }
    } catch {
      body = null;
    }

    const allParam = (qs.get("all") ?? body?.all) as string | boolean | null;
    const limitParam = (qs.get("limit") ?? body?.limit) as string | number | null;
    const offsetParam = (qs.get("offset") ?? body?.offset) as string | number | null;

    const all = String(allParam).toLowerCase() === "true" || allParam === true;
    let limit = all ? 1000 : Number(limitParam ?? 200);
    if (!Number.isFinite(limit) || limit <= 0) limit = all ? 1000 : 200;
    limit = Math.min(limit, 2000);

    let offset = Number(offsetParam ?? 0);
    if (!Number.isFinite(offset) || offset < 0) offset = 0;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { data: jobs, error, count } = await supabase
      .from("jobs")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("posted_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("get-jobs error", error);
      return new Response(JSON.stringify({ error: "Failed to retrieve jobs." }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        jobs: jobs || [],
        pagination: {
          count: typeof count === "number" ? count : null,
          limit,
          offset,
          hasMore:
            typeof count === "number"
              ? offset + (jobs?.length || 0) < count
              : null,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  } catch (error) {
    console.error("get-jobs unexpected error", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred." }),
      {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  }
});
