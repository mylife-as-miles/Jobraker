import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
import { recordSkyvernUsageFromOutput } from "../_shared/provider-credits.ts";

const TERMINAL_SUCCESS = ["succeeded", "completed"];
const TERMINAL_FAIL = [
  "failed",
  "error",
  "cancelled",
  "canceled",
  "timed_out",
  "terminated",
];
const IN_PROGRESS = ["running", "queued", "created", "pending"];

function mapSkyvernStatus(status: string | null | undefined) {
  const normalized = (status || "").toLowerCase();

  return {
    providerStatus: normalized,
    appStatus: TERMINAL_SUCCESS.includes(normalized)
      ? "Applied"
      : TERMINAL_FAIL.includes(normalized)
        ? "Failed"
        : null,
    canonicalStage: TERMINAL_SUCCESS.includes(normalized)
      ? "submitted"
      : TERMINAL_FAIL.includes(normalized)
        ? "failed"
        : IN_PROGRESS.includes(normalized)
          ? "queued"
          : null,
  };
}

async function fetchSkyvernRun(runId: string, skyvernKey: string) {
  const encodedRunId = encodeURIComponent(runId);
  const candidateUrls = [
    `https://api.skyvern.com/v1/runs/${encodedRunId}`,
  ];

  if (runId.startsWith("tsk_")) {
    candidateUrls.push(`https://api.skyvern.com/v1/tasks/${encodedRunId}`);
  }
  if (runId.startsWith("wr_")) {
    candidateUrls.push(`https://api.skyvern.com/v1/run/${encodedRunId}`);
  }

  let lastError: { status: number; detail: string; url: string } | null = null;

  for (const url of candidateUrls) {
    const response = await fetch(url, {
      headers: { "x-api-key": skyvernKey },
    });

    if (response.ok) {
      return await response.json();
    }

    lastError = {
      status: response.status,
      detail: await response.text(),
      url,
    };

    if (response.status !== 404) {
      break;
    }
  }

  return {
    __error: {
      error: "Automation run fetch failed",
      ...(lastError || {}),
    },
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);

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
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return new Response(JSON.stringify({ error: "Supabase env vars not set" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const runId = body?.run_id ? String(body.run_id).trim() : null;
    const applicationId = (body?.application_id || body?.id) ? String(body.application_id || body.id).trim() : null;

    if (!runId && !applicationId) {
      return new Response(JSON.stringify({ error: "run_id or application_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    let appQuery = serviceClient
      .from("applications")
      .select("id, user_id, job_id, run_id, status, canonical_stage, provider_status, automation_provider, failure_reason, app_url, updated_at")
      .eq("user_id", user.id);

    if (applicationId) {
      appQuery = appQuery.eq("id", applicationId);
    } else if (runId) {
      appQuery = appQuery.eq("run_id", runId);
    }

    const { data: appRow, error: appFetchErr } = await appQuery.maybeSingle();
    if (appFetchErr || !appRow) {
      return new Response(JSON.stringify({ error: "Application not found" }), {
        status: 404,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const effectiveRunId = runId || appRow.run_id;
    let providerStatus = appRow.provider_status;
    let appStatus = appRow.status;
    let canonicalStage = appRow.canonical_stage;
    let failureReason = appRow.failure_reason;

    const skyvernKey = Deno.env.get("SKYVERN_API_KEY") || "";
    if (effectiveRunId && skyvernKey) {
      let run = await fetchSkyvernRun(effectiveRunId, skyvernKey);
      if (run && !run.__error) {
        const mapped = mapSkyvernStatus(run?.status);
        providerStatus = mapped.providerStatus || providerStatus;
        if (mapped.appStatus) appStatus = mapped.appStatus;
        if (mapped.canonicalStage) canonicalStage = mapped.canonicalStage;
        failureReason = run?.failure_reason || run?.error || failureReason;

        const patch: Record<string, unknown> = {
          provider_status: providerStatus,
          updated_at: new Date().toISOString(),
          ...(appStatus && { status: appStatus }),
          ...(canonicalStage && { canonical_stage: canonicalStage }),
          failure_reason: TERMINAL_FAIL.includes(providerStatus) ? failureReason : null,
          ...(run?.recording_url && { recording_url: run.recording_url }),
          ...(run?.app_url && { app_url: run.app_url }),
          provider_run_output: run,
        };

        await serviceClient
          .from("applications")
          .update(patch)
          .eq("id", appRow.id);

        try {
          await recordSkyvernUsageFromOutput(serviceClient, run, {
            runId: effectiveRunId,
            status: providerStatus,
            userId: user.id,
            source: "sync-provider-status",
          });
        } catch (creditError) {
          console.warn("sync-provider-status credit record failed", creditError);
        }
      }
    }

    // If job_id exists, sync jobs canonical_status
    if (appRow.job_id && canonicalStage) {
      const jobCanonicalStatus = canonicalStage === "submitted" ? "submitted" : canonicalStage === "failed" ? "failed" : "queued";
      await serviceClient
        .from("jobs")
        .update({ canonical_status: jobCanonicalStatus, updated_at: new Date().toISOString() })
        .eq("id", appRow.job_id)
        .eq("user_id", user.id);
    }

    return new Response(JSON.stringify({
      ok: true,
      application_id: appRow.id,
      run_id: effectiveRunId,
      provider_status: providerStatus,
      app_status: appStatus,
      canonical_stage: canonicalStage,
      failure_reason: failureReason,
    }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("sync-provider-status error", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
