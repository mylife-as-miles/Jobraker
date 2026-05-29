// @ts-nocheck
// Polls Skyvern for the current status of a workflow run and syncs it back
// to the applications table.  The frontend calls this for applications stuck
// in "Pending" to pull through any webhook updates that were missed.

import { getCorsHeaders } from "../_shared/types.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const skyvernRes = await fetch(url, {
      headers: { "x-api-key": skyvernKey },
    });

    if (skyvernRes.ok) {
      return {
        run: await skyvernRes.json(),
        url,
      };
    }

    lastError = {
      status: skyvernRes.status,
      detail: await skyvernRes.text(),
      url,
    };

    if (skyvernRes.status !== 404) {
      break;
    }
  }

  throw new Error(JSON.stringify({
    error: "Skyvern fetch failed",
    ...(lastError || {}),
  }));
}

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
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
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

    let run: any;
    try {
      const res = await fetchSkyvernRun(runId, skyvernKey);
      run = res.run;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      let detail = message;
      try {
        detail = JSON.parse(message);
      } catch {
        // Preserve the original error string when it's not JSON.
      }
      if (typeof detail === "object" && detail !== null && (detail as any).status === 404) {
        run = {
          status: "failed",
          failure_reason: "Automation run not found on provider (404).",
          error: "Automation run not found on provider (404)."
        };
      } else {
        return new Response(
          JSON.stringify(detail),
          { status: 502, headers: { ...corsHeaders, "content-type": "application/json" } },
        );
      }
    }

    const { providerStatus, appStatus, canonicalStage } = mapSkyvernStatus(run?.status);
    const failureReason = run?.failure_reason || run?.error || null;

    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const patch: Record<string, unknown> = {
      provider_status: providerStatus || null,
      updated_at: new Date().toISOString(),
      ...(appStatus && { status: appStatus }),
      ...(canonicalStage && { canonical_stage: canonicalStage }),
      failure_reason: TERMINAL_FAIL.includes(providerStatus) ? failureReason : null,
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
        skyvern_status: providerStatus,
        app_status: appStatus,
        canonical_stage: canonicalStage,
        failure_reason: failureReason,
      }),
      { headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  } catch (e: any) {
    console.error("sync-skyvern-status error", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
