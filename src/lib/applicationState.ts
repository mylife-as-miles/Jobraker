export type JobCanonicalStatus =
  | "discovered"
  | "evaluated"
  | "draft_ready"
  | "queued"
  | "submitted"
  | "failed"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn"
  | "hidden";

export type ApplicationCanonicalStage =
  | "draft_ready"
  | "queued"
  | "submitted"
  | "failed"
  | "terminated"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn";

export type ApplicationStatus =
  | "Draft"
  | "Pending"
  | "Applied"
  | "Failed"
  | "Terminated"
  | "Interview"
  | "Offer"
  | "Rejected"
  | "Withdrawn";

export const APPLICATION_STATUS_OPTIONS: ApplicationStatus[] = [
  "Draft",
  "Pending",
  "Applied",
  "Failed",
  "Terminated",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
];

export const APPLICATION_ACTIVE_STATUSES: ApplicationStatus[] = [
  "Pending",
  "Applied",
  "Interview",
];

const DISPLAY_TO_CANONICAL: Record<ApplicationStatus, ApplicationCanonicalStage> = {
  Draft: "draft_ready",
  Pending: "queued",
  Applied: "submitted",
  Failed: "failed",
  Terminated: "terminated",
  Interview: "interview",
  Offer: "offer",
  Rejected: "rejected",
  Withdrawn: "withdrawn",
};

const CANONICAL_TO_DISPLAY: Record<ApplicationCanonicalStage, ApplicationStatus> = {
  draft_ready: "Draft",
  queued: "Pending",
  submitted: "Applied",
  failed: "Failed",
  terminated: "Terminated",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const VISIBLE_JOB_QUEUE_STATES: JobCanonicalStatus[] = [
  "discovered",
  "evaluated",
];

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export function displayStatusFromCanonicalStage(
  canonicalStage?: string | null,
  fallbackStatus?: string | null,
): ApplicationStatus {
  const explicitStage = asString(canonicalStage) as ApplicationCanonicalStage | null;
  if (explicitStage && explicitStage in CANONICAL_TO_DISPLAY) {
    return CANONICAL_TO_DISPLAY[explicitStage];
  }

  switch ((fallbackStatus || "").trim()) {
    case "Draft":
    case "Pending":
    case "Applied":
    case "Failed":
    case "Terminated":
    case "Interview":
    case "Offer":
    case "Rejected":
    case "Withdrawn":
      return fallbackStatus as ApplicationStatus;
    case "Saved":
      return "Draft";
    case "Submitted":
      return "Pending";
    default:
      return "Pending";
  }
}

export function canonicalStageFromDisplayStatus(
  status?: string | null,
): ApplicationCanonicalStage {
  const trimmed = (status || "").trim();
  if (trimmed in DISPLAY_TO_CANONICAL) {
    return DISPLAY_TO_CANONICAL[trimmed as ApplicationStatus];
  }
  switch (trimmed) {
    case "Saved":
      return "draft_ready";
    case "Submitted":
      return "queued";
    default:
      return "queued";
  }
}

export function normalizeApplicationRecord<T extends Record<string, any>>(
  row: T,
): T & { status: ApplicationStatus; canonical_stage: ApplicationCanonicalStage } {
  const canonicalStage = (asString(row.canonical_stage) ||
    canonicalStageFromDisplayStatus(row.status)) as ApplicationCanonicalStage;

  return {
    ...row,
    canonical_stage: canonicalStage,
    status: displayStatusFromCanonicalStage(canonicalStage, row.status),
  };
}

export function isVisibleQueueState(status?: string | null): boolean {
  const normalized = (asString(status) || "discovered") as JobCanonicalStatus;
  return VISIBLE_JOB_QUEUE_STATES.includes(normalized);
}
