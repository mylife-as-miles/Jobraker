import { FOLLOW_UP_MIN_DAYS } from "./types";

export interface ApplicationFollowUpCandidate {
  id?: string;
  applied_date?: string | null;
  created_at?: string;
  status?: string;
  draft_status?: string;
  company?: string;
  job_title?: string;
}

export interface OutreachHistoryRecord {
  contactedAt: string | Date;
  channel?: string;
  action?: string;
  recruiterReplied?: boolean;
  repliedAt?: string | Date | null;
}

export type FollowUpIneligibilityReason =
  | "eligible"
  | "too_soon"
  | "already_replied"
  | "interview_active"
  | "recent_followup"
  | "rejected"
  | "withdrawn"
  | "missing_submission_date";

export interface FollowUpEligibilityResult {
  eligible: boolean;
  reason: FollowUpIneligibilityReason;
  daysSinceSubmission?: number;
  recommendedAt?: string;
}

/**
 * Evaluates whether an application is genuinely eligible for an outreach follow-up.
 * Enforces the canonical 7-day rule and checks terminal/active stages.
 */
export function evaluateFollowUpEligibility(
  application: ApplicationFollowUpCandidate,
  outreachHistory?: OutreachHistoryRecord[],
  options: { nowMs?: number; minDays?: number } = {},
): FollowUpEligibilityResult {
  const now = options.nowMs ?? Date.now();
  const minDays = options.minDays ?? FOLLOW_UP_MIN_DAYS;

  // 1. Status checks: terminal or active interview states
  const normStatus = (application.status || "").toLowerCase().trim();
  if (normStatus === "rejected") {
    return { eligible: false, reason: "rejected" };
  }
  if (normStatus === "withdrawn") {
    return { eligible: false, reason: "withdrawn" };
  }
  if (normStatus === "interview" || normStatus === "interviewing" || normStatus === "offer") {
    return { eligible: false, reason: "interview_active" };
  }

  // 2. Reply checks in outreach history
  if (outreachHistory && outreachHistory.length > 0) {
    const hasReply = outreachHistory.some((h) => h.recruiterReplied || h.repliedAt);
    if (hasReply) {
      return { eligible: false, reason: "already_replied" };
    }

    // Check for recent follow-up within minDays
    const recentFollowUp = outreachHistory.find((h) => {
      const contactTime = new Date(h.contactedAt).getTime();
      const daysAgo = (now - contactTime) / (1000 * 60 * 60 * 24);
      return daysAgo < minDays;
    });

    if (recentFollowUp) {
      const contactTime = new Date(recentFollowUp.contactedAt).getTime();
      const recommendedDate = new Date(contactTime + minDays * 24 * 60 * 60 * 1000);
      return {
        eligible: false,
        reason: "recent_followup",
        recommendedAt: recommendedDate.toISOString(),
      };
    }
  }

  // 3. Submission date check
  const submissionDateStr = application.applied_date || application.created_at;
  if (!submissionDateStr) {
    return { eligible: false, reason: "missing_submission_date" };
  }

  const submissionTime = new Date(submissionDateStr).getTime();
  if (isNaN(submissionTime)) {
    return { eligible: false, reason: "missing_submission_date" };
  }

  const daysSinceSubmission = Math.floor((now - submissionTime) / (1000 * 60 * 60 * 24));
  if (daysSinceSubmission < minDays) {
    const recommendedDate = new Date(submissionTime + minDays * 24 * 60 * 60 * 1000);
    return {
      eligible: false,
      reason: "too_soon",
      daysSinceSubmission,
      recommendedAt: recommendedDate.toISOString(),
    };
  }

  return {
    eligible: true,
    reason: "eligible",
    daysSinceSubmission,
  };
}
