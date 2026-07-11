import type {
  BrowserExecutionPreference,
  NormalizedApplicationResult,
  StartApplicationResult,
} from "./types.js";

export interface ProviderFailureClassification {
  code: string;
  retryable: boolean;
  fallbackAllowed: boolean;
  waitingForUser: boolean;
  message: string;
}

const HUMAN_HANDOFF_BLOCKERS = new Set([
  "captcha",
  "totp",
  "login",
  "legal_question",
]);

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error || "Unknown provider error");
}

export function classifyRtrvrFailure(error: unknown): ProviderFailureClassification {
  const message = messageOf(error);
  const lower = message.toLowerCase();

  if (lower.includes("captcha") || lower.includes("totp") || lower.includes("security verification")) {
    return {
      code: "human_handoff_required",
      retryable: false,
      fallbackAllowed: false,
      waitingForUser: true,
      message,
    };
  }

  if (lower.includes("no online extension") || lower.includes("local browser session")) {
    return {
      code: "extension_unavailable",
      retryable: false,
      fallbackAllowed: false,
      waitingForUser: true,
      message,
    };
  }

  if (lower.includes("timeout") || lower.includes("timed out")) {
    return {
      code: "rtrvr_timeout",
      retryable: true,
      fallbackAllowed: true,
      waitingForUser: false,
      message,
    };
  }

  if (
    lower.includes("unsupported") ||
    lower.includes("navigation") ||
    lower.includes("upload") ||
    lower.includes("429") ||
    lower.includes("500") ||
    lower.includes("502") ||
    lower.includes("503") ||
    lower.includes("504")
  ) {
    return {
      code: "rtrvr_retryable_provider_error",
      retryable: true,
      fallbackAllowed: true,
      waitingForUser: false,
      message,
    };
  }

  return {
    code: "rtrvr_failed",
    retryable: false,
    fallbackAllowed: false,
    waitingForUser: false,
    message,
  };
}

export function hasSubmissionEvidence(result?: NormalizedApplicationResult | null): boolean {
  if (!result) return false;
  const evidence = result.submissionEvidence;
  return Boolean(
    result.submitted ||
      evidence?.confirmationText ||
      evidence?.confirmationNumber ||
      evidence?.finalUrl,
  );
}

export function needsHumanHandoff(result?: NormalizedApplicationResult | null): boolean {
  if (!result) return false;
  return (
    result.status === "waiting_for_user" ||
    result.blockers.some((blocker) => HUMAN_HANDOFF_BLOCKERS.has(blocker.type))
  );
}

export function canFallbackToSkyvern(opts: {
  rtrvrResult?: NormalizedApplicationResult | null;
  rtrvrFailure?: ProviderFailureClassification | null;
  requestedBrowserPreference: BrowserExecutionPreference;
  existingApplicationTerminal?: boolean;
  existingSubmissionEvidence?: boolean;
  attemptNumber: number;
}): { allowed: boolean; reason?: string } {
  if (opts.requestedBrowserPreference === "my_chrome") {
    return { allowed: false, reason: "The user selected My Chrome only." };
  }

  if (opts.existingApplicationTerminal || opts.existingSubmissionEvidence) {
    return { allowed: false, reason: "Existing application evidence prevents fallback." };
  }

  if (hasSubmissionEvidence(opts.rtrvrResult)) {
    return { allowed: false, reason: "rtrvr may already have submitted the application." };
  }

  if (needsHumanHandoff(opts.rtrvrResult)) {
    return { allowed: false, reason: "User attention is required before another provider can run." };
  }

  if (opts.rtrvrResult?.status === "failed") {
    const hasFallbackBlocker = opts.rtrvrResult.blockers.some((blocker) =>
      blocker.type === "unsupported_page" || blocker.type === "upload_failure",
    );
    if (hasFallbackBlocker) {
      return { allowed: true, reason: "rtrvr reported an unsupported or upload-failed workflow." };
    }
  }

  if (opts.rtrvrFailure?.fallbackAllowed) {
    return { allowed: true, reason: opts.rtrvrFailure.code };
  }

  return { allowed: false, reason: "Fallback criteria were not met." };
}

export function statusFromRtrvrResult(result: NormalizedApplicationResult): StartApplicationResult["status"] {
  if (result.status === "completed") return "completed";
  if (result.status === "prepared") return "needs_review";
  if (result.status === "waiting_for_user") return "waiting_for_user";
  return "failed";
}
