// Shared types for ATS adapters. Pure TypeScript (no Deno APIs) so the same
// code runs in edge functions and in vitest.

export type AtsName =
  | "greenhouse"
  | "recruitee"
  | "ashby"
  | "lever"
  | "smartrecruiters"
  | "workable"
  | "teamtailor"
  | "breezy"
  | "rippling"
  | "bamboohr";

export type RemoteScope = "worldwide" | "restricted" | "onsite" | "hybrid" | "unknown";

export interface NormalizedQuestion {
  label: string;
  required: boolean;
  // Canonical profile key (see questions.ts), or null when unmatched.
  key: string | null;
  // Input kind as reported by the ATS (text, textarea, file, select, boolean...).
  kind: string;
  options?: string[];
}

export interface NormalizedJob {
  externalId: string;
  title: string;
  companyName: string;
  locationText: string | null;
  remoteScope: RemoteScope;
  countries: string[];
  department: string | null;
  employmentType: string | null;
  applyUrl: string;
  jobUrl: string | null;
  descriptionText: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  // null: the ATS does not expose questions. undefined: unchanged since the
  // last sync, so the stored questions must be kept.
  questions: NormalizedQuestion[] | null | undefined;
  postedAt: string | null;
  sourceUpdatedAt: string | null;
  // True when per-job details were skipped (unchanged job): description,
  // salary and URLs must not overwrite the stored values.
  partial?: boolean;
}

export interface AtsCompanyRef {
  ats: AtsName;
  boardToken: string;
  name: string;
}

export type FetchJson = (url: string) => Promise<unknown>;

export type FetchText = (url: string) => Promise<string>;

export interface FetchJobsOptions {
  // Needed by feeds that are XML/RSS rather than JSON (Teamtailor).
  fetchText?: FetchText;
  // True when a job is already stored with the same source update time and
  // known questions, so per-job detail requests can be skipped.
  unchanged?: (externalId: string, sourceUpdatedAt: string | null) => boolean;
}

export interface AtsAdapter {
  ats: AtsName;
  // Fetch all open jobs for one company board, normalized.
  fetchJobs(company: AtsCompanyRef, fetchJson: FetchJson, options?: FetchJobsOptions): Promise<NormalizedJob[]>;
}
