/**
 * Utilities for auto-apply source validation and True Autonomy policies.
 * True Autonomy restricts auto-submissions strictly to vetted ATS providers
 * with a high confidence threshold (>= 90%) and 0 hard blockers.
 */

export const TRUSTED_AUTO_APPLY_DOMAINS = [
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
] as const;

export function isTrustedAutoApplySource(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    return TRUSTED_AUTO_APPLY_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

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
}

/**
 * Strictly evaluates whether a job meets the True Autonomy policy.
 * Requirements:
 * 1. Zero hard blockers
 * 2. Trusted ATS source (e.g. Greenhouse, Lever, Ashby)
 * 3. Match / evaluation confidence >= 90 (prioritizing tailored confidence, then evaluation confidence, then job matchScore)
 * 4. Not explicitly requested as draft-only
 */
export function evaluateTrueAutonomyDecision(
  params: TrueAutonomyEvaluationParams,
): TrueAutonomyDecisionResult {
  const {
    targetUrl,
    saveAsDraftOnly = false,
    hardBlockers = 0,
    tailoredConfidence,
    evaluationConfidence,
    jobMatchScore,
  } = params;

  const isTrusted = isTrustedAutoApplySource(targetUrl);
  const autonomyConfidence =
    typeof tailoredConfidence === "number"
      ? tailoredConfidence
      : typeof evaluationConfidence === "number"
        ? evaluationConfidence
        : typeof jobMatchScore === "number"
          ? jobMatchScore
          : 0;

  if (saveAsDraftOnly) {
    return {
      safeToApply: false,
      autonomyConfidence,
      isTrustedSource: isTrusted,
      hardBlockers,
      reason: "saved as draft for review",
    };
  }

  if (hardBlockers > 0) {
    return {
      safeToApply: false,
      autonomyConfidence,
      isTrustedSource: isTrusted,
      hardBlockers,
      reason: `${hardBlockers} hard blocker${hardBlockers > 1 ? "s" : ""} detected`,
    };
  }

  if (!isTrusted) {
    return {
      safeToApply: false,
      autonomyConfidence,
      isTrustedSource: false,
      hardBlockers,
      reason: "source is not approved for True Autonomy",
    };
  }

  if (autonomyConfidence < 90) {
    return {
      safeToApply: false,
      autonomyConfidence,
      isTrustedSource: true,
      hardBlockers,
      reason: `autonomy confidence ${Math.round(autonomyConfidence)}% is below the 90% threshold`,
    };
  }

  return {
    safeToApply: true,
    autonomyConfidence,
    isTrustedSource: true,
    hardBlockers: 0,
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
