import type { UnifiedRunRequest } from "@rtrvr-ai/sdk";
import { RTRVR_APPLICATION_RESULT_JSON_SCHEMA } from "./schemas.js";
import type { RtrvrExecutionMode } from "./modes.js";
import type { StartApplicationInput } from "./types.js";
import { validateAutomationUrl } from "./urlSecurity.js";

const SAFE_AUTO_APPLY_RULES = [
  "Operate only on the supplied application URL and directly related ATS pages.",
  "Use only the verified candidate data supplied in this request.",
  "Never fabricate qualifications, employment history, education, authorization, dates, employers, degrees, certifications, or credentials.",
  "Never guess answers to legal, demographic, identity, disability, veteran, work-authorization, sponsorship, salary-history, criminal-history, or other sensitive questions.",
  "Upload the supplied resume when a resume upload is requested.",
  "Fill fields only when the answer is confidently supported by supplied data.",
  "Stop with status waiting_for_user when required information is missing.",
  "Stop with status waiting_for_user for CAPTCHA, TOTP, login, security verification, or identity checks.",
  "Do not change unrelated account settings, passwords, email preferences, stored profile data, or security settings.",
  "Verify important actions before taking the next step.",
  "Avoid duplicate submissions. If the page indicates the user already applied, report waiting_for_user or completed with evidence instead of resubmitting.",
];

function submissionPolicy(autoSubmit: boolean): string {
  if (!autoSubmit) {
    return [
      "Submission policy: auto-submit is disabled.",
      "Fill and prepare the application, but stop before the final irreversible submit action.",
      "Return status prepared and submitted false when the form is ready for review.",
    ].join("\n");
  }

  return [
    "Submission policy: auto-submit is enabled.",
    "Submit only after all required fields are validated and no unresolved legal, identity, security, or sensitive questions remain.",
    "After submission, capture confirmation text, confirmation number, or final confirmation URL when visible.",
  ].join("\n");
}

export function buildSafeAutoApplyPrompt(input: StartApplicationInput): string {
  const jobLabel = [input.job.title, input.job.company].filter(Boolean).join(" at ");
  return [
    "You are JobRaker's governed job-application automation provider.",
    jobLabel ? `Target role: ${jobLabel}.` : "Target role: provided in structured data.",
    ...SAFE_AUTO_APPLY_RULES.map((rule) => `- ${rule}`),
    submissionPolicy(input.autoSubmit),
    "Return only data matching the provided structured-output schema.",
  ].join("\n");
}

function compactRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, nested]) => {
      if (nested == null) return false;
      if (Array.isArray(nested)) return nested.length > 0;
      if (typeof nested === "object") return Object.keys(nested).length > 0;
      if (typeof nested === "string") return nested.trim().length > 0;
      return true;
    }),
  );
}

export function buildRtrvrApplicationRequest(
  input: StartApplicationInput,
  mode: RtrvrExecutionMode,
): UnifiedRunRequest {
  const applicationUrl = validateAutomationUrl(input.applicationUrl).toString();
  const recordingContext =
    typeof input.metadata?.rtrvrRecordingContext === "string" &&
    input.metadata.rtrvrRecordingContext.trim().length > 0
      ? input.metadata.rtrvrRecordingContext.trim()
      : undefined;
  const files = input.resume?.signedUrl
    ? [
        {
          displayName: input.resume.fileName || "resume",
          uri: input.resume.signedUrl,
          mimeType: input.resume.mimeType || "application/pdf",
        },
      ]
    : undefined;

  const webhooks =
    input.rtrvrWebhookUrl && input.rtrvrWebhookSecret
      ? [
          {
            url: input.rtrvrWebhookUrl,
            events: ["tool_complete", "workflow_complete"],
            auth: { type: "bearer" as const, token: input.rtrvrWebhookSecret },
          },
        ]
      : undefined;

  return {
    input: buildSafeAutoApplyPrompt(input),
    urls: [applicationUrl],
    target: mode.target,
    preferExtension: mode.preferExtension,
    requireLocalSession: mode.requireLocalSession,
    deviceId: mode.deviceId,
    schema: RTRVR_APPLICATION_RESULT_JSON_SCHEMA as unknown as Record<string, unknown>,
    files,
    fileUrls: input.resume?.signedUrl ? [input.resume.signedUrl] : undefined,
    dataInputs: [
      compactRecord({
        applicationId: input.applicationId,
        idempotencyKey: input.idempotencyKey,
        job: input.job,
        candidate: input.candidate,
        resumeText: input.resume?.text || undefined,
        resumeExpiresAt: input.resume?.expiresAt || undefined,
        coverLetter: input.coverLetter || undefined,
        autoSubmit: input.autoSubmit,
      }),
    ],
    response: {
      verbosity: "steps",
      inlineOutputMaxBytes: 50_000,
    },
    webhooks,
    trajectoryId: input.agentRunId || input.applicationId,
    phase: input.attemptNumber,
    recordingContext,
    options: {
      ui: { emitEvents: true },
    },
  };
}
