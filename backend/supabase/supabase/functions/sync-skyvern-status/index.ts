// @ts-nocheck
// Polls Skyvern for the current status of a workflow run and syncs it back
// to the applications table.  The frontend calls this for applications stuck
// in "Pending" to pull through any webhook updates that were missed.

import { getCorsHeaders } from "../_shared/types.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin") || undefined);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const runId = body?.run_id;
    if (!runId || typeof runId !== "string") {
      return new Response(JSON.stringify({ error: "run_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const skyvernKey = Deno.env.get("SKYVERN_API_KEY") || "";
    if (!skyvernKey) {
      return new Response(JSON.stringify({ error: "SKYVERN_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Workflow runs use wr_ prefix, task runs use tsk_
    const isWorkflow = runId.startsWith("wr_");
    const endpoint = isWorkflow
      ? `https://api.skyvern.com/v1/run/${runId}`
      : `https://api.skyvern.com/v1/tasks/${runId}`;

    const skyvernRes = await fetch(endpoint, {
      headers: { "x-api-key": skyvernKey },
    });

    if (!skyvernRes.ok) {
      const errText = await skyvernRes.text();
      return new Response(
        JSON.stringify({ error: `Skyvern API ${skyvernRes.status}`, detail: errText }),
        { status: 502, headers: { ...corsHeaders, "content-type": "application/json" } },
      );
    }

    const run = await skyvernRes.json();
    const status = (run?.status || "").toLowerCase();

    const terminalSuccess = ["succeeded", "completed"];
    const terminalFail = ["failed", "error", "cancelled", "canceled", "timed_out", "terminated"];

    const appStatus = terminalSuccess.includes(status)
      ? "Applied"
      : terminalFail.includes(status)
        ? "Failed"
        : null;

    const canonicalStage = terminalSuccess.includes(status)
      ? "applied"
      : terminalFail.includes(status)
        ? "failed"
        : ["running", "queued", "created"].includes(status)
          ? "queued"
          : null;

    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const patch: Record<string, unknown> = {
      provider_status: status,
      updated_at: new Date().toISOString(),
      ...(appStatus && { status: appStatus }),
      ...(canonicalStage && { canonical_stage: canonicalStage }),
      ...(run?.failure_reason && { failure_reason: run.failure_reason }),
      ...(run?.recording_url && { recording_url: run.recording_url }),
      ...(run?.app_url && { app_url: run.app_url }),
    };

    const { error: updateErr } = await sb
      .from("applications")
      .update(patch)
      .eq("run_id", runId)
      .eq("user_id", user.id);

    if (updateErr) {
      console.error("sync-skyvern-status update error", updateErr);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        run_id: runId,
        skyvern_status: status,
        app_status: appStatus,
        canonical_stage: canonicalStage,
        failure_reason: run?.failure_reason || null,
      }),
      { headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  } catch (e: any) {
    console.error("sync-skyvern-status error", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
