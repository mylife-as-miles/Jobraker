export type NormalizedSourceKind =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "workable"
  | "direct"
  | "firecrawl";

export type NormalizedSourceType = "adapter" | "web_search";

export type NormalizedVerificationStatus =
  | "verified"
  | "stale"
  | "failed"
  | "unverified";

export interface NormalizedSourceJob {
  title: string;
  company: string;
  location: string | null;
  url: string;
  description: string;
  posted_at: string | null;
  source_id: string;
  source_type: NormalizedSourceType;
  source_kind: NormalizedSourceKind;
  source_confidence: number;
  verification_status: NormalizedVerificationStatus;
  is_tracked_company: boolean;
  raw_data: Record<string, unknown>;
}

export interface SourceAdapterResult {
  jobs: NormalizedSourceJob[];
  warnings: string[];
}

export interface SourceAdapterContext {
  userId: string;
  searchQuery: string;
  location: string;
  limit: number;
  credentials?: Record<string, unknown>;
  allowedDomains?: string[];
}

export interface JobSourceAdapter {
  id: string;
  label: string;
  sourceKind: NormalizedSourceKind;
  discover(context: SourceAdapterContext): Promise<SourceAdapterResult>;
}

const SOURCE_KINDS = new Set<NormalizedSourceKind>([
  "greenhouse",
  "lever",
  "ashby",
  "workable",
  "direct",
  "firecrawl",
]);

const VERIFICATION_STATUSES = new Set<NormalizedVerificationStatus>([
  "verified",
  "stale",
  "failed",
  "unverified",
]);

const trimString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isValidUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

export function normalizeSourceAdapterJob(
  value: Record<string, unknown>,
  fallback: {
    sourceKind: NormalizedSourceKind;
    sourceType?: NormalizedSourceType;
    sourceConfidence?: number;
  },
): NormalizedSourceJob {
  const title = trimString(value.title);
  const company = trimString(value.company);
  const url = trimString(value.url) || trimString(value.apply_url);
  const description = trimString(value.description) || "";

  if (!title) throw new Error("Source adapter job is missing title.");
  if (!company) throw new Error("Source adapter job is missing company.");
  if (!url || !isValidUrl(url)) {
    throw new Error("Source adapter job is missing a valid URL.");
  }

  const rawSourceKind = trimString(value.source_kind) as NormalizedSourceKind | null;
  const sourceKind =
    rawSourceKind && SOURCE_KINDS.has(rawSourceKind)
      ? rawSourceKind
      : fallback.sourceKind;
  const rawVerification = trimString(
    value.verification_status,
  ) as NormalizedVerificationStatus | null;
  const verificationStatus =
    rawVerification && VERIFICATION_STATUSES.has(rawVerification)
      ? rawVerification
      : "unverified";
  const sourceConfidence =
    typeof value.source_confidence === "number"
      ? value.source_confidence
      : fallback.sourceConfidence ?? 0.65;

  return {
    title,
    company,
    location: trimString(value.location),
    url,
    description,
    posted_at: trimString(value.posted_at),
    source_id: trimString(value.source_id) || url,
    source_type: fallback.sourceType ?? "adapter",
    source_kind: sourceKind,
    source_confidence: Math.max(0, Math.min(0.99, sourceConfidence)),
    verification_status: verificationStatus,
    is_tracked_company: Boolean(value.is_tracked_company),
    raw_data:
      value.raw_data && typeof value.raw_data === "object" && !Array.isArray(value.raw_data)
        ? (value.raw_data as Record<string, unknown>)
        : {},
  };
}
