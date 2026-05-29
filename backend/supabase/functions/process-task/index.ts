// backend/supabase/functions/process-task/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { discoverJobsFirecrawl } from "../_shared/discovery-hybrid.ts";
import { persistDiscoveredJobs } from "../_shared/jobs.ts";
import { resolveJobSearchExecutionLimits } from "../_shared/subscription.ts";
import { evaluateAndPersistJobFit } from "../_shared/job-evaluation.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

class TaskCanceledError extends Error {
  constructor() {
    super("Task was canceled by user.");
    this.name = "TaskCanceledError";
  }
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
        },
      );
      totalInserted += batchInserted;
      // Update progress intermediate
      await progress.updateProgress(2, 3, `Found and saved ${totalInserted} jobs...`);
    },
  );

  // Bill credits
  const jobsBilled = Math.min(
    effectiveLimit,
    Math.max(1, totalInserted),
  );
  const { data: deductRaw, error: deductError } = await supabase.rpc(
    "deduct_job_search_credits",
    { p_user_id: userId, p_jobs_count: jobsBilled },
  );

  if (deductError) {
    console.error("Deduct credits failed in background task", deductError);
  }

  await progress.updateProgress(3, 3, `Scout search completed. Found ${totalInserted} jobs.`);

  return {
    count: totalInserted,
    jobsBilled,
    warnings,
    jobs: discoveredJobs.map((job: any) => ({
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url,
    })),
  };
}

Deno.serve(async (req) => {
  // Database triggers call process-task Edge Function directly
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!token || (token !== serviceRoleKey && token !== "SYSTEM_TRIGGER")) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const { taskId } = await req.json().catch(() => ({}));
    if (!taskId) {
      return new Response("Missing taskId", { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
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

    if (task.status === "completed" || task.status === "failed" || task.status === "canceled") {
      return new Response("Task already completed", { status: 200, headers: corsHeaders });
    }

    // Mark task as running
    const nowIso = new Date().toISOString();
    const { error: runError } = await supabase
      .from("job_intelligence_tasks")
      .update({
        status: "running",
        started_at: nowIso,
        updated_at: nowIso,
        message: "Starting execution...",
      })
      .eq("id", taskId);

    if (runError) {
      console.error(`[process-task] Failed to mark task running ${taskId}`, runError);
      return new Response("Failed to start task", { status: 500, headers: corsHeaders });
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
        } else {
          const errorMsg = err instanceof Error ? err.message : String(err);
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
