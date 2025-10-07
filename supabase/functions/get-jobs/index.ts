// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/types.ts";

Deno.serve(async (req) => {
  // This is a preflight request. We don't need to do anything with it.
  // We just need to return a response with the correct headers.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create a Supabase client with the user's auth token
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Fetch all jobs from the user's personal `jobs` table
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .order("posted_at", { ascending: false });

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ jobs: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(String(err?.message ?? err), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});