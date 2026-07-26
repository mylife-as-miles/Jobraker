import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

function jsonResponse(
  req: Request,
  data: Record<string, unknown>,
  status = 200,
) {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return jsonResponse(req, { ok: true });
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) {
    return jsonResponse(req, { error: "Missing Authorization header" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(
      req,
      { error: "Supabase environment variables are not configured" },
      500,
    );
  }

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Verify admin access
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin && user.email !== "siscostarters@gmail.com") {
      return jsonResponse(req, { error: "Admin access required" }, 403);
    }

    // Clear all queued applications
    const { data: updatedApps, error: updateError } = await serviceClient
      .from("applications")
      .update({
        canonical_stage: "failed",
        status: "Failed",
        provider_status: "cancelled",
        failure_reason: "Cleared from queue by admin",
        updated_at: new Date().toISOString(),
      })
      .eq("canonical_stage", "queued")
      .select("id");

    if (updateError) {
      console.error("admin-clear-queue error:", updateError);
      return jsonResponse(req, { error: updateError.message }, 500);
    }

    const count = updatedApps?.length || 0;
    console.log(`admin-clear-queue: Successfully cleared ${count} queued jobs.`);

    return jsonResponse(req, {
      success: true,
      cleared_count: count,
      message: `Successfully cleared ${count} jobs from the queue.`,
    });
  } catch (error) {
    console.error("admin-clear-queue unhandled error:", error);
    return jsonResponse(
      req,
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
