// @ts-nocheck
// Returns the personalized job queue for the authenticated user from the 'jobs' table.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/types.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Step 1: Authenticate the user.
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    // Create a Supabase client with the user's auth token.
    // This will respect Row Level Security policies on the 'jobs' table.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), { status: 401, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    // Step 2: Fetch all jobs for the current user from the 'jobs' table.
    // No complex filtering is needed here anymore, as this function's role is just to return the user's pre-filtered queue.
    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("*")
      .order("posted_at", { ascending: false });

    if (jobsError) {
      throw jobsError;
    }

    // Step 3: Return the user's job queue.
    // The 'facets' logic is removed as it's no longer applicable to a small, personalized queue.
    return new Response(JSON.stringify({ jobs: jobs || [] }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
      status: 200,
    });

  } catch (e) {
    console.error('get-jobs error:', e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});