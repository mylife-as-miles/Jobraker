/**
 * Canonical ApplicationPackage and Auto Apply Architecture Models
 *
 * Core Tenet:
 * "Jobraker decides WHAT to submit. RTRVR decides HOW to submit it."
 *
 * RTRVR is a browser executor and form filler. It must never invent
 * candidate facts, guess legal/sponsorship/salary answers, or make
 * strategic qualification decisions.
 */

export type AutomationMode = "review" | "autopilot" | "autopilot_strict";

export interface LegacyAutomationFlags {
  autoSubmit: boolean;
  submissionMode: "review" | "autopilot";
  trueAutonomy: boolean;
}

export function mapAutomationModeToLegacyFlags(mode: AutomationMode): LegacyAutomationFlags {
  switch (mode) {
    case "autopilot_strict":
      return {
        autoSubmit: true,
        submissionMode: "autopilot",
        trueAutonomy: true,
      };
    case "autopilot":
      return {
        autoSubmit: true,
        submissionMode: "autopilot",
        trueAutonomy: false,
      };
    case "review":
    default:
      return {
        autoSubmit: false,
        submissionMode: "review",
        trueAutonomy: false,
      };
  }
}

export function deriveAutomationModeFromLegacyFlags(flags: {
  autoSubmit?: boolean | null;
  submissionMode?: string | null;
  trueAutonomy?: boolean | null;
}): AutomationMode {
  if (!flags.autoSubmit || flags.submissionMode === "review") {
    return "review";
  }
  if (flags.trueAutonomy) {
    return "autopilot_strict";
  }
  return "autopilot";
}


export type ApplicationAnswerCategory =
  | "general"
  | "experience"
  | "work_authorization"
  | "sponsorship"
  | "salary"
  | "security_clearance"
  | "relocation"
  | "prior_employment"
  | "legal"
  | "unknown";

export type ApplicationAnswerSource =
  | "candidate_profile"
  | "resume"
  | "user_answer"
  | "verified_memory"
  | "generated";

export type RequirementInputType = "boolean" | "select" | "number" | "text";

export interface ApplicationAnswer {
  requirementId?: string;
  questionKey?: string;
  questionText: string;
  value: string | number | boolean | null;
  category: ApplicationAnswerCategory;
  provenance: {
    source: ApplicationAnswerSource;
    sourceId?: string;
    retrievedAt?: string;
    mutable?: boolean;
  };
  confidence: number;
  mutable: boolean;
  requiresUserInput: boolean;
  inputType?: RequirementInputType;
  allowedOptions?: string[];
}

export const CRITICAL_ANSWER_CATEGORIES: readonly ApplicationAnswerCategory[] = [
  "work_authorization",
  "sponsorship",
  "salary",
  "security_clearance",
  "relocation",
  "prior_employment",
  "legal",
  "unknown",
] as const;

export function isCriticalAnswerCategory(category: ApplicationAnswerCategory): boolean {
  return (CRITICAL_ANSWER_CATEGORIES as readonly string[]).includes(category);
}

export type LifecycleState =
  | "prepared"
  | "needs_review"
  | "waiting_for_user"
  | "queued"
  | "running"
  | "submitted"
  | "failed";

export type ApplicationReasonCode =
  | "user_selected_review"
  | "policy_review_required"
  | "missing_required_answer"
  | "waiting_for_login"
  | "waiting_for_captcha"
  | "waiting_for_2fa"
  | "automation_failed"
  | "automation_timeout"
  | "evaluation_failed"
  | "submission_uncertain"
  | "hard_eligibility_blocker"
  | "true_autonomy_untrusted_source"
  | "true_autonomy_confidence_below_threshold"
  | "true_autonomy_hard_blocker"
  | "true_autonomy_missing_policy_data";

export interface ApplicationRequirement {
  id?: string;
  requirementId?: string;
  category: "hard_disqualifier" | "uncertain_requirement" | "low_strategic_value" | "eligible" | ApplicationAnswerCategory;
  title: string;
  detail?: string;
  resolved: boolean;
  requiresUserInput: boolean;
  inputType?: RequirementInputType;
  allowedOptions?: string[];
  required?: boolean;
}

export interface SubmissionReadiness {
  jobFitConfidence: number | null;
  eligibilityConfidence: number | null;
  candidateDataCompleteness: number | null;
  applicationAnswerConfidence: number | null;
  hardBlockers: string[];
  unresolvedCriticalQuestions: string[];
}

export const TRUSTED_CRITICAL_ANSWER_SOURCES = [
  "candidate_profile",
  "user_answer",
  "verified_memory",
  "resume",
] as const;

export const TRUSTED_SOURCES_BY_CATEGORY: Record<
  ApplicationAnswerCategory,
  readonly ApplicationAnswerSource[]
> = {
  work_authorization: [
    "user_answer",
    "candidate_profile",
    "verified_memory",
  ],
  sponsorship: [
    "user_answer",
    "candidate_profile",
    "verified_memory",
  ],
  salary: [
    "user_answer",
    "candidate_profile",
    "verified_memory",
  ],
  relocation: [
    "user_answer",
    "candidate_profile",
    "verified_memory",
  ],
  legal: [
    "user_answer",
    "candidate_profile",
  ],
  security_clearance: [
    "user_answer",
    "candidate_profile",
    "verified_memory",
    "resume",
  ],
  prior_employment: [
    "user_answer",
    "candidate_profile",
    "resume",
  ],
  experience: [
    "user_answer",
    "candidate_profile",
    "verified_memory",
    "resume",
  ],
  general: [
    "user_answer",
    "candidate_profile",
    "verified_memory",
    "resume",
    "generated",
  ],
  unknown: [
    "user_answer",
    "candidate_profile",
  ],
};

/**
 * Normalizes question category preserving critical categories.
 * Fails closed to "unknown" rather than "general" if ambiguous.
 */
export function normalizeQuestionCategory(
  category?: string | null,
  questionText?: string | null,
): ApplicationAnswerCategory {
  const cat = (category || "").trim().toLowerCase();
  if (cat === "work_authorization" || cat === "work authorization" || cat === "work-authorization") return "work_authorization";
  if (cat === "sponsorship" || cat === "visa" || cat === "visa_sponsorship" || cat === "visasponsorship") return "sponsorship";
  if (cat === "salary" || cat === "compensation") return "salary";
  if (cat === "security_clearance" || cat === "clearance") return "security_clearance";
  if (cat === "relocation") return "relocation";
  if (cat === "prior_employment" || cat === "employment_history") return "prior_employment";
  if (cat === "legal" || cat === "criminal" || cat === "disciplinary") return "legal";
  if (cat === "experience") return "experience";
  if (cat === "general") return "general";

  if (questionText) {
    const q = questionText.toLowerCase();
    if (/sponsorship|visa/i.test(q)) return "sponsorship";
    if (/authorized to work|legal right to work|legally authorized|work permit/i.test(q)) return "work_authorization";
    if (/salary|compensation|hourly rate|pay expectation|desired pay/i.test(q)) return "salary";
    if (/clearance|polygraph/i.test(q)) return "security_clearance";
    if (/relocat/i.test(q)) return "relocation";
    if (/felon|misdemeanor|non-compete|convict/i.test(q)) return "legal";
    if (/previously employed|worked for.*before/i.test(q)) return "prior_employment";
    if (/years of experience|how many years/i.test(q)) return "experience";
  }

  return "unknown";
}

export interface AnswerValidationResult {
  valid: boolean;
  normalizedValue?: string | number | boolean;
  error?: string;
}

/**
 * Validates answer values against requirement metadata.
 */
export function validateAnswerValue(
  requirement: {
    inputType?: RequirementInputType;
    allowedOptions?: string[];
    category?: string;
    required?: boolean;
    questionText?: string;
  },
  rawValue: unknown,
): AnswerValidationResult {
  if (rawValue === null || rawValue === undefined) {
    return { valid: false, error: "Answer value cannot be null or undefined" };
  }

  const strValue = String(rawValue).trim();
  if (!strValue && requirement.required !== false) {
    return { valid: false, error: "Required answer cannot be empty" };
  }

  const inputType: RequirementInputType = requirement.inputType || (
    ["sponsorship", "work_authorization", "relocation", "security_clearance", "legal"].includes(requirement.category || "")
      ? "boolean"
      : requirement.category === "salary"
        ? "number"
        : (requirement.allowedOptions && requirement.allowedOptions.length > 0)
          ? "select"
          : "text"
  );

  if (inputType === "boolean") {
    const lower = strValue.toLowerCase();
    if (["yes", "y", "true", "1"].includes(lower)) {
      return { valid: true, normalizedValue: "Yes" };
    }
    if (["no", "n", "false", "0"].includes(lower)) {
      return { valid: true, normalizedValue: "No" };
    }
    return {
      valid: false,
      error: `Invalid boolean answer "${strValue}". Allowed values are 'Yes' or 'No'.`,
    };
  }

  if (inputType === "select") {
    const options = requirement.allowedOptions || [];
    if (options.length > 0) {
      const match = options.find((opt) => opt.toLowerCase() === strValue.toLowerCase());
      if (!match) {
        return {
          valid: false,
          error: `Invalid selection "${strValue}". Must be one of: ${options.join(", ")}.`,
        };
      }
      return { valid: true, normalizedValue: match };
    }
  }

  if (inputType === "number") {
    const cleaned = strValue.replace(/[\$,]/g, "").trim();
    const isNum = /^[0-9]+(\.[0-9]+)?(\s*-\s*[0-9]+(\.[0-9]+)?)?k?$/i.test(cleaned);
    if (!isNum) {
      return {
        valid: false,
        error: `Invalid numeric/salary format "${strValue}". Expected number or range (e.g. 120000 or 120k).`,
      };
    }
    return { valid: true, normalizedValue: strValue };
  }

  if (!strValue && requirement.required !== false) {
    return { valid: false, error: "Required answer cannot be empty" };
  }

  return { valid: true, normalizedValue: strValue };
}

export function isTrustedSourceForCategory(
  category: ApplicationAnswerCategory,
  source?: ApplicationAnswerSource | null,
): boolean {
  if (!source) return false;
  if (source === "generated" && isCriticalAnswerCategory(category)) {
    return false;
  }
  const allowed = TRUSTED_SOURCES_BY_CATEGORY[category];
  if (!allowed) {
    return !isCriticalAnswerCategory(category);
  }
  return (allowed as readonly string[]).includes(source);
}

export interface ApplicationPackage {
  version: number;
  applicationId: string;
  job: {
    id: string;
    title: string;
    company: string;
    applyUrl: string;
    source?: string;
  };
  candidate: {
    userId: string;
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedinUrl?: string;
    githubUrl?: string;
  };
  resume: {
    resumeId?: string;
    storagePath?: string;
    fileName?: string;
    mimeType?: string;
    fileHash?: string;
    text?: string;
    tailored: boolean;
    signedUrl?: string;
  };
  coverLetter?: {
    text: string;
    generated: boolean;
  };
  screeningAnswers: ApplicationAnswer[];
  eligibilityAnswers: ApplicationAnswer[];
  submissionPolicy: {
    mode: AutomationMode;
    requestedFinalSubmit: boolean;
    effectiveFinalSubmit: boolean;
    policyDecision?: string;
    reasonCode?: ApplicationReasonCode;
  };
  confidence: {
    jobFit?: number | null;
    eligibility?: number | null;
    candidateDataCompleteness?: number | null;
    applicationAnswerConfidence?: number | null;
  };
  unresolvedRequirements: ApplicationRequirement[];
  provenance: {
    evaluationId?: string | null;
    resumeId?: string | null;
    generatedAt: string;
  };
}

/**
 * Builds the explicit prompt for RTRVR from an ApplicationPackage.
 * Strictly enforces that RTRVR operates only as a browser executor.
 * Accepts an optional freshSignedUrl generated right before execution.
 */
export function buildRtrvrPromptFromPackage(
  pkg: ApplicationPackage,
  freshSignedUrl?: string,
): string {
  const candidate = pkg.candidate;
  const policy = pkg.submissionPolicy;
  const resumeUrl = freshSignedUrl || pkg.resume.signedUrl;

  const lines: string[] = [
    `You are JobRaker's governed auto-apply execution agent for role "${pkg.job.title}" at "${pkg.job.company}".`,
    `Target Application URL: ${pkg.job.applyUrl}`,
    ``,
    `Candidate Verified Details:`,
    `- Full Name: ${candidate.name || "Candidate"}`,
    `- Email: ${candidate.email || ""}`,
    `- Phone: ${candidate.phone || ""}`,
    `- Location: ${candidate.location || ""}`,
    `- LinkedIn: ${candidate.linkedinUrl || ""}`,
    `- GitHub: ${candidate.githubUrl || ""}`,
    ``,
    `Resume Attachment:`,
    resumeUrl
      ? `- Resume Document URL: ${resumeUrl}`
      : `- Resume: Use candidate's primary resume file on file.`,
  ];

  if (pkg.coverLetter?.text) {
    lines.push(
      ``,
      `Cover Letter:`,
      `"""`,
      pkg.coverLetter.text.trim(),
      `"""`,
    );
  }

  const allAnswers = [...pkg.eligibilityAnswers, ...pkg.screeningAnswers];
  if (allAnswers.length > 0) {
    lines.push(``, `Authoritative Application Answers:`);
    for (const ans of allAnswers) {
      if (ans.value !== null && ans.value !== undefined) {
        lines.push(
          `- [${ans.category}] "${ans.questionText}": ${String(ans.value)} (source: ${ans.provenance.source})`,
        );
      }
    }
  }

  lines.push(
    ``,
    `STRICT EXECUTION CONSTRAINTS:`,
    `1. Use ONLY the verified candidate information and answers supplied above.`,
    `2. NEVER invent, hallucinate, or guess candidate facts, salary requirements, visa sponsorship needs, security clearances, relocation preferences, or legal attestations.`,
    `3. If an application requires a mandatory question for which no approved answer is provided above, STOP immediately, DO NOT guess or submit, and return waiting_for_user with structured output:`,
    `   { "status": "waiting_for_user", "reason": "missing_required_answer", "unresolvedQuestion": { "questionText": "<exact text of question>", "category": "<work_authorization|sponsorship|salary|security_clearance|relocation|prior_employment|legal|experience|general>", "currentStep": "<page or step title if available>" } }`,
    `4. If CAPTCHA, two-factor authentication (2FA/TOTP), or mandatory login is encountered, STOP and return waiting_for_user with:`,
    `   { "status": "waiting_for_user", "reason": "waiting_for_captcha|waiting_for_2fa|waiting_for_login" }`,
  );

  if (policy.effectiveFinalSubmit) {
    lines.push(
      `5. FINAL SUBMISSION AUTHORIZED: Complete the application form, verify fields, and click the final Submit button.`,
    );
  } else {
    lines.push(
      `5. FINAL SUBMISSION PROHIBITED (Review Mode): Fill and prepare the application form, but DO NOT click final submit. Stop at the final review screen or save as draft.`,
    );
  }

  return lines.join("\n");
}

/**
 * Validates whether an ApplicationPackage has unresolved critical questions
 * or hard disqualifiers before submission.
 * Enforces that critical categories cannot use unverified or "generated" sources.
 */
export function evaluatePackageReadiness(pkg: ApplicationPackage): SubmissionReadiness {
  const allAnswers = [...(pkg.eligibilityAnswers || []), ...(pkg.screeningAnswers || [])];
  const unresolvedQuestions: string[] = [];

  for (const ans of allAnswers) {
    const isCritical = isCriticalAnswerCategory(ans.category);
    const hasValue = ans.value !== null && ans.value !== undefined && ans.value !== "";
    const isUntrustedSource = !isTrustedSourceForCategory(ans.category, ans.provenance?.source);

    if (ans.requiresUserInput || (isCritical && (!hasValue || isUntrustedSource))) {
      unresolvedQuestions.push(ans.questionText);
      ans.requiresUserInput = true;
    }
  }

  for (const req of pkg.unresolvedRequirements || []) {
    const isResolved = Boolean(req.resolved);
    const requiresInput = Boolean(req.requiresUserInput);
    if ((requiresInput || !isResolved) && !isResolved) {
      unresolvedQuestions.push(req.title);
    }
  }

  const hardBlockers = (pkg.unresolvedRequirements || [])
    .filter((req) => req.category === "hard_disqualifier" && !Boolean(req.resolved))
    .map((req) => req.title);

  return {
    jobFitConfidence: pkg.confidence?.jobFit ?? null,
    eligibilityConfidence: pkg.confidence?.eligibility ?? null,
    candidateDataCompleteness: pkg.confidence?.candidateDataCompleteness ?? null,
    applicationAnswerConfidence: pkg.confidence?.applicationAnswerConfidence ?? null,
    hardBlockers: Array.from(new Set(hardBlockers)),
    unresolvedCriticalQuestions: Array.from(new Set(unresolvedQuestions)),
  };
}

export interface ResolvedApplicationLifecycle {
  state: LifecycleState;
  reasonCode: ApplicationReasonCode | null;
  submissionMode: AutomationMode;
  isTerminal: boolean;
  requiresAction: boolean;
  source: "provider_run_output" | "legacy_fields";
}

/**
 * Canonical application lifecycle resolver.
 * Precedence:
 * 1. Modern provider_run_output (lifecycle_state, reason_code, submission_mode)
 * 2. Legacy fields (status, canonical_stage, provider_status, failure_reason)
 */
export function resolveApplicationLifecycle(
  application: Record<string, any>,
): ResolvedApplicationLifecycle {
  const runOutput = application?.provider_run_output;
  const newLifecycleState = runOutput?.lifecycle_state as LifecycleState | undefined;
  const newReasonCode = (runOutput?.reason_code || runOutput?.application_package?.submissionPolicy?.reasonCode) as ApplicationReasonCode | null;
  const newSubmissionMode = (runOutput?.application_package?.submissionPolicy?.mode ||
    runOutput?.submission_mode ||
    application?.submission_mode) as AutomationMode | undefined;

  // Precedence 1: Modern provider_run_output lifecycle model
  if (newLifecycleState) {
    return {
      state: newLifecycleState,
      reasonCode: newReasonCode || null,
      submissionMode: newSubmissionMode || "autopilot",
      isTerminal: ["submitted", "failed"].includes(newLifecycleState),
      requiresAction: ["waiting_for_user", "needs_review"].includes(newLifecycleState),
      source: "provider_run_output",
    };
  }

  // Precedence 2: Legacy fields
  const status = application?.status;
  const canonicalStage = application?.canonical_stage;
  const providerStatus = application?.provider_status;
  const failureReason = application?.failure_reason;

  let state: LifecycleState = "queued";
  let reasonCode: ApplicationReasonCode | null = null;

  if (status === "Applied" || canonicalStage === "submitted" || providerStatus === "completed" || providerStatus === "succeeded") {
    state = "submitted";
  } else if (status === "Failed" || canonicalStage === "failed" || providerStatus === "failed") {
    state = "failed";
    reasonCode = "automation_failed";
  } else if (providerStatus === "running" || providerStatus === "processing" || providerStatus === "rtrvr_running") {
    state = "running";
  } else if (providerStatus === "waiting_for_user" || failureReason?.includes("captcha") || failureReason?.includes("2fa")) {
    state = "waiting_for_user";
    reasonCode = failureReason?.includes("captcha")
      ? "waiting_for_captcha"
      : failureReason?.includes("2fa")
        ? "waiting_for_2fa"
        : "waiting_for_login";
  } else if (status === "Draft" || canonicalStage === "draft_ready" || providerStatus === "prepared") {
    state = "prepared";
    reasonCode = "user_selected_review";
  } else {
    state = "queued";
  }

  return {
    state,
    reasonCode,
    submissionMode: newSubmissionMode || (application?.auto_submit ? "autopilot" : "review"),
    isTerminal: ["submitted", "failed"].includes(state),
    requiresAction: ["waiting_for_user", "needs_review"].includes(state),
    source: "legacy_fields",
  };
}

export interface ResolveScreeningAnswerParams {
  application: any;
  requirementId: string;
  answer: unknown;
  authenticatedUserId: string;
}

export interface ResolveScreeningAnswerResult {
  success: boolean;
  status: number;
  error?: string;
  code?: string;
  appPackage?: ApplicationPackage;
  nextLifecycleState?: LifecycleState;
  nextProviderStatus?: string;
  nextCanonicalStage?: string;
  nextStatus?: string;
  effectiveFinalSubmit?: boolean;
  remainingUnresolvedCount?: number;
  unresolvedQuestions?: string[];
  updatePayload?: Record<string, any>;
}

/**
 * Core canonical business logic for resolving a screening answer.
 * Enforces ownership, requirement existence, answer value validation,
 * category preservation, canonical readiness re-evaluation, and submission mode preservation.
 */
export function resolveScreeningAnswerPayload(
  params: ResolveScreeningAnswerParams,
): ResolveScreeningAnswerResult {
  const { application: app, requirementId, answer, authenticatedUserId } = params;

  if (!authenticatedUserId) {
    return { success: false, status: 401, error: "Unauthorized", code: "unauthorized" };
  }

  if (!app) {
    return { success: false, status: 404, error: "Application not found", code: "not_found" };
  }

  if (app.user_id !== authenticatedUserId) {
    return { success: false, status: 403, error: "Forbidden: application does not belong to user", code: "forbidden" };
  }

  if (app.provider_status !== "waiting_for_user") {
    return {
      success: false,
      status: 400,
      error: `Application is not in waiting_for_user state (current: ${app.provider_status})`,
      code: "invalid_state",
    };
  }

  const pkg: ApplicationPackage = app.provider_run_output?.application_package;
  if (!pkg) {
    return {
      success: false,
      status: 400,
      error: "Application is missing an ApplicationPackage",
      code: "missing_package",
    };
  }

  // 1. Locate requirement in unresolvedRequirements and screeningAnswers
  const reqIdx = (pkg.unresolvedRequirements || []).findIndex(
    (r: any) => (r.requirementId === requirementId || r.id === requirementId) && !Boolean(r.resolved),
  );
  const ansIdx = (pkg.screeningAnswers || []).findIndex(
    (a: any) =>
      (a.requirementId === requirementId || a.questionKey === requirementId || (!a.requirementId && a.questionText === requirementId)) &&
      (a.requiresUserInput || a.value === null || a.value === undefined || a.value === ""),
  );

  if (reqIdx < 0 && ansIdx < 0) {
    return {
      success: false,
      status: 400,
      error: `Requirement "${requirementId}" not found or already resolved`,
      code: "requirement_not_found",
    };
  }

  const reqItem = reqIdx >= 0 ? pkg.unresolvedRequirements[reqIdx] : null;
  const ansItem = ansIdx >= 0 ? pkg.screeningAnswers[ansIdx] : null;
  const questionText = reqItem?.title || ansItem?.questionText || requirementId;

  // 2. Preserve authoritative category; fail closed to "unknown" rather than "general"
  const rawCategory = ansItem?.category || (typeof reqItem?.category === "string" ? reqItem.category : null);
  const targetCategory: ApplicationAnswerCategory = normalizeQuestionCategory(rawCategory, questionText);

  // 3. Validate submitted answer value
  const validation = validateAnswerValue(
    {
      inputType: reqItem?.inputType || ansItem?.inputType,
      allowedOptions: reqItem?.allowedOptions || ansItem?.allowedOptions,
      category: targetCategory,
      required: true,
      questionText,
    },
    answer,
  );

  if (!validation.valid) {
    return {
      success: false,
      status: 400,
      error: validation.error || "Invalid answer value",
      code: "invalid_answer_value",
    };
  }

  // 4. Update screeningAnswers with verified user answer
  const existingAnsIdx = (pkg.screeningAnswers || []).findIndex(
    (a: any) => a.requirementId === requirementId || a.questionKey === requirementId || a.questionText === questionText,
  );

  const updatedAnswer: ApplicationAnswer = {
    requirementId,
    questionKey: existingAnsIdx >= 0 ? pkg.screeningAnswers[existingAnsIdx].questionKey || requirementId : requirementId,
    questionText,
    value: validation.normalizedValue!,
    category: targetCategory,
    provenance: {
      source: "user_answer",
      retrievedAt: new Date().toISOString(),
      mutable: false,
    },
    confidence: 1.0,
    mutable: false,
    requiresUserInput: false,
    inputType: reqItem?.inputType || ansItem?.inputType,
    allowedOptions: reqItem?.allowedOptions || ansItem?.allowedOptions,
  };

  if (existingAnsIdx >= 0) {
    pkg.screeningAnswers[existingAnsIdx] = updatedAnswer;
  } else {
    pkg.screeningAnswers.push(updatedAnswer);
  }

  // 5. Update unresolvedRequirements
  if (reqIdx >= 0) {
    pkg.unresolvedRequirements[reqIdx] = {
      ...pkg.unresolvedRequirements[reqIdx],
      resolved: true,
      requiresUserInput: false,
    };
  } else {
    for (const r of pkg.unresolvedRequirements || []) {
      if (r.title === questionText) {
        r.resolved = true;
        r.requiresUserInput = false;
      }
    }
  }

  // 6. Canonical readiness re-evaluation
  const readiness = evaluatePackageReadiness(pkg);
  const hasRemainingBlockers = readiness.unresolvedCriticalQuestions.length > 0 || readiness.hardBlockers.length > 0;

  // 7. Mode preservation: Review mode remains review mode unconditionally
  const originalMode = pkg.submissionPolicy?.mode || "review";
  const policyDecision = originalMode === "review"
    ? "Review mode: form will be prepared but final submit prohibited"
    : hasRemainingBlockers
      ? "Unresolved questions remain"
      : "Application package ready for submission";

  pkg.submissionPolicy = {
    ...pkg.submissionPolicy,
    mode: originalMode,
    requestedFinalSubmit: originalMode !== "review",
    effectiveFinalSubmit: originalMode !== "review" && !hasRemainingBlockers,
    policyDecision,
    reasonCode: hasRemainingBlockers ? "missing_required_answer" : undefined,
  };

  const nowIso = new Date().toISOString();
  const nextLifecycleState: LifecycleState = hasRemainingBlockers ? "waiting_for_user" : "queued";
  const nextProviderStatus = hasRemainingBlockers ? "waiting_for_user" : "waiting";
  const nextCanonicalStage = hasRemainingBlockers ? "draft_ready" : "queued";
  const nextStatus = originalMode === "review" ? "Draft" : app.status === "Applied" ? "Applied" : "Pending";

  const updatedRunOutput = {
    ...(app.provider_run_output || {}),
    execution_owner: "edge",
    application_package: pkg,
    lifecycle_state: nextLifecycleState,
    reason_code: hasRemainingBlockers ? "missing_required_answer" : null,
  };

  const updatePayload: Record<string, any> = {
    provider_run_output: updatedRunOutput,
    updated_at: nowIso,
  };

  if (hasRemainingBlockers) {
    updatePayload.provider_status = "waiting_for_user";
    updatePayload.canonical_stage = "draft_ready";
    updatePayload.failure_reason = `Action required: ${readiness.unresolvedCriticalQuestions.length} requirement(s) unresolved`;
  } else {
    updatePayload.provider_status = "waiting";
    updatePayload.canonical_stage = "queued";
    updatePayload.status = nextStatus;
    updatePayload.failure_reason = null;
    updatePayload.automation_claimed_by = null;
    updatePayload.automation_lease_token = null;
    updatePayload.automation_lease_expires_at = null;
    updatePayload.automation_heartbeat_at = null;
  }

  return {
    success: true,
    status: 200,
    appPackage: pkg,
    nextLifecycleState,
    nextProviderStatus,
    nextCanonicalStage,
    nextStatus,
    effectiveFinalSubmit: pkg.submissionPolicy.effectiveFinalSubmit,
    remainingUnresolvedCount: readiness.unresolvedCriticalQuestions.length,
    unresolvedQuestions: readiness.unresolvedCriticalQuestions,
    updatePayload,
  };
}
