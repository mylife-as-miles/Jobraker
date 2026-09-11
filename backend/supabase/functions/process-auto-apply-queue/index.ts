import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createNotificationRecord } from "../_shared/notification-center.ts";
import { validateSubmissionPolicy } from "../../shared/auto-apply-policy.ts";
import {
  type ApplicationPackage,
  type ApplicationAnswer,
  type LifecycleState,
  type ApplicationReasonCode,
  type RequirementInputType,
  isCriticalAnswerCategory,
  normalizeQuestionCategory,
  buildRtrvrPromptFromPackage,
  evaluatePackageReadiness,
} from "../../shared/application-package.ts";

async function recoverStaleRtrvrRows(serviceClient: any) {
  const staleBefore = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: rows, error } = await serviceClient
    .from("applications")
    .select("id, user_id, job_title, company, provider_status, automation_heartbeat_at, retry_count")
    .eq("canonical_stage", "queued")
    .in("provider_status", ["rtrvr_running", "waiting", "launching", "retrying", "waiting_worker"])
    .lt("updated_at", staleBefore)
    .limit(200);
  if (error) throw error;

  let recovered = 0;
  for (const row of rows || []) {
    const heartbeat = row.automation_heartbeat_at
      ? new Date(row.automation_heartbeat_at).getTime()
      : 0;
    if (heartbeat > Date.now() - 10 * 60_000) continue;

    const retryCount = Number(row.retry_count || 0);
    if (retryCount >= 2) {
      await serviceClient
        .from("applications")
        .update({
          status: "Draft",
          canonical_stage: "draft_ready",
          provider_status: "failed",
          automation_claimed_by: null,
          automation_lease_token: null,
          automation_lease_expires_at: null,
          failure_reason: "Automation timed out after retries; saved as Draft for manual submission.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    } else {
      await serviceClient
        .from("applications")
        .update({
          provider_status: "waiting",
          automation_claimed_by: null,
          automation_lease_token: null,
          automation_lease_expires_at: null,
          retry_count: retryCount + 1,
          failure_reason: "Recovered stale runner lease; retrying.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
    recovered += 1;
  }
  return { recovered };
}

async function executeRtrvrApplicationDirect(supabase: any, applicationId: string, rtrvrApiKey: string) {
  try {
    const nowIso = new Date().toISOString();
    const leaseExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const leaseToken = crypto.randomUUID();

    // Atomic claim check: ensure exactly one runner obtains execution authority.
    // Invocations race by conditional UPDATE on un-claimed statuses ('waiting', 'queued', 'waiting_worker', 'retrying').
    const { data: claimedApp, error: claimError } = await supabase
      .from("applications")
      .update({
        provider_status: "rtrvr_running",
        canonical_stage: "queued",
        automation_claimed_by: "process-auto-apply-queue",
        automation_lease_token: leaseToken,
        automation_lease_expires_at: leaseExpiresAt,
        automation_heartbeat_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", applicationId)
      .in("provider_status", ["waiting", "queued", "waiting_worker", "retrying"])
      .select("*")
      .maybeSingle();

    if (claimError || !claimedApp) {
      console.log(`[process-auto-apply-queue] Application ${applicationId} already claimed or running by another runner. Skipping duplicate invocation.`);
      return;
    }

    const app = claimedApp;

    // Strict ownership invariant: Legacy worker row -> Node worker only.
    // Edge executor must NEVER execute legacy worker rows.
    const isEdgeOwned = app.provider_run_output?.execution_owner === "edge" || Boolean(app.provider_run_output?.application_package);
    if (!isEdgeOwned) {
      console.warn(`[process-auto-apply-queue] Application ${applicationId} is not owned by Edge executor (legacy job). Safely releasing lease.`);
      await supabase
        .from("applications")
        .update({
          provider_status: "waiting_worker",
          automation_claimed_by: null,
          automation_lease_token: null,
          automation_lease_expires_at: null,
          automation_heartbeat_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicationId)
        .eq("automation_lease_token", leaseToken);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", app.user_id)
      .maybeSingle();

    const applyUrl = app.app_url || "";
    const rtrvrQueueParams = (app.provider_run_output as any)?.queue_parameters?.rtrvr || {};
    // apply-to-jobs computes this callback URL and stores it here, but it was
    // never actually forwarded to the provider, so no status callback could
    // ever fire. `webhookUrl` is the field name this repo's own AgentPayload
    // interface (rtrvr-tools/index.ts) models for the RTRVR agent API.
    const rtrvrWebhookUrl = typeof rtrvrQueueParams.rtrvrWebhookUrl === "string"
      ? rtrvrQueueParams.rtrvrWebhookUrl.trim()
      : "";
    const rtrvrWebhookSecret = typeof rtrvrQueueParams.rtrvrWebhookSecret === "string"
      ? rtrvrQueueParams.rtrvrWebhookSecret.trim()
      : "";
    // Per the RTRVR API reference, callbacks are registered with a `webhooks`
    // array; the webhooks guide additionally documents a flat `webhookUrl`
    // shorthand. Send both -- whichever the deployed API version ignores is
    // simply dropped, and we cannot tell from the docs alone which is live.
    const webhookRegistration = rtrvrWebhookUrl
      ? {
        webhookUrl: rtrvrWebhookUrl,
        webhooks: [
          {
            url: rtrvrWebhookUrl,
            events: ["rtrvr.execution.succeeded", "rtrvr.execution.failed"],
            ...(rtrvrWebhookSecret ? { secret: rtrvrWebhookSecret } : {}),
          },
        ],
      }
      : {};
    const candidateData = rtrvrQueueParams.candidate || {};
    const candidateName = candidateData.fullName || candidateData.name || `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Candidate";
    const candidateEmail = candidateData.email || profile?.email || "";
    const candidatePhone = candidateData.phone || profile?.phone || "";
    const candidateLocation = candidateData.location || profile?.location || "";
    const candidateLinkedIn = candidateData.linkedinUrl || profile?.linkedin_url || "";
    const candidateGithub = candidateData.githubUrl || profile?.github_url || "";

    const requestedAutoSubmit =
      typeof rtrvrQueueParams.autoSubmit === "boolean"
        ? rtrvrQueueParams.autoSubmit
        : typeof (app.provider_run_output as any)?.auto_submit === "boolean"
          ? (app.provider_run_output as any).auto_submit
          : typeof (app.provider_run_output as any)?.queue_parameters?.rtrvr?.autoSubmit === "boolean"
            ? (app.provider_run_output as any).queue_parameters.rtrvr.autoSubmit
            : false;

    const requestedSubmissionMode =
      rtrvrQueueParams.submissionMode ||
      (app.provider_run_output as any)?.submission_mode ||
      (requestedAutoSubmit ? "autopilot" : "review");
    const requestedTrueAutonomy = Boolean(
      rtrvrQueueParams.trueAutonomy ??
      (app.provider_run_output as any)?.true_autonomy ??
      false
    );

    const backendSnapshot =
      (app.provider_run_output as any)?.policy_validation &&
      typeof (app.provider_run_output as any)?.policy_validation === "object"
        ? (app.provider_run_output as any).policy_validation
        : null;

    let serverEvaluationConfidence: number | null = null;
    let serverHardBlockers: number | null = null;

    if (requestedTrueAutonomy && requestedAutoSubmit) {
      // Preferred: reload authoritative record from job_evaluations
      const evalId =
        backendSnapshot?.evaluation_id ||
        (rtrvrQueueParams as any)?.evaluationId ||
        (app as any)?.evaluation_id;

      let reloadedEval: any = null;
      let evalInvalid = false;
      if (evalId) {
        if (app.user_id && app.job_id) {
          const { data, error } = await supabase
            .from("job_evaluations")
            .select("id, confidence_score, blockers, job_id, user_id")
            .eq("id", evalId)
            .eq("user_id", app.user_id)
            .eq("job_id", app.job_id)
            .maybeSingle();
          if (!error && data) {
            reloadedEval = data;
          } else {
            evalInvalid = true;
          }
        } else {
          evalInvalid = true;
        }
      }

      if (!reloadedEval && !evalInvalid && app.job_id && app.user_id) {
        const { data, error } = await supabase
          .from("job_evaluations")
          .select("id, confidence_score, blockers, job_id, user_id")
          .eq("job_id", app.job_id)
          .eq("user_id", app.user_id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!error && data) reloadedEval = data;
      }

      if (reloadedEval) {
        if (typeof reloadedEval.confidence_score === "number" && !isNaN(reloadedEval.confidence_score)) {
          serverEvaluationConfidence = reloadedEval.confidence_score;
        }
        if (Array.isArray(reloadedEval.blockers)) {
          serverHardBlockers = reloadedEval.blockers.length;
        } else if (reloadedEval.blockers && typeof reloadedEval.blockers === "object") {
          serverHardBlockers = Object.keys(reloadedEval.blockers).length;
        } else {
          serverHardBlockers = 0;
        }
      } else if (!evalInvalid && backendSnapshot && backendSnapshot.evaluated_server_side) {
        // Fallback to immutable backend-created policy snapshot
        if (typeof backendSnapshot.confidence === "number" && !isNaN(backendSnapshot.confidence)) {
          serverEvaluationConfidence = backendSnapshot.confidence;
        }
        if (backendSnapshot.blockers_evaluated) {
          serverHardBlockers =
            typeof backendSnapshot.hard_blockers === "number" && !isNaN(backendSnapshot.hard_blockers)
              ? backendSnapshot.hard_blockers
              : 0;
        } else {
          serverHardBlockers = null; // blocker evaluation was unavailable -> fails closed
        }
      } else {
        // Missing trusted server evidence: do not fall back to client claims or match_score!
        serverEvaluationConfidence = null;
        serverHardBlockers = null;
      }
    } else {
      // Normal Auto Apply or Review Mode: use queue parameters / match score
      serverEvaluationConfidence =
        typeof app.match_score === "number"
          ? app.match_score
          : rtrvrQueueParams.evaluationConfidence ??
            rtrvrQueueParams.tailoredConfidence ??
            null;
      serverHardBlockers = rtrvrQueueParams.hardBlockers ?? 0;
    }

    // Authoritative backend validation of submission policy
    const policyResult = validateSubmissionPolicy({
      targetUrl: applyUrl,
      requestedAutoSubmit,
      submissionMode: requestedSubmissionMode,
      trueAutonomy: requestedTrueAutonomy,
      tailoredConfidence: null,
      evaluationConfidence: serverEvaluationConfidence,
      jobMatchScore: null,
      hardBlockers: serverHardBlockers,
      saveAsDraftOnly: false,
    });

    const isPolicyViolation = Boolean(
      requestedAutoSubmit && !policyResult.mayFinalSubmit && policyResult.code,
    );
    let effectiveAutoSubmit = Boolean(requestedAutoSubmit && policyResult.mayFinalSubmit);

    // Consume or reconstruct canonical ApplicationPackage
    let appPackage: ApplicationPackage = (app.provider_run_output as any)?.application_package;
    if (!appPackage) {
      appPackage = {
        version: 1,
        applicationId,
        job: {
          id: app.job_id || "",
          title: app.job_title || "Application",
          company: app.company || "Unknown",
          applyUrl,
        },
        candidate: {
          userId: app.user_id,
          name: candidateName,
          email: candidateEmail,
          phone: candidatePhone,
          location: candidateLocation,
          linkedinUrl: candidateLinkedIn,
          githubUrl: candidateGithub,
        },
        resume: {
          storagePath: (rtrvrQueueParams as any)?.resume?.storagePath || undefined,
          signedUrl: (rtrvrQueueParams as any)?.resume?.signedUrl || undefined,
          text: (rtrvrQueueParams as any)?.resume?.text || undefined,
          tailored: false,
        },
        coverLetter: (rtrvrQueueParams as any)?.coverLetter ? { text: (rtrvrQueueParams as any).coverLetter, generated: false } : undefined,
        screeningAnswers: [],
        eligibilityAnswers: [],
        submissionPolicy: {
          mode: policyResult.effectiveAutomationMode,
          requestedFinalSubmit: requestedAutoSubmit,
          effectiveFinalSubmit: effectiveAutoSubmit,
          policyDecision: policyResult.mayFinalSubmit ? "approved" : "review_required",
          reasonCode: policyResult.code,
        },
        confidence: {
          jobFit: typeof app.match_score === "number" ? app.match_score : null,
          eligibility: serverEvaluationConfidence,
        },
        unresolvedRequirements: [],
        provenance: {
          generatedAt: nowIso,
        },
      };
    } else {
      appPackage.submissionPolicy.mode = policyResult.effectiveAutomationMode;
      if (policyResult.code) {
        appPackage.submissionPolicy.reasonCode = policyResult.code;
      }
    }

    // Queue-time revalidation of readiness and critical answers (Requirement 2 & 9)
    const packageReadiness = evaluatePackageReadiness(appPackage);
    if (effectiveAutoSubmit && packageReadiness.unresolvedCriticalQuestions.length > 0) {
      effectiveAutoSubmit = false;
      policyResult.mayFinalSubmit = false;
      policyResult.code = "missing_required_answer";
      policyResult.reason = `Missing required critical answers: ${packageReadiness.unresolvedCriticalQuestions.slice(0, 2).join(", ")}`;
    }

    // Queue-time policy revalidation MUST override any stale serialized package permissions
    appPackage.submissionPolicy.effectiveFinalSubmit = effectiveAutoSubmit;
    if (policyResult.code) {
      appPackage.submissionPolicy.reasonCode = policyResult.code;
    }

    // Fresh signed URL resolution from durable storage metadata (Requirement 5)
    let freshResumeSignedUrl: string | undefined = undefined;
    const resumeStoragePath = appPackage.resume?.storagePath || (rtrvrQueueParams as any)?.resume?.storagePath;
    if (resumeStoragePath) {
      try {
        const { data: signedData, error: signedErr } = await supabase.storage
          .from("resumes")
          .createSignedUrl(resumeStoragePath, 3600);
        if (!signedErr && signedData?.signedUrl) {
          freshResumeSignedUrl = signedData.signedUrl;
        }
      } catch (storageErr) {
        console.warn("[process-auto-apply-queue] fresh signed URL generation failed:", storageErr);
      }
    }
    if (!freshResumeSignedUrl && (appPackage.resume?.signedUrl || (rtrvrQueueParams as any)?.resume?.signedUrl)) {
      freshResumeSignedUrl = appPackage.resume?.signedUrl || (rtrvrQueueParams as any)?.resume?.signedUrl;
    }

    const packagePrompt = buildRtrvrPromptFromPackage(appPackage, freshResumeSignedUrl);
    const prompt = [
      packagePrompt,
      `Instructions:`,
      `- Navigate to the job application URL.`,
      `- Fill in the application fields accurately using the candidate's verified information.`,
      `- If resume upload is present, attach the candidate's resume.`,
      `- If 2FA, CAPTCHA, or custom account login is required, report waiting_for_user.`,
      effectiveAutoSubmit ? `- Complete and submit the application.` : `- Fill and prepare the form, but do not click final submit (save draft).`,
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
        ...webhookRegistration,
      }),
    });

    const result = await rtrvrRes.json().catch(() => ({}));
    const finishedAt = new Date().toISOString();
    const currentRetries = Number(app.retry_count || 0);

    // applications.run_id was previously left null forever, which silently
    // disabled both async fallbacks: skyvern-webhook correlates on
    // .eq("run_id", runId) and sync-provider-status resolves
    // `runId || appRow.run_id`. Neither could ever match. Capture whatever
    // identifier the provider returns so those paths can reconcile a run whose
    // direct write-back did not land.
    // RTRVR identifies a run as `requestId` in its webhook payload, and the
    // agent response carries a `run` object. Check those first; the remaining
    // names are defensive across provider/API versions.
    const providerRunId = [
      (result as any)?.requestId,
      (result as any)?.request_id,
      (result as any)?.run?.id,
      (result as any)?.run?.run_id,
      (result as any)?.run?.requestId,
      (result as any)?.run_id,
      (result as any)?.runId,
      (result as any)?.trajectory_id,
      (result as any)?.task_id,
      (result as any)?.taskId,
      (result as any)?.agent_run_id,
      (result as any)?.id,
    ].find((value) => typeof value === "string" && value.trim().length > 0) as
      | string
      | undefined;
    const runIdPatch = providerRunId ? { run_id: providerRunId } : {};

    if (rtrvrRes.ok) {
      const isWaitingForUser =
        result?.status === "waiting_for_user" ||
        Boolean(result?.unresolvedQuestion) ||
        result?.reason === "missing_required_answer" ||
        result?.reason === "waiting_for_captcha" ||
        result?.reason === "waiting_for_2fa" ||
        result?.reason === "waiting_for_login";

      const unresolvedQ = result?.unresolvedQuestion;
      if (unresolvedQ?.questionText) {
        const reqCategory = normalizeQuestionCategory(unresolvedQ.category, unresolvedQ.questionText);
        const reqId = unresolvedQ.requirementId || `req_${crypto.randomUUID().slice(0, 8)}`;
        const inputType: RequirementInputType = unresolvedQ.inputType || (
          ["sponsorship", "work_authorization", "relocation", "security_clearance", "legal"].includes(reqCategory)
            ? "boolean"
            : reqCategory === "salary"
              ? "number"
              : (unresolvedQ.allowedOptions && unresolvedQ.allowedOptions.length > 0)
                ? "select"
                : "text"
        );

        const runtimeAns: ApplicationAnswer = {
          requirementId: reqId,
          questionKey: reqId,
          questionText: unresolvedQ.questionText,
          value: null,
          category: reqCategory,
          provenance: { source: "user_answer" },
          confidence: 0,
          mutable: true,
          requiresUserInput: true,
          inputType,
          allowedOptions: unresolvedQ.allowedOptions,
        };

        const existingAnsIdx = appPackage.screeningAnswers.findIndex(
          (a) => a.requirementId === reqId || a.questionText === unresolvedQ.questionText,
        );
        if (existingAnsIdx >= 0) {
          appPackage.screeningAnswers[existingAnsIdx] = {
            ...appPackage.screeningAnswers[existingAnsIdx],
            requirementId: reqId,
            category: reqCategory,
            inputType,
            requiresUserInput: true,
          };
        } else {
          appPackage.screeningAnswers.push(runtimeAns);
        }

        const existingReqIdx = appPackage.unresolvedRequirements.findIndex(
          (r) => r.requirementId === reqId || r.id === reqId || r.title === unresolvedQ.questionText,
        );
        if (existingReqIdx >= 0) {
          appPackage.unresolvedRequirements[existingReqIdx] = {
            ...appPackage.unresolvedRequirements[existingReqIdx],
            requirementId: reqId,
            category: isCriticalAnswerCategory(reqCategory) || reqCategory === "unknown" ? "hard_disqualifier" : "uncertain_requirement",
            title: unresolvedQ.questionText,
            requiresUserInput: true,
            resolved: false,
            inputType,
            allowedOptions: unresolvedQ.allowedOptions,
          };
        } else {
          appPackage.unresolvedRequirements.push({
            id: reqId,
            requirementId: reqId,
            category: isCriticalAnswerCategory(reqCategory) || reqCategory === "unknown" ? "hard_disqualifier" : "uncertain_requirement",
            title: unresolvedQ.questionText,
            detail: `Mandatory question encountered at runtime${unresolvedQ.currentStep ? ` on step: ${unresolvedQ.currentStep}` : ""}`,
            requiresUserInput: true,
            resolved: false,
            inputType,
            allowedOptions: unresolvedQ.allowedOptions,
          });
        }
      }

      const waitingReason: ApplicationReasonCode | null = isWaitingForUser
        ? (result?.reason as ApplicationReasonCode) || (unresolvedQ ? "missing_required_answer" : "waiting_for_login")
        : null;

      const isDraftOnly = !effectiveAutoSubmit || result?.status === "prepared";
      const failureReasonPatch = isWaitingForUser
        ? { failure_reason: `Action required: ${waitingReason}` }
        : isPolicyViolation
          ? { failure_reason: `${policyResult.code}: ${policyResult.reason}` }
          : {};

      const nextLifecycleState: LifecycleState = isWaitingForUser
        ? "waiting_for_user"
        : isDraftOnly
          ? "prepared"
          : "submitted";

      const nextReasonCode: ApplicationReasonCode | null = isWaitingForUser
        ? waitingReason
        : isPolicyViolation
          ? (policyResult.code as ApplicationReasonCode)
          : isDraftOnly
            ? "user_selected_review"
            : null;

      const updatedProviderRunOutput = {
        ...(app.provider_run_output && typeof app.provider_run_output === "object" ? app.provider_run_output : {}),
        execution_owner: "edge",
        application_package: appPackage,
        lifecycle_state: nextLifecycleState,
        reason_code: nextReasonCode,
        submission_mode: policyResult.effectiveAutomationMode,
        rtrvr_result: result,
      };

      if (isWaitingForUser) {
        await supabase
          .from("applications")
          .update({
            ...runIdPatch,
            ...failureReasonPatch,
            status: "Draft",
            canonical_stage: "draft_ready",
            provider_status: "waiting_for_user",
            applied_date: finishedAt,
            updated_at: finishedAt,
            automation_heartbeat_at: finishedAt,
            automation_claimed_by: null,
            automation_lease_token: null,
            automation_lease_expires_at: null,
            provider_run_output: updatedProviderRunOutput,
          })
          .eq("id", applicationId);
      } else {
        await supabase
          .from("applications")
          .update({
            ...runIdPatch,
            ...failureReasonPatch,
            status: isDraftOnly ? "Draft" : "Applied",
            canonical_stage: isDraftOnly ? "draft_ready" : "submitted",
            provider_status: isDraftOnly ? "prepared" : "succeeded",
            applied_date: finishedAt,
            updated_at: finishedAt,
            automation_heartbeat_at: finishedAt,
            automation_claimed_by: null,
            automation_lease_token: null,
            automation_lease_expires_at: null,
            provider_run_output: updatedProviderRunOutput,
          })
          .eq("id", applicationId);
      }

      console.log(JSON.stringify({
        event: "auto_apply_executed",
        application_id: applicationId,
        job_id: app.job_id,
        application_package_version: appPackage.version,
        automation_mode: appPackage.submissionPolicy.mode,
        provider: "rtrvr",
        provider_run_id: providerRunId || null,
        final_stage: isDraftOnly ? "draft_ready" : "submitted",
        lifecycle_state: nextLifecycleState,
        reason_code: nextReasonCode,
      }));

      if (app.job_id) {
        await supabase
          .from("jobs")
          .update({
            canonical_status: isDraftOnly ? "draft_ready" : "submitted",
            updated_at: finishedAt,
          })
          .eq("id", app.job_id)
          .eq("user_id", app.user_id);
      }

      try {
        await createNotificationRecord(supabase, {
          userId: app.user_id,
          type: "application",
          title: isWaitingForUser
            ? `Action Required: ${app.job_title}`
            : isDraftOnly
              ? `Draft Prepared: ${app.job_title}`
              : `Application Submitted: ${app.job_title}`,
          message: isWaitingForUser
            ? `Your application for ${app.job_title} at ${app.company} requires your input (${waitingReason}). Please review and provide the required answer.`
            : isDraftOnly
              ? (isPolicyViolation
                  ? `Your application for ${app.job_title} at ${app.company} was filled and saved as draft because ${policyResult.reason}.`
                  : `Your application for ${app.job_title} at ${app.company} is filled and ready for your final review.`)
              : `Your application for ${app.job_title} at ${app.company} was submitted successfully via cloud automation.`,
          priority: isWaitingForUser || isPolicyViolation ? "high" : "medium",
          source: "automation",
          sourceRecordId: applicationId,
          sourceRecordType: "application",
          actionUrl: "/dashboard/applications",
          actionLabel: isWaitingForUser ? "Provide Answer" : isDraftOnly ? "Review Draft" : "View Application",
        });
      } catch (e) {
        console.warn("[process-auto-apply-queue] notification failed:", e);
      }
    } else {
      console.warn("[process-auto-apply-queue] RTRVR execution result:", rtrvrRes.status, result);
      const isCreditExhausted =
        rtrvrRes.status === 402 ||
        /credit balance is 0|insufficient credits|add credits/i.test(
          String(result?.error || result?.message || ""),
        );
      const isNonRetryable =
        isPolicyViolation ||
        isCreditExhausted ||
        rtrvrRes.status === 401 ||
        rtrvrRes.status === 403 ||
        rtrvrRes.status === 404 ||
        currentRetries >= 2;

      const failureMsg = isPolicyViolation
        ? `Policy validation failure (${policyResult.code}: ${policyResult.reason}). Saved as Draft.`
        : isCreditExhausted
          ? "Cloud browser automation credits are currently depleted on RTRVR. Saved as Draft for manual submission."
          : isNonRetryable
            ? `Cloud automation error (${result?.message || result?.error || `HTTP ${rtrvrRes.status}`}). Saved as Draft for manual review.`
            : (result?.error || result?.message || "RTRVR temporary error");

      await supabase
        .from("applications")
        .update({
          ...runIdPatch,
          status: isNonRetryable ? "Draft" : "Pending",
          canonical_stage: isNonRetryable ? "draft_ready" : "queued",
          provider_status: isNonRetryable ? "failed" : "waiting",
          automation_claimed_by: null,
          automation_lease_token: null,
          automation_lease_expires_at: null,
          retry_count: currentRetries + 1,
          failure_reason: failureMsg,
          updated_at: finishedAt,
          automation_heartbeat_at: finishedAt,
        })
        .eq("id", applicationId);

      if (isNonRetryable && app.agent_run_id) {
        try {
          await supabase.rpc("settle_run_credits", {
            p_agent_run_id: app.agent_run_id,
            p_actual_credits: 0,
            p_status: "failed",
            p_failure_reason: failureMsg,
            p_receipt: { provider_status: "failed", error: failureMsg },
          });
        } catch (settleErr) {
          console.warn("[process-auto-apply-queue] credit settlement error:", settleErr);
        }
      }

      if (isNonRetryable) {
        try {
          await createNotificationRecord(supabase, {
            userId: app.user_id,
            type: "application",
            title: `Application Saved as Draft: ${app.job_title}`,
            message: `Cloud auto-apply for ${app.job_title} at ${app.company} could not complete automatically (${failureMsg}). Your application draft was preserved with full answers for manual submission.`,
            priority: "high",
            source: "automation",
            sourceRecordId: applicationId,
            sourceRecordType: "application",
            actionUrl: "/dashboard/applications",
            actionLabel: "Review Draft",
          });
        } catch (e) {
          console.warn("[process-auto-apply-queue] failure notification failed:", e);
        }
      }
    }
  } catch (err: any) {
    console.error("[process-auto-apply-queue] executeRtrvrApplicationDirect error:", err);
    await supabase
      .from("applications")
      .update({
        status: "Draft",
        canonical_stage: "draft_ready",
        provider_status: "failed",
        automation_claimed_by: null,
        automation_lease_token: null,
        automation_lease_expires_at: null,
        failure_reason: `Automation error: ${err?.message || "Unexpected exception"}. Saved as Draft.`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId);
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

    let reqBody: any = null;
    try {
      reqBody = await req.json();
    } catch {
      // non-JSON or empty body
    }

    const directAppId = typeof reqBody?.applicationId === "string" ? reqBody.applicationId.trim() : null;
    if (directAppId) {
      // Validate direct application ownership before processing.
      // Strict ownership invariant: Legacy worker row -> Node worker only.
      const { data: directApp, error: directAppErr } = await supabase
        .from("applications")
        .select("id, provider_status, provider_run_output")
        .eq("id", directAppId)
        .maybeSingle();

      if (directAppErr || !directApp) {
        return new Response(JSON.stringify({ error: "Application not found", code: "not_found" }), {
          status: 404, headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }

      const isEdgeOwned = directApp.provider_run_output?.execution_owner === "edge" || Boolean(directApp.provider_run_output?.application_package);
      if (!isEdgeOwned) {
        console.warn(`[process-auto-apply-queue] Direct execution rejected: application ${directAppId} is owned by legacy Node worker`);
        return new Response(JSON.stringify({
          error: "Legacy applications cannot be executed by Edge runner",
          code: "legacy_application_rejected",
        }), {
          status: 400, headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }

      const directPromise = executeRtrvrApplicationDirect(supabase, directAppId, rtrvrApiKey);
      if (typeof (globalThis as any).EdgeRuntime?.waitUntil === "function") {
        (globalThis as any).EdgeRuntime.waitUntil(directPromise);
      }
      await Promise.race([directPromise, new Promise((resolve) => setTimeout(resolve, 8000))]);

      return new Response(JSON.stringify({
        success: true,
        direct: true,
        applicationId: directAppId,
      }), { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

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
    const executionPromise = Promise.all(
      applicationIds.map((id) => executeRtrvrApplicationDirect(supabase, id, rtrvrApiKey))
    ).catch((err) => {
      console.error("[process-auto-apply-queue] execution batch failed", err);
    });

    // ALWAYS keep the work alive past the response. This used to be an
    // either/or: batches of 1-2 took the early race branch and never
    // registered waitUntil, so once the 8s race resolved we returned, the
    // isolate was torn down, and the in-flight RTRVR call was killed before it
    // could write back "Applied". The row stayed Pending even though the
    // submission had succeeded -- which is why this only ever bit *single*
    // auto-applies, never bulk runs.
    if (typeof (globalThis as any).EdgeRuntime?.waitUntil === "function") {
      (globalThis as any).EdgeRuntime.waitUntil(executionPromise);
    }

    // For small batches, still wait briefly so a fast run can report its final
    // state in this response. Purely an optimization now -- the work completes
    // either way.
    if (applicationIds.length > 0 && applicationIds.length <= 2) {
      await Promise.race([
        executionPromise,
        new Promise((resolve) => setTimeout(resolve, 8000)),
      ]);
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
