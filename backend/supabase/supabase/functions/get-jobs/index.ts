// @ts-nocheck
// Returns the personalized job queue for the authenticated user from the 'jobs' table.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/types.ts";

Deno.serve(async (req) => {
  // Immediately handle CORS preflight requests.
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

    // Step 2: Fetch all jobs for the current user from the 'jobs' table.
    // The RLS policy ensures only the user's own jobs are returned.
    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("*")
      .order("posted_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(20);

    if (jobsError) {
      // Log the actual error for debugging, but return a generic message to the client.
      console.error('get-jobs error:', jobsError.message);
      return new Response(JSON.stringify({ error: 'Failed to retrieve jobs.' }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Step 3: Return the user's job queue.
    return new Response(JSON.stringify({ jobs: jobs || [] }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
      status: 200,
    });

  } catch (e) {
    console.error('get-jobs unexpected error:', e.message);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred.' }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});