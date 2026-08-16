import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

async function recoverStaleRtrvrRows(serviceClient: any) {
  const staleBefore = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: rows, error } = await serviceClient
    .from("applications")
    .select("id, provider_status, automation_heartbeat_at")
    .eq("automation_provider", "rtrvr")
    .eq("canonical_stage", "queued")
    .in("provider_status", ["rtrvr_running", "waiting", "launching"])
    .lt("updated_at", staleBefore)
    .limit(200);
  if (error) throw error;

  let requeued = 0;
  for (const row of rows || []) {
    const heartbeat = row.automation_heartbeat_at
      ? new Date(row.automation_heartbeat_at).getTime()
      : 0;
    if (heartbeat > Date.now() - 10 * 60_000) continue;
    const { error: updateError } = await serviceClient
      .from("applications")
      .update({
        provider_status: "retrying",
        automation_claimed_by: null,
        automation_lease_token: null,
        automation_lease_expires_at: null,
        failure_reason: "Recovered stale RTRVR worker lease; retrying.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("automation_provider", "rtrvr");
    if (!updateError) requeued += 1;
  }
  return { requeued };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!serviceRoleKey || token !== serviceRoleKey) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!Deno.env.get("RTRVR_API_KEY")?.trim()) {
      return new Response(JSON.stringify({ error: "RTRVR is not configured", code: "rtrvr_not_configured" }), {
        status: 503, headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", serviceRoleKey, {
      auth: { persistSession: false },
    });
    const recovery = await recoverStaleRtrvrRows(supabase);
    const platformLimit = Math.max(1, Number(Deno.env.get("AUTO_APPLY_MAX_CONCURRENCY") || 10));
    const { data, error } = await supabase.rpc("acquire_next_auto_apply_jobs", {
      p_platform_max_concurrency: platformLimit,
    });
    if (error) throw error;

    const applicationIds = Array.isArray(data)
      ? data.map((row: unknown) => typeof row === "string" ? row : (row as { application_id?: string })?.application_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    const handoffs = await Promise.all(applicationIds.map(async (applicationId) => {
      const { error: handoffError } = await supabase
        .from("applications")
        .update({
          automation_provider: "rtrvr",
          provider_status: "waiting_worker",
          canonical_stage: "queued",
          status: "Pending",
          failure_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicationId)
        .eq("canonical_stage", "queued");
      if (handoffError) console.error("rtrvr_queue_handoff_failed", { applicationId, error: handoffError.message });
      return !handoffError;
    }));

    return new Response(JSON.stringify({
      success: true,
      queued_for_worker: handoffs.filter(Boolean).length,
      recovery,
    }), { status: 202, headers: { ...corsHeaders, "content-type": "application/json" } });
  } catch (error) {
    console.error("rtrvr_queue_failed", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unable to queue RTRVR automation" }), {
      status: 500, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
