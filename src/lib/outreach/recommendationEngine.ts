import type {
  ApplicationContext,
  CandidateEvidenceItem,
  ContactCandidate,
  OpportunityReference,
  OutreachActionType,
  OutreachRecommendation,
  RelationshipContext,
} from "./types";
import { evaluateFollowUpEligibility, type OutreachHistoryRecord } from "./followUpRules";

export interface OutreachDecisionContext {
  opportunity: OpportunityReference;
  contact?: ContactCandidate | null;
  candidateEvidence?: CandidateEvidenceItem[];
  applicationContext?: ApplicationContext;
  relationshipContext?: RelationshipContext;
  outreachHistory?: OutreachHistoryRecord[];
  nowMs?: number;
}

export interface OutreachDecisionStrategy {
  recommend(context: OutreachDecisionContext): Promise<OutreachRecommendation>;
}

export class RuleBasedOutreachDecisionStrategy implements OutreachDecisionStrategy {
  async recommend(context: OutreachDecisionContext): Promise<OutreachRecommendation> {
    const {
      opportunity,
      contact,
      candidateEvidence = [],
      applicationContext,
      relationshipContext,
      outreachHistory = [],
      nowMs = Date.now(),
    } = context;

    const reasons: string[] = [];
    const blockedReasons: string[] = [];

    // 1. Check Terminal Application States
    if (applicationContext?.status) {
      const st = applicationContext.status.toLowerCase();
      if (st === "rejected") {
        blockedReasons.push("Application was rejected by employer.");
        return { action: "none", score: 0, confidence: 1.0, reasons, blockedReasons };
      }
      if (st === "withdrawn") {
        blockedReasons.push("Application was withdrawn by candidate.");
        return { action: "none", score: 0, confidence: 1.0, reasons, blockedReasons };
      }
    }

    // 2. Check Recruiter Reply Status
    if (relationshipContext?.recruiterReplied) {
      blockedReasons.push("Recipient has already replied. Standard outreach/bump is suspended.");
      return { action: "none", score: 0, confidence: 0.95, reasons, blockedReasons };
    }

    // 3. Evaluate Application Stage
    const stage = (applicationContext?.stage || "").toLowerCase();
    const isApplied = stage === "applied" || stage === "submitted" || applicationContext?.status === "Applied";
    const isInterview = stage === "interviewing" || stage === "interview_completed" || applicationContext?.status === "Interview";

    // A. Interview Thank-You Check
    if (isInterview) {
      reasons.push("Interview completed. Timely thank-you note is recommended within 24 hours.");
      return {
        action: "interview_thank_you",
        score: 95,
        confidence: 0.9,
        reasons,
        blockedReasons,
      };
    }

    // B. Application Follow-Up Check
    if (isApplied) {
      const eligibility = evaluateFollowUpEligibility(
        {
          applied_date: applicationContext?.appliedAt,
          status: applicationContext?.status,
        },
        outreachHistory,
        { nowMs },
      );

      if (eligibility.eligible) {
        reasons.push(`Applied ${eligibility.daysSinceSubmission ?? 7}+ days ago with no response recorded.`);
        reasons.push("A courteous check-in will keep your application top-of-mind.");
        return {
          action: "application_followup",
          score: 88,
          confidence: 0.9,
          reasons,
          blockedReasons,
        };
      } else {
        if (eligibility.reason === "too_soon") {
          blockedReasons.push(
            `Applied ${eligibility.daysSinceSubmission ?? 0} days ago. Follow-up is recommended after 7 days.`,
          );
        } else if (eligibility.reason === "recent_followup") {
          blockedReasons.push("A follow-up was sent recently. Waiting for response before further contact.");
        } else {
          blockedReasons.push(`Follow-up blocked: ${eligibility.reason}`);
        }
        return {
          action: "none",
          score: 20,
          confidence: 0.85,
          reasons,
          blockedReasons,
          recommendedAt: eligibility.recommendedAt,
        };
      }
    }

    // C. Pre-Application Outreach Check (Job Discovered / Saved)
    if (!opportunity?.companyName || !opportunity?.jobTitle) {
      blockedReasons.push("Opportunity lacks company name or title.");
      return { action: "none", score: 0, confidence: 1.0, reasons, blockedReasons };
    }

    // Evidence completeness check
    if (candidateEvidence.length === 0) {
      blockedReasons.push("Missing candidate evidence. Upload a resume or add profile experiences before reaching out.");
      return {
        action: "none",
        score: 30,
        confidence: 0.8,
        reasons,
        blockedReasons,
      };
    }

    // Score calculation
    let score = 50; // base score
    reasons.push(`High-value opportunity at ${opportunity.companyName}`);

    // Evidence boost
    if (candidateEvidence.length >= 3) {
      score += 15;
      reasons.push("Strong candidate evidence matches job profile");
    }

    // Contact boost
    if (contact?.email && contact.verification !== "unknown") {
      score += 15;
      reasons.push(`Verified contact identified (${contact.name || "Talent Partner"})`);
    }

    // Evaluation score boost
    if (opportunity.matchScore && opportunity.matchScore >= 75) {
      score += 10;
      reasons.push(`Verified high fit score: ${opportunity.matchScore}%`);
    }

    const actionType: OutreachActionType =
      contact?.roleKind === "hiring_manager" ? "hiring_manager_pitch" : "recruiter_intro";

    return {
      action: actionType,
      score: Math.min(100, score),
      confidence: 0.9,
      reasons,
      blockedReasons,
    };
  }
}

const defaultStrategy = new RuleBasedOutreachDecisionStrategy();

export async function recommendNextOutreachAction(
  context: OutreachDecisionContext,
  strategy: OutreachDecisionStrategy = defaultStrategy,
): Promise<OutreachRecommendation> {
  return strategy.recommend(context);
}
