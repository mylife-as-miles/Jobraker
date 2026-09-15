export type OutreachActionType =
  | "recruiter_intro"
  | "hiring_manager_pitch"
  | "referral_request"
  | "application_followup"
  | "value_add_followup"
  | "interview_thank_you"
  | "reengagement"
  | "informational_chat";

export type OutreachState =
  | "recommended"
  | "researching"
  | "ready_for_review"
  | "drafted"
  | "sent"
  | "waiting"
  | "replied"
  | "followup_due"
  | "positive_reply"
  | "referral"
  | "interview"
  | "closed";

export type OutreachChannel = "gmail" | "linkedin" | "manual";

export type ContactRoleKind =
  | "recruiter"
  | "sourcer"
  | "hiring_manager"
  | "department_lead"
  | "executive"
  | "recruiting_inbox"
  | "unknown";

export type ContactVerificationStatus =
  | "source_verified"
  | "provider_verified"
  | "domain_valid"
  | "public_source"
  | "linkedin_only"
  | "unknown";

export interface ContactCandidate {
  contactId?: string;
  name?: string;
  title?: string;
  company?: string;
  email?: string;
  linkedinUrl?: string;
  roleKind: ContactRoleKind;
  verification: ContactVerificationStatus;
  confidence: number;
  provenance: {
    sourceType: string;
    sourceUrl?: string;
    provider?: string;
    checkedAt: string;
  };
  contactScore?: number;
  scoreBreakdown?: {
    roleRelevance: number;
    departmentAlignment: number;
    hiringAuthority: number;
    verification: number;
    opportunityRelationship: number;
    relationshipWarmth: number;
  };
  selectionReasons?: string[];
}

export type CandidateEvidenceType =
  | "experience"
  | "achievement"
  | "skill"
  | "project"
  | "education"
  | "portfolio";

export type CandidateEvidenceSource =
  | "resume"
  | "profile"
  | "user_verified";

export interface CandidateEvidenceItem {
  id: string;
  type: CandidateEvidenceType;
  text: string;
  source: CandidateEvidenceSource;
  confidence: number;
}

export interface OpportunityReference {
  jobId: string;
  companyName: string;
  jobTitle: string;
  location?: string;
  applyUrl?: string;
  source?: string;
  matchScore?: number;
  description?: string;
}

export interface ApplicationContext {
  stage: string;
  appliedAt?: string;
  daysSinceApplication?: number;
  applicationId?: string;
  status?: string;
}

export interface RelationshipContext {
  previousMessages: number;
  lastContactAt?: string;
  lastReplyAt?: string;
  recruiterReplied: boolean;
  history?: Array<{
    action: OutreachActionType;
    channel: OutreachChannel;
    contactedAt: string;
    subject?: string;
    status: string;
  }>;
}

export interface OutreachStrategy {
  action: OutreachActionType;
  tone: string;
  objective: string;
  CTA: string;
}

export interface OutreachMessage {
  subject?: string;
  body: string;
  openerType?: string;
  CTAType?: string;
  evidenceIdsUsed?: string[];
  needsRegeneration?: boolean;
}

export interface OutreachDelivery {
  channel: OutreachChannel;
  mode: "review" | "draft" | "send";
  allowedToSend: boolean;
  draftId?: string;
  messageId?: string;
  threadId?: string;
  deliveredAt?: string;
}

export interface OutreachRecommendation {
  action: OutreachActionType | "none";
  score: number;
  confidence: number;
  reasons: string[];
  blockedReasons: string[];
  recommendedAt?: string;
}

export interface OutreachPackage {
  version: 1;
  id: string;
  userId: string;
  opportunity: OpportunityReference;
  contact: ContactCandidate;
  candidateEvidence: CandidateEvidenceItem[];
  applicationContext: ApplicationContext;
  relationshipContext: RelationshipContext;
  strategy: OutreachStrategy;
  message: OutreachMessage;
  delivery: OutreachDelivery;
  recommendation: OutreachRecommendation;
  createdAt: string;
  updatedAt?: string;
  state: OutreachState;
  signedPreparationToken?: string;
}

export interface OutreachActionDefinition {
  id: OutreachActionType;
  label: string;
  shortLabel: string;
  description: string;
  applicableStages: string[];
  requiresContact: boolean;
  requiresVerifiedEmail: boolean;
  deliveryChannels: OutreachChannel[];
  defaultStrategy: {
    tone: string;
    objective: string;
    CTA: string;
  };
}

export const FOLLOW_UP_MIN_DAYS = 7;

export const OUTREACH_ACTIONS: Record<OutreachActionType, OutreachActionDefinition> = {
  recruiter_intro: {
    id: "recruiter_intro",
    label: "Recruiter Introduction",
    shortLabel: "Recruiter Intro",
    description: "Reach out directly to the responsible recruiter or talent partner for this role.",
    applicableStages: ["discovered", "saved", "pre_application"],
    requiresContact: true,
    requiresVerifiedEmail: true,
    deliveryChannels: ["gmail", "linkedin"],
    defaultStrategy: {
      tone: "conversational_professional",
      objective: "Establish early dialogue and highlight relevant candidate evidence before applying.",
      CTA: "Ask for a brief introductory conversation or the best way to submit priority materials.",
    },
  },
  hiring_manager_pitch: {
    id: "hiring_manager_pitch",
    label: "Hiring Manager Value Pitch",
    shortLabel: "Hiring Manager Pitch",
    description: "Pitch the exact team leader or department head with specific technical solutions.",
    applicableStages: ["discovered", "saved", "applied"],
    requiresContact: true,
    requiresVerifiedEmail: true,
    deliveryChannels: ["gmail", "linkedin"],
    defaultStrategy: {
      tone: "high_agency_direct",
      objective: "Demonstrate immediate capability to solve key challenges facing the team.",
      CTA: "Suggest sharing specific ideas or a short 10-minute alignment chat.",
    },
  },
  referral_request: {
    id: "referral_request",
    label: "Referral Request",
    shortLabel: "Referral Ask",
    description: "Request an internal referral or team introduction from a peer or department member.",
    applicableStages: ["discovered", "saved"],
    requiresContact: true,
    requiresVerifiedEmail: false,
    deliveryChannels: ["linkedin", "gmail"],
    defaultStrategy: {
      tone: "respectful_peer",
      objective: "Ask for advice on team culture and whether they would be open to submitting an internal referral.",
      CTA: "Polite inquiry if they would feel comfortable submitting your resume.",
    },
  },
  application_followup: {
    id: "application_followup",
    label: "Application Follow-Up",
    shortLabel: "Follow-Up Bump",
    description: "Courteous check-in on an application that has been quiet for 7+ days.",
    applicableStages: ["applied", "submitted"],
    requiresContact: true,
    requiresVerifiedEmail: true,
    deliveryChannels: ["gmail"],
    defaultStrategy: {
      tone: "courteous_concise",
      objective: "Reiterate enthusiasm and gently check on review timeline without creating friction.",
      CTA: "Confirm materials were received and offer any supplementary evidence.",
    },
  },
  value_add_followup: {
    id: "value_add_followup",
    label: "Value-Add Follow-Up",
    shortLabel: "Value Follow-Up",
    description: "Share relevant work, an insight, or a project update to re-engage after 14+ days.",
    applicableStages: ["applied", "submitted"],
    requiresContact: true,
    requiresVerifiedEmail: true,
    deliveryChannels: ["gmail"],
    defaultStrategy: {
      tone: "thoughtful_value_first",
      objective: "Provide a concrete asset (e.g. project sample, teardown) rather than merely asking for status.",
      CTA: "Share the link/artifact and welcome thoughts.",
    },
  },
  interview_thank_you: {
    id: "interview_thank_you",
    label: "Interview Thank-You",
    shortLabel: "Thank-You Note",
    description: "Send a thoughtful, grounded note within 24 hours of completing an interview.",
    applicableStages: ["interviewing", "interview_completed"],
    requiresContact: true,
    requiresVerifiedEmail: true,
    deliveryChannels: ["gmail"],
    defaultStrategy: {
      tone: "reflective_appreciative",
      objective: "Reference a specific topic discussed during the interview and reinforce alignment.",
      CTA: "Reaffirm excitement for the team and next steps.",
    },
  },
  reengagement: {
    id: "reengagement",
    label: "Opportunity Re-engagement",
    shortLabel: "Re-engage",
    description: "Check in with a previously contacted employer after team growth or new role openings.",
    applicableStages: ["closed", "archived", "stale"],
    requiresContact: true,
    requiresVerifiedEmail: true,
    deliveryChannels: ["gmail", "linkedin"],
    defaultStrategy: {
      tone: "warm_reconnect",
      objective: "Touch base on new initiatives and see if the team is hiring again.",
      CTA: "Ask if current hiring plans align with your updated experience.",
    },
  },
  informational_chat: {
    id: "informational_chat",
    label: "Informational Conversation",
    shortLabel: "Info Chat",
    description: "Request a low-pressure career or team chat to learn about company direction.",
    applicableStages: ["discovered", "saved", "curious"],
    requiresContact: true,
    requiresVerifiedEmail: false,
    deliveryChannels: ["linkedin", "gmail"],
    defaultStrategy: {
      tone: "curious_humble",
      objective: "Learn about the team's engineering stack, culture, and roadmap.",
      CTA: "Ask for 15 minutes to ask 2-3 focused questions about the team.",
    },
  },
};

export function validateOutreachPermissions(
  plan: string,
  delivery: { channel: OutreachChannel; mode: "review" | "draft" | "send" },
): { allowed: boolean; reason?: string } {
  const normalizedPlan = (plan || "starter").toLowerCase();
  const isStarter = normalizedPlan === "starter" || normalizedPlan === "free";

  if (isStarter && delivery.channel === "gmail" && delivery.mode === "send") {
    return {
      allowed: false,
      reason: "upgrade_required",
    };
  }

  return { allowed: true };
}

export function validateOutreachPackage(pkg: unknown): OutreachPackage {
  if (!pkg || typeof pkg !== "object") {
    throw new Error("Invalid outreach package: must be an object.");
  }
  const p = pkg as Partial<OutreachPackage>;
  if (p.version !== 1) {
    throw new Error("Unsupported outreach package version.");
  }
  if (!p.id || !p.userId) {
    throw new Error("Outreach package missing id or userId.");
  }
  if (!p.opportunity?.companyName || !p.opportunity?.jobTitle) {
    throw new Error("Outreach package opportunity details incomplete.");
  }
  if (!p.contact?.email && !p.contact?.linkedinUrl) {
    throw new Error("Outreach package contact requires either email or LinkedIn URL.");
  }
  if (!p.message?.body) {
    throw new Error("Outreach package message body cannot be empty.");
  }
  return p as OutreachPackage;
}

