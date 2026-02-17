// @ts-nocheck
// Returns the personalized job queue for the authenticated user from the 'jobs' table.
//
// Inputs (query string or JSON body):
//   - all?: boolean        // if true, increases max limit (up to 1000)
//   - limit?: number       // max rows to return (default 200, hard-capped at 2000)
//   - offset?: number      // pagination offset (default 0)
//
// Output JSON:
//   {
//     jobs: Array<Record<string, any>>,
//     pagination: {
//       count: number | null,
//       limit: number,
//       offset: number,
//       hasMore: boolean | null
//     }
//   }
//
// Notes:
// - Requires Authorization header; respects RLS to only return the caller's visible jobs.
// - CORS preflight handled for browser usage.
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/types.ts";

Deno.serve(async (req) => {
  // Get dynamic CORS headers based on request origin
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

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

    // Parse pagination/flags from query string or JSON body.
    const url = new URL(req.url);
    const qs = url.searchParams;
    let body: any = null;
    try {
      if (req.headers.get('content-type')?.includes('application/json')) {
        body = await req.json();
      }
    } catch (_) {
      // ignore malformed JSON
    }
    const allParam = (qs.get('all') ?? body?.all) as (string | boolean | null);
    const limitParam = (qs.get('limit') ?? body?.limit) as (string | number | null);
    const offsetParam = (qs.get('offset') ?? body?.offset) as (string | number | null);

    const all = String(allParam).toLowerCase() === 'true' || allParam === true;
    let limit = all ? 1000 : Number(limitParam ?? 200);
    if (!Number.isFinite(limit) || limit <= 0) limit = all ? 1000 : 200;
    // Put a hard ceiling to protect the DB/API.
    limit = Math.min(limit, 2000);
    let offset = Number(offsetParam ?? 0);
    if (!Number.isFinite(offset) || offset < 0) offset = 0;

    // Step 2: Fetch jobs for the current user from the 'jobs' table.
    // The RLS policy ensures only the user's own jobs are returned.
    const query = supabase
      .from("jobs")
      .select("*", { count: 'exact' })
      .order("posted_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: jobs, error: jobsError, count } = await query;

    if (jobsError) {
      // Log the actual error for debugging, but return a generic message to the client.
      console.error('get-jobs error:', jobsError.message);
      return new Response(JSON.stringify({ error: 'Failed to retrieve jobs.' }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Step 3: Return the user's job queue with pagination metadata.
    const resp = {
      jobs: jobs || [],
      pagination: {
        count: typeof count === 'number' ? count : null,
        limit,
        offset,
        hasMore: typeof count === 'number' ? offset + (jobs?.length || 0) < count : null,
      },
    };
    return new Response(JSON.stringify(resp), {
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