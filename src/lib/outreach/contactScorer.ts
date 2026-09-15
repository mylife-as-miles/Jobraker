import type {
  ContactCandidate,
  OpportunityReference,
  OutreachActionType,
} from "./types";

export interface ContactScoringContext {
  targetStrategy?: OutreachActionType;
  department?: string;
  userSeniority?: string;
}

export interface ContactScoreResult {
  contactScore: number;
  scoreBreakdown: {
    roleRelevance: number;
    departmentAlignment: number;
    hiringAuthority: number;
    verification: number;
    opportunityRelationship: number;
    relationshipWarmth: number;
  };
  selectionReasons: string[];
}

/**
 * Deterministically scores a potential contact for a specific job opportunity.
 * Distinguishes between technical recruiter vs generic recruiter vs hiring manager vs executive.
 */
export function scoreContactForOpportunity(
  contact: Partial<ContactCandidate>,
  opportunity: Partial<OpportunityReference>,
  context: ContactScoringContext = {},
): ContactScoreResult {
  const jobTitleNorm = (opportunity.jobTitle || "").toLowerCase();
  const contactTitleNorm = (contact.title || "").toLowerCase();
  const strategy = context.targetStrategy || "recruiter_intro";

  const reasons: string[] = [];

  // 1. Role Relevance (0 - 25 pts)
  let roleRelevance = 10;
  const isRecruiter =
    contact.roleKind === "recruiter" ||
    contact.roleKind === "sourcer" ||
    /recruiter|talent|sourcer|talent acquisition|recruiting/i.test(contactTitleNorm);

  const isTechRecruiter =
    isRecruiter &&
    /tech|technical|engineer|engineering|software|developer|product|data/i.test(contactTitleNorm);

  const isEngineeringRole =
    /software|engineer|developer|backend|frontend|fullstack|devops|data|platform|architect/i.test(jobTitleNorm);

  const isHiringManager =
    contact.roleKind === "hiring_manager" ||
    contact.roleKind === "department_lead" ||
    /head of|vp of|director of|engineering manager|tech lead|lead engineer|principal/i.test(contactTitleNorm);

  if (strategy === "recruiter_intro") {
    if (isTechRecruiter && isEngineeringRole) {
      roleRelevance = 25;
      reasons.push("Dedicated technical recruiter aligned with engineering roles");
    } else if (isRecruiter) {
      roleRelevance = 20;
      reasons.push("Talent acquisition partner at target company");
    } else if (isHiringManager) {
      roleRelevance = 16;
      reasons.push("Hiring leader for the department");
    } else {
      roleRelevance = 8;
    }
  } else if (strategy === "hiring_manager_pitch") {
    if (isHiringManager) {
      roleRelevance = 25;
      reasons.push("Direct team or department hiring leader");
    } else if (isTechRecruiter) {
      roleRelevance = 15;
    } else {
      roleRelevance = 8;
    }
  } else {
    roleRelevance = isRecruiter ? 20 : isHiringManager ? 18 : 12;
  }

  // 2. Department Alignment (0 - 20 pts)
  let departmentAlignment = 5;
  const targetDept =
    context.department ||
    (isEngineeringRole ? "engineering" : /designer|product manager/i.test(jobTitleNorm) ? "product" : "general");

  if (targetDept === "engineering" && /engineer|tech|software|dev|infra|platform/i.test(contactTitleNorm)) {
    departmentAlignment = 20;
    reasons.push("Direct department alignment with target engineering team");
  } else if (targetDept === "product" && /product|design|ux/i.test(contactTitleNorm)) {
    departmentAlignment = 20;
    reasons.push("Direct alignment with product organization");
  } else if (isRecruiter) {
    departmentAlignment = 15;
  } else {
    departmentAlignment = 8;
  }

  // 3. Hiring Authority (0 - 15 pts)
  let hiringAuthority = 5;
  if (/director|head|vp|manager|lead/i.test(contactTitleNorm)) {
    hiringAuthority = 15;
    reasons.push("Direct hiring authority on the team");
  } else if (isRecruiter) {
    hiringAuthority = 12;
    reasons.push("Active recruiter managing inbound pipeline");
  } else if (/sourcer/i.test(contactTitleNorm)) {
    hiringAuthority = 8;
  }

  // 4. Verification Level (0 - 25 pts)
  let verification = 5;
  if (contact.verification === "source_verified") {
    verification = 25;
    reasons.push("Verified official company email address");
  } else if (contact.verification === "provider_verified") {
    verification = 20;
    reasons.push("Provider-verified professional work email");
  } else if (contact.verification === "domain_valid") {
    verification = 15;
    reasons.push("Valid company domain email");
  } else if (contact.verification === "linkedin_only") {
    verification = 10;
    reasons.push("Verified LinkedIn profile (no public email)");
  } else {
    verification = 5;
  }

  // 5. Opportunity Relationship (0 - 10 pts)
  let opportunityRelationship = 5;
  if (contact.company && opportunity.companyName) {
    const normC1 = contact.company.toLowerCase().trim();
    const normC2 = opportunity.companyName.toLowerCase().trim();
    if (normC1 === normC2 || normC1.includes(normC2) || normC2.includes(normC1)) {
      opportunityRelationship = 10;
    }
  }

  // 6. Relationship Warmth (0 - 5 pts)
  const relationshipWarmth = 5; // Default neutral

  const totalScore = Math.min(
    100,
    roleRelevance +
      departmentAlignment +
      hiringAuthority +
      verification +
      opportunityRelationship +
      relationshipWarmth,
  );

  return {
    contactScore: totalScore,
    scoreBreakdown: {
      roleRelevance,
      departmentAlignment,
      hiringAuthority,
      verification,
      opportunityRelationship,
      relationshipWarmth,
    },
    selectionReasons: reasons,
  };
}
