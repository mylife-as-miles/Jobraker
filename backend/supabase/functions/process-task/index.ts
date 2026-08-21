// backend/supabase/functions/process-task/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { discoverJobsFirecrawl } from "../_shared/discovery-hybrid.ts";
import {
  countDisplayableJobsForSearch,
  persistDiscoveredJobs,
  resolveJobSearchCreditsToCharge,
  settleJobSearchRunCredits,
} from "../_shared/jobs.ts";
import { resolveJobSearchExecutionLimits } from "../_shared/subscription.ts";
import { evaluateAndPersistJobFit } from "../_shared/job-evaluation.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createNotificationRecord } from "../_shared/notification-center.ts";


class TaskCanceledError extends Error {
  constructor() {
    super("Task was canceled by user.");
    this.name = "TaskCanceledError";
  }
}

function serializeError(err: any): string {
  if (err == null) return "Unknown error";
  let rawMsg = "";
  if (typeof err === "string") {
    rawMsg = err;
  } else if (err instanceof Error) {
    const anyErr = err as any;
    if (anyErr.response?.data) {
      rawMsg = `${err.message}: ${JSON.stringify(anyErr.response.data)}`;
    } else {
      rawMsg = err.message || err.stack || String(err);
    }
  } else if (typeof err === "object") {
    if (err.message) {
      let msg = err.message;
      if (err.details) msg += ` (${err.details})`;
      if (err.code) msg += ` [Code: ${err.code}]`;
      rawMsg = msg;
    } else {
      try {
        rawMsg = JSON.stringify(err);
      } catch {
        rawMsg = String(err);
      }
    }
  } else {
    rawMsg = String(err);
  }

  // Clean up database internal constraint errors into human-friendly explanations
  if (/23505|duplicate key|jobs_user_fingerprint_idx/i.test(rawMsg)) {
    return "Duplicate job entry detected — merged into application queue.";
  }

  return rawMsg;
}

async function executePipelineCleanup(supabase: any, userId: string, params: any, progress: any) {
  const jobIds = params.job_ids || [];
  if (!Array.isArray(jobIds) || jobIds.length === 0) {
    return { count: 0 };
  }

  await progress.updateProgress(0, jobIds.length, `Preparing to clean up ${jobIds.length} jobs.`);

  const { error } = await supabase
    .from("jobs")
    .update({ hidden: true, canonical_status: "hidden" })
    .in("id", jobIds)
    .eq("user_id", userId);

  if (error) throw error;

  await progress.updateProgress(jobIds.length, jobIds.length, `Cleaned up ${jobIds.length} jobs.`);
  return { count: jobIds.length, cleaned_job_ids: jobIds };
}

async function executeJobReevaluation(supabase: any, userId: string, params: any, progress: any) {
  const jobIds = params.job_ids || [];
  if (!Array.isArray(jobIds) || jobIds.length === 0) {
    return { count: 0 };
  }

  const total = jobIds.length;
  await progress.updateProgress(0, total, `Loading profile and resume...`);

  // Fetch profile snapshot
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  const profileSnapshot = profile ? JSON.stringify(profile) : null;

  // Fetch active resume
  let resumeText = null;
  const { data: resumes } = await supabase
    .from("resumes")
    .select("raw_text")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (resumes && resumes.length > 0) {
    resumeText = resumes[0].raw_text;
  }

  const results = [];
  for (let i = 0; i < total; i++) {
    const jobId = jobIds[i];
    await progress.updateProgress(i, total, `Evaluating job ${i + 1} of ${total}...`);

    // Fetch job details
    const { data: job } = await supabase
      .from("jobs")
      .select("title, company, description")
      .eq("id", jobId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!job) {
      continue;
    }

    // Run evaluation
    const evalResult = await evaluateAndPersistJobFit({
      serviceClient: supabase,
      userId,
      jobId,
      jobTitle: job.title,
      company: job.company,
      jobDescription: job.description || "",
      profileSnapshot,
      resumeText,
    });

    results.push({ jobId, status: "success", decision: evalResult.canonical_decision });
  }

  await progress.updateProgress(total, total, `Re-evaluated ${total} jobs.`);
  return { count: total, results };
}

async function executeScoutSearch(supabase: any, userId: string, params: any, progress: any) {
  const searchQuery = params.search_query || "";
  const location = params.location || "Remote";
  const requestedLimit = params.limit || 10;
  const sourceFocus = params.sources || [];
  const targetDomains = params.targetDomains || [];
  const freshnessDays = Number.isFinite(Number(params.freshnessDays))
    ? Math.max(1, Math.min(365, Math.floor(Number(params.freshnessDays))))
    : 30;
  const agentRunId = params.agent_run_id;

  await progress.updateProgress(0, 3, "Resolving search limits...");

  // Resolve limits
  const {
    subscriptionTier,
    effectiveLimit,
  } = await resolveJobSearchExecutionLimits(userId, requestedLimit, supabase);

  if (effectiveLimit <= 0) {
    throw new Error("Insufficient credits or limit reached.");
  }

  await progress.updateProgress(1, 3, "Searching web and parsing jobs...");

  let totalInserted = 0;
  const { jobs: discoveredJobs, warnings } = await discoverJobsFirecrawl(
    {
      serviceClient: supabase,
      userId,
      searchQuery,
      location,
      limit: effectiveLimit,
      sourceFocus,
      targetDomains,
      freshnessDays,
    },
    async (batch) => {
      const { jobsInserted: batchInserted } = await persistDiscoveredJobs(
        supabase,
        batch,
        {
          userId,
          searchQuery,
          location,
          trigger: "live_search",
          requestedLimit,
          effectiveLimit,
          subscriptionTier,
          agentRunId,
        },
      );
      totalInserted += batchInserted;
      // Update progress intermediate
      await progress.updateProgress(2, 3, `Found and saved ${totalInserted} jobs...`);
    },
  );

  const searchStartedAt = typeof params.search_started_at === "string"
    ? params.search_started_at
    : undefined;

  let displayableJobCount = 0;
  let creditsCharged = 0;

  if (agentRunId) {
    const settlement = await settleJobSearchRunCredits(supabase, {
      agentRunId,
      userId,
      searchQuery,
      location,
      searchStartedAt,
      maxCredits: Math.max(1, effectiveLimit),
      jobsInserted: totalInserted,
      jobsDiscovered: discoveredJobs.length,
      settlementIdempotencyKey: `settle:${agentRunId}:${Date.now()}`,
    });
    displayableJobCount = settlement.displayableJobCount;
    creditsCharged = settlement.creditsCharged;
  } else if (totalInserted > 0) {
    displayableJobCount = await countDisplayableJobsForSearch(supabase, {
      userId,
      searchQuery,
      location,
      searchStartedAt,
    });
    creditsCharged = resolveJobSearchCreditsToCharge(
      displayableJobCount,
      effectiveLimit,
    );

    if (creditsCharged > 0) {
      const { error: deductError } = await supabase.rpc(
        "deduct_job_search_credits",
        { p_user_id: userId, p_jobs_count: creditsCharged },
      );

      if (deductError) {
        console.error("Deduct credits failed in background task", deductError);
      }
    }
  }

  await progress.updateProgress(3, 3, `Scout search completed. Found ${displayableJobCount} jobs.`);

  return {
    count: displayableJobCount,
    jobsInserted: totalInserted,
    newCount: totalInserted,
    duplicateCount: Math.max(0, discoveredJobs.length - totalInserted),
    displayedCount: displayableJobCount,
    jobsBilled: creditsCharged,
    warnings,
    jobs: discoveredJobs.map((job: any) => ({
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url,
    })),
  };
}

async function executeChatCompletion(
  _supabase: any,
  userId: string,
  params: any,
  progress: any,
) {
  if (!Array.isArray(params.messages) || params.messages.length === 0) {
    throw new Error("Chat task is missing its messages.");
  }

  await progress.updateProgress(0, 3, "Preparing your request...");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!serviceRoleKey || !supabaseUrl) {
    throw new Error("Background chat is not configured.");
  }

  await progress.updateProgress(1, 3, "Generating a response...");
  const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${serviceRoleKey}`,
      "x-jobraker-background-user-id": userId,
    },
    body: JSON.stringify({
      messages: params.messages,
      model: params.model,
      mode: params.mode,
      webSearch: params.webSearch,
      system: params.system,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(await response.text().catch(() => "Background chat could not start."));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "message";
  let content = "";
  let responseId: string | null = null;

  const consumeLine = (line: string) => {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim() || "message";
      return;
    }
    if (!line.startsWith("data:")) return;
    const raw = line.slice(5).trim();
    if (!raw || raw === "[DONE]") return;
    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    if (event === "message" && typeof payload.delta === "string") {
      content += payload.delta;
    } else if (event === "response_id" && typeof payload.response_id === "string") {
      responseId = payload.response_id;
    } else if (event === "error") {
      throw new Error(String(payload.error || "Background chat failed."));
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) consumeLine(line);
  }
  if (buffer.trim()) consumeLine(buffer.trim());
  if (!content.trim()) throw new Error("Background chat finished without a response.");

  await progress.updateProgress(3, 3, "Response ready.");
  return { content, response_id: responseId };
}

const PUBLIC_APP_URL =
  Deno.env.get("PUBLIC_APP_URL") ||
  Deno.env.get("APP_BASE_URL") ||
  Deno.env.get("SITE_URL") ||
  "https://app.jobraker.io";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function getUserEmail(supabase: any, userId: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) {
    console.warn("[process-task] Failed to load user email for task failure notification", error);
    return null;
  }
  const email = data?.user?.email;
  return typeof email === "string" && email.trim() ? email.trim() : null;
}

async function sendTaskFailureEmail(supabase: any, userId: string, task: any, errorMsg: string, recipient: string) {
  const apiKey = String(Deno.env.get("RESEND_API_KEY") || "").trim();
  if (!apiKey) {
    console.warn("[process-task] Skipping email: RESEND_API_KEY is not configured");
    return { sent: false, reason: "missing_resend_api_key" };
  }

  // Check if general email notifications are enabled
  const { data: settings, error: settingsError } = await supabase
    .from("notification_settings")
    .select("email_notifications")
    .eq("id", userId)
    .maybeSingle();

  if (settingsError) {
    console.warn("[process-task] Failed to load notification email settings, proceeding to send email", settingsError);
  }

  if (settings && settings.email_notifications === false) {
    return { sent: false, reason: "disabled_by_settings" };
  }

  const taskTitle = task.title || "Background Task";
  const subject = `JobRaker Background Task Failed: ${taskTitle}`;
  const actionUrl = new URL("/dashboard/jobs", PUBLIC_APP_URL).toString();
  
  const text = [
    `JobRaker encountered an issue while running your background task: "${taskTitle}".`,
    "",
    `Type: ${task.type}`,
    `Status: Failed`,
    `Error/Reason: ${errorMsg}`,
    "",
    `You can view your jobs or status in the dashboard: ${actionUrl}`,
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <p>JobRaker encountered an issue while running your background task: <strong>${escapeHtml(taskTitle)}</strong>.</p>
      <p>
        <strong>Task Type:</strong> ${escapeHtml(task.type)}<br>
        <strong>Status:</strong> Failed<br>
        <strong>Error/Reason:</strong> ${escapeHtml(errorMsg)}
      </p>
      <p><a href="${escapeHtml(actionUrl)}">Open JobRaker Dashboard</a></p>
    </div>
  `;

  const fromEmail = String(Deno.env.get("RESEND_FROM_EMAIL") || "").trim() || "JobRaker Alerts <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: recipient,
      subject,
      text,
      html,
    }),
  });

  const responsePayload = await response.json().catch(async () => ({
    raw: await response.text().catch(() => ""),
  }));

  if (!response.ok) {
    console.error("[process-task] sendTaskFailureEmail.resend_failed", {
      status: response.status,
      payload: responsePayload,
      taskId: task.id,
    });
    return { sent: false, reason: "resend_error", status: response.status };
  }

  return { sent: true };
}

async function notifyTaskFailure(supabase: any, userId: string, task: any, errorMsg: string) {
  const isJobSearch = task.type === "scout_search";
  const type = isJobSearch ? "job_search" : "system";
  const source = isJobSearch ? "job_search" : "system";
  const title = isJobSearch ? "Background search failed" : (task.title || "Background task failed");
  const message = task.title 
    ? `"${task.title}" went down due to an issue: ${errorMsg}` 
    : `Background task failed: ${errorMsg}`;

  // 1. Create in-app notification
  try {
    await createNotificationRecord(supabase, {
      userId,
      type,
      title,
      message,
      priority: "high",
      source,
      sourceRecordId: task.id,
      sourceRecordType: "job_intelligence_task",
      actionUrl: "/dashboard/jobs",
      actionLabel: "View jobs",
    });
  } catch (error) {
    console.warn("[process-task] Failed to create in-app notification for task failure", error);
  }

  // 2. Retrieve user email and send email alert
  try {
    const recipient = await getUserEmail(supabase, userId);
    if (recipient) {
      await sendTaskFailureEmail(supabase, userId, task, errorMsg, recipient);
    } else {
      console.warn("[process-task] Skipping email notification: no valid user email found");
    }
  } catch (error) {
    console.warn("[process-task] Failed to send email alert for task failure", error);
  }
}

Deno.serve(async (req) => {
  // Database triggers call process-task Edge Function directly
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!token || !serviceRoleKey || !supabaseUrl) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const isSystemTrigger = token === serviceRoleKey || token === "SYSTEM_TRIGGER";
    let requestingUserId: string | null = null;
    if (!isSystemTrigger) {
      const authClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });
      const { data, error } = await authClient.auth.getUser(token);
      if (error || !data.user) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
      requestingUserId = data.user.id;
    }

    const { taskId } = await req.json().catch(() => ({}));
    if (!taskId) {
      return new Response("Missing taskId", { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    const { data: task, error: loadError } = await supabase
      .from("job_intelligence_tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (loadError || !task) {
      console.error(`[process-task] Failed to load task ${taskId}`, loadError);
      return new Response("Task not found", { status: 404, headers: corsHeaders });
    }

    if (requestingUserId && task.user_id !== requestingUserId) {
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    if (task.status === "completed" || task.status === "failed" || task.status === "canceled") {
      return new Response("Task already completed", { status: 200, headers: corsHeaders });
    }

    // Mark task as running
    const nowIso = new Date().toISOString();
    const { data: startedTask, error: runError } = await supabase
      .from("job_intelligence_tasks")
      .update({
        status: "running",
        started_at: nowIso,
        updated_at: nowIso,
        message: "Starting execution...",
      })
      .eq("id", taskId)
      .eq("status", "queued")
      .select("id")
      .maybeSingle();

    if (runError) {
      console.error(`[process-task] Failed to mark task running ${taskId}`, runError);
      return new Response("Failed to start task", { status: 500, headers: corsHeaders });
    }
    if (!startedTask) {
      return new Response("Task is already being processed", { status: 200, headers: corsHeaders });
    }

    const progressHelper = {
      updateProgress: async (current: number, total: number, message?: string, logsPatch: any[] = []) => {
        // Check if user requested cancellation
        const { data: currentTask } = await supabase
          .from("job_intelligence_tasks")
          .select("cancel_requested")
          .eq("id", taskId)
          .single();

        if (currentTask?.cancel_requested) {
          throw new TaskCanceledError();
        }

        const updated_at = new Date().toISOString();
        const updatePayload: any = {
          progress_current: current,
          progress_total: total,
          updated_at,
        };
        if (message) updatePayload.message = message;
        if (logsPatch.length > 0) {
          const nextLogs = [...(task.logs || []), ...logsPatch];
          updatePayload.logs = nextLogs;
        }

        await supabase
          .from("job_intelligence_tasks")
          .update(updatePayload)
          .eq("id", taskId);
      }
    };

    // Execute the task after responding, but register the work with Supabase
    // Edge Runtime so the isolate is allowed to keep running.
    const execution = (async () => {
      try {
        let result = {};
        if (task.type === "scout_search") {
          result = await executeScoutSearch(supabase, task.user_id, task.params, progressHelper);
        } else if (task.type === "chat_completion") {
          result = await executeChatCompletion(supabase, task.user_id, task.params, progressHelper);
        } else if (task.type === "job_reevaluation") {
          result = await executeJobReevaluation(supabase, task.user_id, task.params, progressHelper);
        } else if (task.type === "pipeline_cleanup") {
          result = await executePipelineCleanup(supabase, task.user_id, task.params, progressHelper);
        } else {
          throw new Error(`Unsupported task type: ${task.type}`);
        }

        const completedAt = new Date().toISOString();
        await supabase
          .from("job_intelligence_tasks")
          .update({
            status: "completed",
            completed_at: completedAt,
            updated_at: completedAt,
            message: "Completed successfully.",
            result,
          })
          .eq("id", taskId);

      } catch (err) {
        if (err instanceof TaskCanceledError) {
          console.log(`[process-task] Task ${taskId} was canceled by user`);
          const canceledAt = new Date().toISOString();
          await supabase
            .from("job_intelligence_tasks")
            .update({
              status: "canceled",
              completed_at: canceledAt,
              updated_at: canceledAt,
              message: "Canceled by user.",
            })
            .eq("id", taskId);
            
          if (task.params?.agent_run_id) {
            await settleJobSearchRunCredits(supabase, {
              agentRunId: task.params.agent_run_id,
              userId: task.user_id,
              searchQuery: task.params.search_query || "",
              location: task.params.location || "",
              maxCredits: 0,
              searchFailed: true,
              failureReason: "Task canceled by user",
              settlementIdempotencyKey: `cancel:${task.params.agent_run_id}:${Date.now()}`,
            });
          }
        } else {
          const errorMsg = serializeError(err);
          console.error(`[process-task] Task ${taskId} failed`, err);

          const nextRetryCount = (task.retry_count || 0) + 1;
          const maxRetries = task.max_retries || 3;
          const updated_at = new Date().toISOString();
          
          if (nextRetryCount <= maxRetries) {
            const runAt = new Date(Date.now() + nextRetryCount * 60 * 1000).toISOString();
            await supabase
              .from("job_intelligence_tasks")
              .update({
                status: "queued",
                retry_count: nextRetryCount,
                run_at: runAt,
                updated_at,
                message: `Failed: ${errorMsg}. Retrying in ${nextRetryCount} minute(s).`,
                logs: [...(task.logs || []), { time: updated_at, event: "failure", error: errorMsg, action: "retry_scheduled" }],
              })
              .eq("id", taskId);
          } else {
            const failedAt = new Date().toISOString();
            await supabase
              .from("job_intelligence_tasks")
              .update({
                status: "failed",
                completed_at: failedAt,
                updated_at: failedAt,
                message: `Failed: ${errorMsg}`,
                logs: [...(task.logs || []), { time: failedAt, event: "failure", error: errorMsg, action: "failed_permanent" }],
              })
              .eq("id", taskId);

            // Trigger failure notifications and emails
            await notifyTaskFailure(supabase, task.user_id, task, errorMsg);

            if (task.params?.agent_run_id) {
              await settleJobSearchRunCredits(supabase, {
                agentRunId: task.params.agent_run_id,
                userId: task.user_id,
                searchQuery: task.params.search_query || "",
                location: task.params.location || "",
                maxCredits: 0,
                searchFailed: true,
                failureReason: `Task failed permanently: ${errorMsg}`,
                settlementIdempotencyKey: `fail:${task.params.agent_run_id}:${Date.now()}`,
              });
            }
          }
        }
      }
    })();

    const edgeRuntime = (globalThis as any).EdgeRuntime;
    if (typeof edgeRuntime?.waitUntil === "function") {
      edgeRuntime.waitUntil(execution);
    }

    return new Response(JSON.stringify({ success: true, message: "Task execution started" }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[process-task] Unexpected trigger error", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
