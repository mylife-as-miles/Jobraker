import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createNotificationRecord } from "../_shared/notification-center.ts";

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

async function executeRtrvrApplicationDirect(supabase: any, applicationId: string, rtrvrApiKey: string) {
  try {
    const { data: app, error } = await supabase
      .from("applications")
      .select("*, profiles(*)")
      .eq("id", applicationId)
      .single();

    if (error || !app) {
      console.warn("[process-auto-apply-queue] Application not found:", applicationId);
      return;
    }

    const nowIso = new Date().toISOString();
    await supabase
      .from("applications")
      .update({
        provider_status: "rtrvr_running",
        canonical_stage: "queued",
        automation_heartbeat_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", applicationId);

    const applyUrl = app.app_url || "";
    const candidateName = `${app.profiles?.first_name || ""} ${app.profiles?.last_name || ""}`.trim() || "Candidate";
    const candidateEmail = app.profiles?.email || "";
    const candidatePhone = app.profiles?.phone || "";
    const candidateLocation = app.profiles?.location || "";
    const candidateLinkedIn = app.profiles?.linkedin_url || "";
    const candidateGithub = app.profiles?.github_url || "";
    const autoSubmit = Boolean(app.auto_apply_auto_submit ?? true);

    const prompt = [
      `You are JobRaker's governed auto-apply agent for role "${app.job_title}" at "${app.company}".`,
      `Target Application URL: ${applyUrl}`,
      `Candidate Verified Details:`,
      `- Full Name: ${candidateName}`,
      `- Email: ${candidateEmail}`,
      `- Phone: ${candidatePhone}`,
      `- Location: ${candidateLocation}`,
      `- LinkedIn: ${candidateLinkedIn}`,
      `- GitHub: ${candidateGithub}`,
      `Instructions:`,
      `- Navigate to the job application URL.`,
      `- Fill in the application fields accurately using the candidate's verified information.`,
      `- If resume upload is present, attach the candidate's resume.`,
      `- If 2FA, CAPTCHA, or custom account login is required, report waiting_for_user.`,
      autoSubmit ? `- Complete and submit the application.` : `- Fill and prepare the form, but do not click final submit (save draft).`,
    ].join("\n");

    const rtrvrRes = await fetch("https://api.rtrvr.ai/agent", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${rtrvrApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: prompt,
        urls: [applyUrl],
        response: { verbosity: "final" },
      }),
    });

    const result = await rtrvrRes.json().catch(() => ({}));
    const finishedAt = new Date().toISOString();

    if (rtrvrRes.ok) {
      const isDraftOnly = !autoSubmit || result?.status === "prepared";
      await supabase
        .from("applications")
        .update({
          status: isDraftOnly ? "Draft" : "Applied",
          canonical_stage: isDraftOnly ? "draft" : "applied",
          provider_status: isDraftOnly ? "prepared" : "succeeded",
          applied_date: finishedAt,
          updated_at: finishedAt,
          automation_heartbeat_at: finishedAt,
        })
        .eq("id", applicationId);

      try {
        await createNotificationRecord(supabase, {
          userId: app.user_id,
          type: "application",
          title: isDraftOnly ? `Draft Prepared: ${app.job_title}` : `Application Submitted: ${app.job_title}`,
          message: isDraftOnly
            ? `Your application for ${app.job_title} at ${app.company} is filled and ready for your final review.`
            : `Your application for ${app.job_title} at ${app.company} was submitted successfully via cloud automation.`,
          priority: "medium",
          source: "automation",
          sourceRecordId: applicationId,
          sourceRecordType: "application",
          actionUrl: "/dashboard/applications",
          actionLabel: "View Application",
        });
      } catch (e) {
        console.warn("[process-auto-apply-queue] notification failed:", e);
      }
    } else {
      console.warn("[process-auto-apply-queue] RTRVR execution result:", result);
      await supabase
        .from("applications")
        .update({
          status: "Pending",
          canonical_stage: "queued",
          provider_status: "waiting_worker",
          failure_reason: result?.error || result?.message || "RTRVR cloud run error",
          updated_at: finishedAt,
        })
        .eq("id", applicationId);
    }
  } catch (err: any) {
    console.error("[process-auto-apply-queue] executeRtrvrApplicationDirect error:", err);
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    
    let isAuthorized = Boolean(serviceRoleKey && token === serviceRoleKey);
    if (!isAuthorized && token) {
      const authClient = createClient(Deno.env.get("SUPABASE_URL") || "", anonKey || serviceRoleKey, {
        auth: { persistSession: false },
      });
      const { data: userData } = await authClient.auth.getUser(token);
      if (userData?.user) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const rtrvrApiKey = (
      Deno.env.get("RTRVR_API_KEY") ||
      Deno.env.get("FIRECRAWL_API_KEY") ||
      ""
    ).trim();
    if (!rtrvrApiKey) {
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

    // Trigger direct cloud execution for claimed applications
    for (const applicationId of applicationIds) {
      // Execute asynchronously in background isolate
      void executeRtrvrApplicationDirect(supabase, applicationId, rtrvrApiKey);
    }

    return new Response(JSON.stringify({
      success: true,
      acquired_and_running: applicationIds.length,
      recovery,
    }), { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } });
  } catch (error) {
    console.error("rtrvr_queue_failed", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unable to queue RTRVR automation" }), {
      status: 500, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
