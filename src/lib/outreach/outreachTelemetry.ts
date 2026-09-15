import type { OutreachActionType, OutreachChannel } from "./types";

export type OutreachTelemetryEventName =
  | "outreach_recommended"
  | "recommendation_opened"
  | "outreach_started"
  | "contact_found"
  | "contact_not_found"
  | "message_generated"
  | "message_regenerated"
  | "message_edited"
  | "review_completed"
  | "gmail_draft_created"
  | "email_sent"
  | "reply_detected"
  | "followup_recommended"
  | "followup_sent"
  | "positive_reply"
  | "referral_recorded"
  | "interview_recorded";

export interface OutreachTelemetryPayload {
  actionType?: OutreachActionType | "none";
  jobId?: string;
  companyName?: string;
  contactTier?: number;
  contactVerification?: string;
  channel?: OutreachChannel;
  plan?: string;
  draftId?: string;
  messageId?: string;
  reasons?: string[];
  errorClass?: string;
  score?: number;
  [key: string]: unknown;
}

export function sanitizeTelemetryPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = new Set([
    "body",
    "messageBody",
    "subject",
    "email",
    "recipientEmail",
    "recipient",
    "resume",
    "rawResume",
    "candidateName",
    "phone",
  ]);

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (sensitiveKeys.has(key)) continue;
    sanitized[key] = value;
  }
  return sanitized;
}

/**
 * Clean telemetry logger for outreach events.
 * Strictly avoids logging PII, full email bodies, or candidate resumes.
 */
export function trackOutreachEvent(
  event: OutreachTelemetryEventName,
  payload: OutreachTelemetryPayload = {},
) {
  try {
    const safePayload = sanitizeTelemetryPayload(payload as Record<string, unknown>);

    if (typeof window !== "undefined" && (window as any).posthog) {
      (window as any).posthog.capture(`outreach_${event}`, {
        ...safePayload,
        timestamp: new Date().toISOString(),
      });
    }

    // In development or test environments, record for diagnostics
    if (process.env.NODE_ENV !== "production") {
      // Diagnostic telemetry log
    }
  } catch (err) {
    // Non-blocking telemetry
  }
}

