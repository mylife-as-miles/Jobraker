/**
 * Utilities for auto-apply source validation and True Autonomy policies.
 * True Autonomy restricts auto-submissions strictly to vetted ATS providers
 * with a high confidence threshold (>= 90%) and 0 hard blockers.
 *
 * Canonical policy definitions are shared directly from:
 * backend/supabase/shared/auto-apply-policy.ts
 */

import {
  TRUE_AUTONOMY_MIN_CONFIDENCE,
  TRUSTED_AUTO_APPLY_DOMAINS,
  isTrustedAutoApplySource,
  extractAutonomyConfidence,
  validateSubmissionPolicy,
  type AutomationMode,
  type AutoApplySubmissionMode,
  type TrueAutonomyRejectionCode,
  type SubmissionPolicyValidationParams,
  type SubmissionPolicyValidationResult,
  type TrustedAutoApplyDomain,
} from "../../backend/supabase/shared/auto-apply-policy.ts";

export {
  TRUE_AUTONOMY_MIN_CONFIDENCE,
  TRUSTED_AUTO_APPLY_DOMAINS,
  isTrustedAutoApplySource,
  extractAutonomyConfidence,
  validateSubmissionPolicy,
};

export type {
  AutomationMode,
  AutoApplySubmissionMode,
  TrueAutonomyRejectionCode,
  SubmissionPolicyValidationParams,
  SubmissionPolicyValidationResult,
  TrustedAutoApplyDomain,
};

export interface TrueAutonomyEvaluationParams {
  targetUrl?: string | null;
  saveAsDraftOnly?: boolean;
  hardBlockers?: number;
  tailoredConfidence?: number | null;
  evaluationConfidence?: number | null;
  jobMatchScore?: number | null;
  canonicalDecision?: string | null;
}

export interface TrueAutonomyDecisionResult {
  safeToApply: boolean;
  autonomyConfidence: number;
  isTrustedSource: boolean;
  hardBlockers: number;
  reason?: string;
  code?: TrueAutonomyRejectionCode;
}

/**
 * Evaluates whether a job meets the True Autonomy policy.
 * Delegates directly to the canonical backend policy validator.
 */
export function evaluateTrueAutonomyDecision(
  params: TrueAutonomyEvaluationParams,
): TrueAutonomyDecisionResult {
  const result = validateSubmissionPolicy({
    targetUrl: params.targetUrl,
    requestedAutoSubmit: true,
    submissionMode: "autopilot",
    trueAutonomy: true,
    tailoredConfidence: params.tailoredConfidence,
    evaluationConfidence: params.evaluationConfidence,
    jobMatchScore: params.jobMatchScore,
    hardBlockers: params.hardBlockers,
    saveAsDraftOnly: params.saveAsDraftOnly,
  });

  return {
    safeToApply: result.mayFinalSubmit,
    autonomyConfidence: result.autonomyConfidence,
    isTrustedSource: result.isTrustedSource,
    hardBlockers: result.hardBlockers,
    reason: result.reason,
    code: result.code,
  };
}

/**
 * Normal (manual) Auto Apply decision logic.
 * Less restrictive than True Autonomy, allowing user-guided review/submissions.
 */
export function evaluateNormalAutoApplyDecision(opts: {
  saveAsDraftOnly: boolean;
  tailoredConfidence?: number;
  decision?: string;
  confidence?: number;
  hardBlockers?: number;
}): boolean {
  const {
    saveAsDraftOnly,
    tailoredConfidence,
    decision,
    confidence = 0,
    hardBlockers = 0,
  } = opts;

  return (
    !saveAsDraftOnly &&
    ((tailoredConfidence && tailoredConfidence >= 70) ||
      decision === "strong_yes" ||
      decision === "draft_first" ||
      confidence >= 50) &&
    hardBlockers === 0
  );
}
