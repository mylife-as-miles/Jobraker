// Canonical OutreachPackage contract for Supabase Edge Functions

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

export interface OutreachPackagePayload {
  version: 1;
  id: string;
  userId: string;
  opportunity: {
    jobId: string;
    companyName: string;
    jobTitle: string;
    location?: string;
    applyUrl?: string;
    source?: string;
  };
  contact: {
    contactId?: string;
    name?: string;
    title?: string;
    company?: string;
    email?: string;
    linkedinUrl?: string;
    roleKind: string;
    verification: string;
    confidence: number;
    provenance: {
      sourceType: string;
      sourceUrl?: string;
      provider?: string;
      checkedAt: string;
    };
  };
  candidateEvidence: Array<{
    id: string;
    type: string;
    text: string;
    source: string;
    confidence: number;
  }>;
  applicationContext: {
    stage: string;
    appliedAt?: string;
    daysSinceApplication?: number;
  };
  relationshipContext: {
    previousMessages: number;
    lastContactAt?: string;
    lastReplyAt?: string;
    recruiterReplied: boolean;
  };
  strategy: {
    action: OutreachActionType;
    tone: string;
    objective: string;
    CTA: string;
  };
  message: {
    subject?: string;
    body: string;
    openerType?: string;
    CTAType?: string;
    evidenceIdsUsed?: string[];
  };
  delivery: {
    channel: "gmail" | "linkedin" | "manual";
    mode: "review" | "draft" | "send";
    allowedToSend: boolean;
  };
  recommendation: {
    score: number;
    reasons: string[];
  };
  createdAt: string;
}

export function validateOutreachPackagePayload(payload: unknown): OutreachPackagePayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid outreach package: must be an object.");
  }
  const p = payload as Partial<OutreachPackagePayload>;
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
  return p as OutreachPackagePayload;
}
