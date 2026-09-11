/**
 * Canonical Auto Apply & True Autonomy Policy
 *
 * Single source of truth for:
 * 1. Trusted ATS platforms (Greenhouse, Lever, Ashby)
 * 2. True Autonomy minimum confidence threshold (90)
 * 3. Autonomous submission policy validation
 */

export const TRUE_AUTONOMY_MIN_CONFIDENCE = 90;

export const TRUSTED_AUTO_APPLY_DOMAINS = [
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
] as const;

export type AutomationMode = "review" | "autopilot" | "autopilot_strict";

export type TrustedAutoApplyDomain = (typeof TRUSTED_AUTO_APPLY_DOMAINS)[number];

export type AutoApplySubmissionMode = "review" | "autopilot";

export type TrueAutonomyRejectionCode =
  | "true_autonomy_untrusted_source"
  | "true_autonomy_confidence_below_threshold"
  | "true_autonomy_hard_blocker"
  | "true_autonomy_missing_policy_data";

export interface SubmissionPolicyValidationParams {
  targetUrl?: string | null;
  automationMode?: AutomationMode | null;
  requestedAutoSubmit?: boolean;
  submissionMode?: string | null;
  trueAutonomy?: boolean | null;
  tailoredConfidence?: number | null;
  evaluationConfidence?: number | null;
  jobMatchScore?: number | null;
  hardBlockers?: number | null;
  saveAsDraftOnly?: boolean | null;
}

export interface SubmissionPolicyValidationResult {
  mayFinalSubmit: boolean;
  effectiveAutoSubmit: boolean;
  effectiveSubmissionMode: AutoApplySubmissionMode;
  effectiveAutomationMode: AutomationMode;
  autonomyConfidence: number;
  isTrustedSource: boolean;
  hardBlockers: number;
  code?: TrueAutonomyRejectionCode;
  reason?: string;
}

/**
 * Validates whether a URL belongs to a trusted ATS platform.
 * Strictly uses hostname / subdomain matching (e.g. boards.greenhouse.io is allowed,
 * evilgreenhouse.io and greenhouse.io.attacker.com are rejected).
 */
export function isTrustedAutoApplySource(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  try {
    let candidate = trimmed;
    if (!candidate.includes("://")) {
      candidate = `https://${candidate}`;
    }
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (!hostname.includes(".")) {
      return false;
    }
    return TRUSTED_AUTO_APPLY_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

/**
 * Derives autonomy confidence score following canonical priority:
 * 1. tailoredConfidence (if valid number)
 * 2. evaluationConfidence (if valid number)
 * 3. jobMatchScore (if valid number)
 * 4. 0
 */
export function extractAutonomyConfidence(scores: {
  tailoredConfidence?: number | null;
  evaluationConfidence?: number | null;
  jobMatchScore?: number | null;
}): number {
  if (
    typeof scores.tailoredConfidence === "number" &&
    !isNaN(scores.tailoredConfidence)
  ) {
    return scores.tailoredConfidence;
  }
  if (
    typeof scores.evaluationConfidence === "number" &&
    !isNaN(scores.evaluationConfidence)
  ) {
    return scores.evaluationConfidence;
  }
  if (
    typeof scores.jobMatchScore === "number" &&
    !isNaN(scores.jobMatchScore)
  ) {
    return scores.jobMatchScore;
  }
  return 0;
}

/**
 * Authoritative submission-policy validation.
 *
 * When an application requests autonomous final submission (auto_submit: true,
 * submission_mode: "autopilot", or true_autonomy: true), backend execution
 * independently validates:
 * 1. targetUrl is an approved trusted ATS (isTrustedAutoApplySource)
 * 2. zero hard blockers (hardBlockers === 0)
 * 3. confidence score is present and >= TRUE_AUTONOMY_MIN_CONFIDENCE (90)
 *
 * If ANY requirement is not established, final submission is DENIED
 * (mayFinalSubmit: false, effectiveAutoSubmit: false), and a machine-readable
 * code is returned.
 *
 * In ordinary review mode (requestedAutoSubmit: false, submission_mode: "review"),
 * review-before-submit workflows are allowed across all sources.
 */
export function validateSubmissionPolicy(
  params: SubmissionPolicyValidationParams,
): SubmissionPolicyValidationResult {
  const explicitMode = params.automationMode;
  const requestedAutoSubmit =
    explicitMode === "review"
      ? false
      : explicitMode === "autopilot" || explicitMode === "autopilot_strict"
        ? true
        : params.requestedAutoSubmit === true;

  const trueAutonomy =
    explicitMode === "autopilot_strict"
      ? true
      : explicitMode === "autopilot" || explicitMode === "review"
        ? false
        : params.trueAutonomy === true;

  const {
    targetUrl,
    submissionMode: _submissionMode,
    tailoredConfidence,
    evaluationConfidence,
    jobMatchScore,
    hardBlockers,
    saveAsDraftOnly = false,
  } = params;

  const isTrusted = isTrustedAutoApplySource(targetUrl);
  const autonomyConfidence = extractAutonomyConfidence({
    tailoredConfidence,
    evaluationConfidence,
    jobMatchScore,
  });

  const hasExplicitBlockerEvaluation =
    typeof hardBlockers === "number" && !isNaN(hardBlockers);
  const effectiveBlockers = hasExplicitBlockerEvaluation
    ? Math.max(0, hardBlockers)
    : 0;

  // 1. ABSOLUTE SUBMISSION AUTHORITY CHECK:
  // User consent for final submission (requestedAutoSubmit) is an absolute boundary.
  // Neither submissionMode nor trueAutonomy may ever authorize submission if requestedAutoSubmit is false/falsy.
  // If saveAsDraftOnly is requested or requestedAutoSubmit is not explicitly true, final submit is DENIED.
  if (saveAsDraftOnly || requestedAutoSubmit !== true) {
    return {
      mayFinalSubmit: false,
      effectiveAutoSubmit: false,
      effectiveSubmissionMode: "review",
      effectiveAutomationMode: "review",
      autonomyConfidence,
      isTrustedSource: isTrusted,
      hardBlockers: effectiveBlockers,
      reason: saveAsDraftOnly ? "saved as draft for review" : undefined,
    };
  }

  // 2. ORDINARY AUTO APPLY (Final Submit ON, True Autonomy OFF):
  // When True Autonomy is not enabled, preserve ordinary Auto Apply final-submit behavior.
  // Do not impose True Autonomy constraints (trusted ATS, >=90 confidence, verified 0 blockers).
  if (trueAutonomy !== true) {
    return {
      mayFinalSubmit: true,
      effectiveAutoSubmit: true,
      effectiveSubmissionMode: "autopilot",
      effectiveAutomationMode: "autopilot",
      autonomyConfidence,
      isTrustedSource: isTrusted,
      hardBlockers: effectiveBlockers,
    };
  }

  // 3. TRUE AUTONOMY POLICY (Final Submit ON && True Autonomy ON):
  // Strictly enforce:
  // a) Target URL must be present
  if (!targetUrl || typeof targetUrl !== "string" || !targetUrl.trim()) {
    return {
      mayFinalSubmit: false,
      effectiveAutoSubmit: false,
      effectiveSubmissionMode: "review",
      effectiveAutomationMode: "review",
      autonomyConfidence,
      isTrustedSource: false,
      hardBlockers: effectiveBlockers,
      code: "true_autonomy_missing_policy_data",
      reason: "Missing application target URL",
    };
  }

  // b) Blocker evaluation must be verified and available (cannot default missing data to 0)
  if (!hasExplicitBlockerEvaluation) {
    return {
      mayFinalSubmit: false,
      effectiveAutoSubmit: false,
      effectiveSubmissionMode: "review",
      effectiveAutomationMode: "review",
      autonomyConfidence,
      isTrustedSource: isTrusted,
      hardBlockers: 0,
      code: "true_autonomy_missing_policy_data",
      reason: "Missing blocker evaluation data for True Autonomy validation",
    };
  }

  // c) Zero hard blockers allowed
  if (effectiveBlockers > 0) {
    return {
      mayFinalSubmit: false,
      effectiveAutoSubmit: false,
      effectiveSubmissionMode: "review",
      effectiveAutomationMode: "review",
      autonomyConfidence,
      isTrustedSource: isTrusted,
      hardBlockers: effectiveBlockers,
      code: "true_autonomy_hard_blocker",
      reason: `${effectiveBlockers} hard blocker${effectiveBlockers > 1 ? "s" : ""} detected`,
    };
  }

  // d) Approved trusted ATS platform only
  if (!isTrusted) {
    return {
      mayFinalSubmit: false,
      effectiveAutoSubmit: false,
      effectiveSubmissionMode: "review",
      effectiveAutomationMode: "review",
      autonomyConfidence,
      isTrustedSource: false,
      hardBlockers: 0,
      code: "true_autonomy_untrusted_source",
      reason: "source is not approved for True Autonomy",
    };
  }

  // e) Confidence score must be available and >= TRUE_AUTONOMY_MIN_CONFIDENCE (90)
  const hasProvidedConfidence =
    (typeof tailoredConfidence === "number" && !isNaN(tailoredConfidence)) ||
    (typeof evaluationConfidence === "number" && !isNaN(evaluationConfidence)) ||
    (typeof jobMatchScore === "number" && !isNaN(jobMatchScore));

  if (!hasProvidedConfidence) {
    return {
      mayFinalSubmit: false,
      effectiveAutoSubmit: false,
      effectiveSubmissionMode: "review",
      effectiveAutomationMode: "review",
      autonomyConfidence: 0,
      isTrustedSource: true,
      hardBlockers: 0,
      code: "true_autonomy_missing_policy_data",
      reason: "Missing confidence score data for True Autonomy evaluation",
    };
  }

  if (autonomyConfidence < TRUE_AUTONOMY_MIN_CONFIDENCE) {
    return {
      mayFinalSubmit: false,
      effectiveAutoSubmit: false,
      effectiveSubmissionMode: "review",
      effectiveAutomationMode: "review",
      autonomyConfidence,
      isTrustedSource: true,
      hardBlockers: 0,
      code: "true_autonomy_confidence_below_threshold",
      reason: `autonomy confidence ${Math.round(autonomyConfidence)}% is below the ${TRUE_AUTONOMY_MIN_CONFIDENCE}% threshold`,
    };
  }

  // All True Autonomy requirements pass: final submit is permitted
  return {
    mayFinalSubmit: true,
    effectiveAutoSubmit: true,
    effectiveSubmissionMode: "autopilot",
    effectiveAutomationMode: "autopilot_strict",
    autonomyConfidence,
    isTrustedSource: true,
    hardBlockers: 0,
  };
}
