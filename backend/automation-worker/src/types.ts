export type AutomationProviderName = "rtrvr" | "skyvern";

export type BrowserExecutionPreference =
  | "automatic"
  | "my_chrome"
  | "jobraker_cloud";

export type RtrvrTargetMode = "auto" | "extension" | "cloud";

export type ApplicationAutomationStatus =
  | "queued"
  | "running"
  | "waiting_for_user"
  | "retrying"
  | "needs_review"
  | "failed"
  | "completed"
  | "cancelled";

export interface ApplicationJobContext {
  title?: string | null;
  company?: string | null;
  location?: string | null;
  salary?: string | null;
  matchScore?: number | null;
  matchReasons?: string[] | null;
  description?: string | null;
}

export interface CandidateAutomationProfile {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  headline?: string | null;
  portfolioLinks?: string[];
  employmentHistory?: Array<Record<string, unknown>>;
  education?: Array<Record<string, unknown>>;
  skills?: string[];
  workAuthorization?: Record<string, unknown> | null;
  savedScreeningAnswers?: Array<Record<string, unknown>>;
}

export interface ResumeAutomationInput {
  signedUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  text?: string | null;
  expiresAt?: string | null;
}

export interface StartApplicationInput {
  applicationId: string;
  agentRunId?: string | null;
  userId: string;
  applicationUrl: string;
  idempotencyKey: string;
  attemptNumber: number;
  job: ApplicationJobContext;
  candidate: CandidateAutomationProfile;
  resume?: ResumeAutomationInput | null;
  coverLetter?: string | null;
  autoSubmit: boolean;
  browserPreference: BrowserExecutionPreference;
  preferExtension?: boolean;
  selectedDeviceId?: string | null;
  rtrvrWebhookUrl?: string | null;
  rtrvrWebhookSecret?: string | null;
  skyvern?: {
    workflowId?: string | null;
    parameters?: Record<string, unknown>;
    proxyLocation?: string | null;
    webhookUrl?: string | null;
    title?: string | null;
    maxStepsOverride?: number | null;
  };
  metadata?: Record<string, unknown>;
}

export interface SubmissionEvidence {
  confirmationText?: string;
  confirmationNumber?: string;
  finalUrl?: string;
}

export interface NormalizedApplicationResult {
  status: "completed" | "prepared" | "waiting_for_user" | "failed";
  submitted: boolean;
  submissionEvidence?: SubmissionEvidence;
  fieldsFilled: Array<{
    label: string;
    valueType: string;
    status: "filled" | "skipped" | "unknown" | "failed";
  }>;
  unansweredQuestions: Array<{
    question: string;
    reason: string;
    options?: string[];
  }>;
  blockers: Array<{
    type:
      | "captcha"
      | "totp"
      | "login"
      | "legal_question"
      | "missing_information"
      | "upload_failure"
      | "unsupported_page"
      | "other";
    message: string;
  }>;
  screenshots?: string[];
  summary: string;
}

export interface StartApplicationResult {
  provider: AutomationProviderName;
  status: ApplicationAutomationStatus;
  providerRunId?: string | null;
  providerRequestId?: string | null;
  targetMode?: RtrvrTargetMode | null;
  selectedMode?: Exclude<RtrvrTargetMode, "auto"> | null;
  fallbackApplied?: boolean;
  fallbackReason?: string | null;
  deviceId?: string | null;
  result?: NormalizedApplicationResult | null;
  raw?: unknown;
  failureCode?: string | null;
  failureMessage?: string | null;
}

export interface ApplicationAutomationProvider {
  readonly name: AutomationProviderName;
  startApplication(input: StartApplicationInput): Promise<StartApplicationResult>;
  getApplicationStatus?(
    providerRunId: string,
  ): Promise<ApplicationAutomationStatus>;
  cancelApplication?(providerRunId: string): Promise<void>;
}
