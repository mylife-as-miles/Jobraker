// Lightweight analytics abstraction. Falls back to console if no provider configured.
// Extend by wiring to a real destination (PostHog, Segment, self-host) later.

export type AnalyticsEvent = {
  name: string;
  props?: Record<string, any>;
  ts?: number; // epoch ms
};

interface AnalyticsSink {
  track: (evt: AnalyticsEvent) => void;
  flush?: () => Promise<void> | void;
}

class ConsoleSink implements AnalyticsSink {
  track(evt: AnalyticsEvent) {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", evt.name, evt.props || {});
  }
  // no-op flush
}

let sink: AnalyticsSink = new ConsoleSink();

// Offline buffer (simple in-memory + localStorage persistence) to survive transient failures.
const LS_KEY = 'analytics-buffer-v1';
let buffer: AnalyticsEvent[] = [];
try {
  const raw = localStorage.getItem(LS_KEY);
  if (raw) buffer = JSON.parse(raw) || [];
} catch {}

async function flushBuffer() {
  if (!buffer.length) return;
  const pending = [...buffer];
  buffer = [];
  for (const evt of pending) {
    try { sink.track(evt); } catch { buffer.push(evt); }
  }
  try { localStorage.setItem(LS_KEY, JSON.stringify(buffer)); } catch {}
}

export async function flushAnalytics() { await flushBuffer(); }

export function setAnalyticsSink(custom: AnalyticsSink) {
  sink = custom;
}

export function track(name: string, props?: Record<string, any>) {
  const evt: AnalyticsEvent = { name, props, ts: Date.now() };
  try {
    sink.track(evt);
  } catch (e) {
    buffer.push(evt);
    try { localStorage.setItem(LS_KEY, JSON.stringify(buffer)); } catch {}
  }
}

// Helper wrappers for core funnel events (keep args explicit for DX)
export const events = {
  signupStarted: (meta?: Record<string, any>) => track("signup_started", meta),
  resumeUploaded: (file: File, hashPrefix?: string) => track("resume_uploaded", { size_kb: Math.round(file.size/1024), ext: file.name.split('.').pop(), hash_prefix: hashPrefix }),
  resumeParsedSuccess: (stats: { duration_ms: number; skills_count: number; education_count: number }) => track("resume_parsed_success", stats),
  resumeParsedFailure: (error_type: string) => track("resume_parsed_failure", { error_type }),
  profileCompleted: (msSinceSignup?: number) => track("profile_completed", { time_since_signup_ms: msSinceSignup }),
  autoApplyStarted: (job_count: number, resume_id?: string) => track("auto_apply_started", { job_count, resume_id }),
  autoApplyJobSuccess: (job_id: string, source: string, duration_ms: number) => track("auto_apply_job_success", { job_id, source, duration_ms }),
  autoApplyJobFailed: (job_id: string, source: string, error_type: string) => track("auto_apply_job_failed", { job_id, source, error_type }),
  autoApplyFinished: (success_count: number, fail_count: number) => track("auto_apply_finished", { success_count, fail_count }),
  coverLetterGenerated: (removedUnsupportedCount: number) => track("cover_letter_generated", { method: 'v2', factcheck_removed_count: removedUnsupportedCount }),
  outcomeTagged: (job_id: string, outcome: string) => track("outcome_tagged", { job_id, outcome }),
  resumeVersionCreated: (resume_id: string, is_duplicate: boolean, approx_added?: number, approx_removed?: number) => track("resume_version_created", { resume_id, is_duplicate, approx_added, approx_removed }),
  resumeVersionCreateFailed: (resume_id: string | undefined, error_type: string) => track("resume_version_create_failed", { resume_id, error_type }),
};
