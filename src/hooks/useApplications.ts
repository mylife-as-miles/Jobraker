import { Fragment, createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../lib/supabaseClient";
import { captureClientEvent, captureServerEvent } from "../lib/analytics";
import { useToast } from "../components/ui/toast";
import { createNotification } from "../utils/notifications";
import {
  APPLICATION_STATUS_OPTIONS,
  canonicalStageFromDisplayStatus,
  displayStatusFromCanonicalStage,
  normalizeApplicationRecord,
  type ApplicationCanonicalStage,
  type ApplicationStatus,
} from "../lib/applicationState";
import { applyMicro1ReferralToUrl } from "../utils/micro1Referral";

export type { ApplicationStatus } from "../lib/applicationState";

export interface ApplicationRecord {
  id: string;
  user_id: string;
  job_id?: string | null;
  job_title: string;
  company: string;
  location: string;
  applied_date: string; // ISO string
  status: ApplicationStatus;
  canonical_stage: ApplicationCanonicalStage;
  salary: string | null;
  notes: string | null;
  next_step: string | null;
  interview_date: string | null; // ISO string or null
  logo: string | null;
  created_at: string;
  updated_at: string;
  match_score?: number;
  // Provider integration fields (populated by Skyvern flow)
  run_id?: string | null;
  workflow_id?: string | null;
  app_url?: string | null;
  provider_status?: string | null;
  recording_url?: string | null;
  failure_reason?: string | null;
  match_reasons?: string[] | null;
  receipt_url?: string | null;
  success_url?: string | null;
  draft_status?: "draft" | "ready" | "sent" | null;
  ai_confidence_score?: number | null;
  user_review_notes?: string | null;
  /** Full Skyvern webhook / run payload (workflow block outputs). */
  provider_run_output?: Record<string, unknown> | null;
}

type CreateInput = Partial<Omit<ApplicationRecord, "id" | "user_id" | "created_at" | "updated_at">> & {
  job_title: string;
  company: string;
};

type RecoverableJobRow = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  apply_url?: string | null;
  company_logo?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  canonical_status: ApplicationCanonicalStage;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  evaluation_summary?: {
    confidence_score?: number | null;
    matched_keywords?: string[] | null;
  } | null;
};

const RECOVERABLE_JOB_STATES: ApplicationCanonicalStage[] = [
  "draft_ready",
  "queued",
  "submitted",
  "failed",
  "terminated",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
];

function formatRecoveredSalary(job: RecoverableJobRow): string | null {
  const min = typeof job.salary_min === "number" ? job.salary_min : null;
  const max = typeof job.salary_max === "number" ? job.salary_max : null;
  const currency = job.salary_currency?.trim() || "";

  if (min == null && max == null) return null;
  if (min != null && max != null) return `${currency}${min.toLocaleString()} - ${currency}${max.toLocaleString()}`;
  const value = min ?? max;
  return value == null ? null : `${currency}${value.toLocaleString()}`;
}

function buildResumeRebuildPrompt(
  opts?: { jobTitle?: string | null; company?: string | null; count?: number },
) {
  const count = opts?.count ?? 1;
  const company = opts?.company?.trim();
  const jobTitle = opts?.jobTitle?.trim();
  const intro =
    count > 1
      ? `${count} applications were marked as rejected.`
      : jobTitle
        ? `${jobTitle}${company ? ` at ${company}` : ""} was marked as rejected.`
        : "An application was marked as rejected.";

  return createElement(
    Fragment,
    null,
    `${intro} This is a good moment to tighten your resume. `,
    createElement(
      "a",
      {
        href: "/dashboard/resume",
        className: "font-medium text-[#1dff00] underline underline-offset-4 hover:text-[#1dff00]",
      },
      "Open the Resume section",
    ),
    " to rebuild and retarget it.",
  );
}

function applicationNotificationUrl(applicationId: string) {
  return `/dashboard/application?application=${encodeURIComponent(applicationId)}`;
}

export function useApplications() {
  const supabase = useMemo(() => createClient(), []);
  const { success, error: toastError, info, warning } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guard against race conditions for list calls
  const listRequestId = useRef(0);

  /**
   * Derived statistics across current in-memory applications collection.
   * Lightweight memo so downstream UIs do not have to recalculate.
   */
  const stats = useMemo(() => {
    const byStatus = APPLICATION_STATUS_OPTIONS.reduce(
      (acc, status) => ({ ...acc, [status]: 0 }),
      {} as Record<ApplicationStatus, number>,
    );
    let newest: string | null = null;
    let interviewsNext7 = 0;
    const now = Date.now();
    const in7 = now + 7 * 24 * 60 * 60 * 1000;
    const dailyApplied: Record<string, number> = {}; // YYYY-MM-DD -> count
    for (const a of applications) {
      byStatus[a.status]++;
      if (!newest || a.updated_at > newest) newest = a.updated_at;
      if (a.interview_date) {
        const t = Date.parse(a.interview_date);
        if (!Number.isNaN(t) && t >= now && t <= in7) interviewsNext7++;
      }
      // Normalize date (applied_date may include time)
      if (a.applied_date) {
        const day = a.applied_date.slice(0, 10);
        dailyApplied[day] = (dailyApplied[day] ?? 0) + 1;
      }
    }
    const total = applications.length;
    return {
      total,
      byStatus,
      newestUpdatedAt: newest,
      interviewsNext7,
      dailyApplied,
      offerRate: total ? byStatus.Offer / total : 0,
      rejectionRate: total ? byStatus.Rejected / total : 0,
    } as const;
  }, [applications]);

  /** Quick map by id for O(1) lookups */
  const byId = useMemo(() => {
    const m = new Map<string, ApplicationRecord>();
    for (const a of applications) m.set(a.id, a);
    return m;
  }, [applications]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const uid = (data as any)?.user?.id ?? null;
        if (mounted) setUserId(uid);
      } catch (e) {
        if (mounted) setUserId(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  const list = useCallback(async () => {
    if (!userId) return;
    const reqId = ++listRequestId.current;
    setLoading(true);
    setError(null);
    try {
      const query = (supabase as any)
        .from("applications")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      const { data, error } = await query;
      if (reqId !== listRequestId.current) return; // stale
      if (error) throw error;

      const applicationRows = ((data ?? []) as ApplicationRecord[]).map((row) =>
        normalizeApplicationRecord(row),
      );
      const existingJobIds = new Set(
        applicationRows
          .map((row) => row.job_id)
          .filter((jobId): jobId is string => typeof jobId === "string" && jobId.length > 0),
      );
      const existingAppUrls = new Set(
        applicationRows
          .map((row) => row.app_url)
          .filter((url): url is string => typeof url === "string" && url.length > 0),
      );

      const { data: recoverableJobs, error: recoverableJobsError } = await (supabase as any)
        .from("jobs")
        .select(
          "id, title, company, location, apply_url, company_logo, created_at, updated_at, canonical_status, salary_min, salary_max, salary_currency, evaluation_summary",
        )
        .eq("user_id", userId)
        .in("canonical_status", RECOVERABLE_JOB_STATES);

      if (recoverableJobsError) {
        console.warn("Failed to load recoverable jobs for applications sync", recoverableJobsError);
      }

      let recoveredRows: ApplicationRecord[] = [];
      const missingJobs = ((recoverableJobs ?? []) as RecoverableJobRow[]).filter(
        (job) =>
          !existingJobIds.has(job.id) &&
          !(job.apply_url && existingAppUrls.has(job.apply_url)),
      );

      if (missingJobs.length > 0) {
        const recoveryPayload = missingJobs.map((job) => ({
          user_id: userId,
          job_id: job.id,
          job_title: job.title,
          company: job.company,
          location: job.location ?? "",
          applied_date: job.updated_at || job.created_at || new Date().toISOString(),
          status: displayStatusFromCanonicalStage(job.canonical_status),
          canonical_stage: job.canonical_status,
          salary: formatRecoveredSalary(job),
          notes: null,
          next_step: null,
          interview_date: null,
          logo: job.company_logo ?? null,
          app_url: job.apply_url ? applyMicro1ReferralToUrl(job.apply_url) : null,
          provider_status: job.canonical_status,
          match_reasons:
            Array.isArray(job.evaluation_summary?.matched_keywords) &&
            job.evaluation_summary.matched_keywords.length > 0
              ? job.evaluation_summary.matched_keywords
              : null,
          draft_status: job.canonical_status === "draft_ready" ? "draft" : "sent",
          ai_confidence_score:
            typeof job.evaluation_summary?.confidence_score === "number"
              ? job.evaluation_summary.confidence_score
              : null,
          user_review_notes: null,
        }));

        const { data: insertedRecoveredRows, error: recoverError } = await (supabase as any)
          .from("applications")
          .insert(recoveryPayload)
          .select("*");

        if (recoverError) {
          console.warn("Failed to recover missing application rows from jobs", recoverError);
        } else {
          recoveredRows = ((insertedRecoveredRows ?? []) as ApplicationRecord[]).map((row) =>
            normalizeApplicationRecord(row),
          );
        }
      }

      setApplications([...recoveredRows, ...applicationRows]);
    } catch (e: any) {
      if (reqId !== listRequestId.current) return; // stale
      const msg = e.message || "Failed to load applications";
      setError(msg);
      toastError("Failed to load applications", msg);
    } finally {
      if (reqId === listRequestId.current) setLoading(false);
    }
  }, [supabase, userId, toastError]);

  useEffect(() => {
    if (userId) list();
  }, [userId, list]);

  useEffect(() => {
    if (!userId) return;
    // Realtime changes
    const channel = (supabase as any)
      .channel(`applications:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applications', filter: `user_id=eq.${userId}` },
        (payload: any) => {
          const { eventType, new: newRow, old: oldRow } = payload;
          setApplications((prev) => {
            switch (eventType) {
              case 'INSERT':
                if (prev.find((r) => r.id === newRow.id)) return prev;
                return [normalizeApplicationRecord(newRow as ApplicationRecord), ...prev];
              case 'UPDATE': {
                const normalized = normalizeApplicationRecord(newRow as ApplicationRecord);
                const updated = prev.map((r) => (r.id === newRow.id ? { ...r, ...normalized } : r));
                // Move updated to top
                const idx = updated.findIndex((r) => r.id === newRow.id);
                if (idx > 0) {
                  const rec = updated[idx];
                  updated.splice(idx, 1);
                  return [rec, ...updated];
                }
                return updated;
              }
              case 'DELETE':
                return prev.filter((r) => r.id !== (oldRow?.id ?? newRow?.id));
              default:
                return prev;
            }
          });
        }
      )
      .subscribe();

    return () => {
      try { (supabase as any).removeChannel(channel); } catch {}
    };
  }, [supabase, userId]);

  const create = useCallback(async (input: CreateInput) => {
    if (!userId) return null;
    try {
      const payload = {
        user_id: userId,
        job_id: input.job_id ?? null,
        job_title: input.job_title,
        company: input.company,
        location: input.location ?? "",
    applied_date: input.applied_date ?? new Date().toISOString(),
    status: (input.status ?? "Pending") as ApplicationStatus,
        canonical_stage:
          input.canonical_stage ??
          canonicalStageFromDisplayStatus(input.status ?? "Pending"),
        salary: input.salary ?? null,
        notes: input.notes ?? null,
        match_score: input.match_score ?? null,
        next_step: input.next_step ?? null,
        interview_date: input.interview_date ?? null,
        logo: input.logo ?? null,
        match_reasons: input.match_reasons ?? null,
        receipt_url: input.receipt_url ?? null,
        success_url: input.success_url ?? null,
        draft_status: input.draft_status ?? 'ready',
        ai_confidence_score: input.ai_confidence_score ?? null,
        user_review_notes: input.user_review_notes ?? null,
      };
      const { data, error } = await (supabase as any)
        .from("applications")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      const rec = normalizeApplicationRecord(data as ApplicationRecord);
      setApplications((prev) => [rec, ...prev]);
      const applicationEventProperties = {
        application_id: rec.id,
        job_id: rec.job_id ?? undefined,
        job_title: rec.job_title,
        company: rec.company,
        location: rec.location,
        status: rec.status,
        canonical_stage: rec.canonical_stage,
      };
      captureClientEvent("application_started", applicationEventProperties);
      void captureServerEvent("application_started", applicationEventProperties);
      success("Application added", `${rec.job_title} @ ${rec.company}`);
      // Notification: new application added
      createNotification({
        user_id: userId,
        type: 'application',
        title: `Application added: ${rec.job_title}`,
        message: `${rec.job_title} @ ${rec.company}`,
        company: rec.company,
        action_url: applicationNotificationUrl(rec.id),
        action_label: 'Open application',
        source: 'application',
        source_record_id: rec.id,
        source_record_type: 'application',
      });
      return rec;
    } catch (e: any) {
      const msg = e.message || "Failed to add application";
      setError(msg);
      toastError("Add failed", msg);
      // System notification for failure (best-effort; ignore result)
      if (userId) {
        createNotification({
          user_id: userId,
          type: 'system',
          title: 'Application creation failed',
          message: msg,
        });
      }
      return null;
    }
  }, [supabase, userId, success, toastError]);

  const update = useCallback(async (id: string, patch: Partial<ApplicationRecord>) => {
    // Inspect before state for status transitions
    const current = applications.find(a => a.id === id);
    const oldStatus = current?.status;
    const newStatus = patch.status ?? oldStatus;
    const oldInterviewDate = current?.interview_date;
    try {
      const normalizedPatch = {
        ...patch,
        ...(patch.status
          ? { canonical_stage: canonicalStageFromDisplayStatus(patch.status) }
          : {}),
      };
      setApplications((prev) =>
        prev.map((r) =>
          r.id === id ? normalizeApplicationRecord({ ...r, ...normalizedPatch }) : r,
        ),
      );
      const { error } = await (supabase as any)
        .from("applications")
        .update(normalizedPatch)
        .eq("id", id);
      if (error) throw error;
      success("Saved changes");
      // Create notifications for key lifecycle transitions
      if (userId && oldStatus && newStatus && oldStatus !== newStatus && current) {
        const transitionEventProperties = {
          application_id: current.id,
          job_id: current.job_id ?? undefined,
          job_title: current.job_title,
          company: current.company,
          previous_status: oldStatus,
          status: newStatus,
        };
        if (newStatus === "Applied") {
          captureClientEvent("application_submitted", transitionEventProperties);
          void captureServerEvent("application_submitted", transitionEventProperties);
        }
        if (newStatus === 'Interview') {
          createNotification({
            user_id: userId,
            type: 'interview',
            title: `Interview stage: ${current.job_title}`,
            message: `${current.job_title} @ ${current.company} advanced to Interview`,
            company: current.company,
            action_url: applicationNotificationUrl(current.id),
            action_label: 'Open application',
            source: 'application',
            source_record_id: current.id,
            source_record_type: 'application',
          });
        } else if (newStatus === 'Offer') {
          createNotification({
            user_id: userId,
            type: 'application',
            title: `Offer received: ${current.job_title}`,
            message: `Congratulations! Offer stage reached for ${current.job_title} @ ${current.company}`,
            company: current.company,
            action_url: applicationNotificationUrl(current.id),
            action_label: 'Open application',
            source: 'application',
            source_record_id: current.id,
            source_record_type: 'application',
          });
        } else if (newStatus === 'Rejected') {
          createNotification({
            user_id: userId,
            type: 'system',
            title: `Application rejected: ${current.job_title}`,
            message: `${current.job_title} @ ${current.company}`,
            company: current.company,
          });
          warning(
            "Resume rebuild recommended",
            buildResumeRebuildPrompt({
              jobTitle: current.job_title,
              company: current.company,
            }),
            9000,
          );
        }
      }
      // Interview date newly scheduled or changed
      if (userId && patch.interview_date && patch.interview_date !== oldInterviewDate && current) {
        const when = (() => {
          try { return new Date(patch.interview_date as string).toLocaleString(); } catch { return patch.interview_date; }
        })();
        createNotification({
          user_id: userId,
          type: 'interview',
          title: `Interview scheduled: ${current.job_title}`,
          message: `${current.job_title} @ ${current.company} on ${when}`,
          company: current.company,
          action_url: applicationNotificationUrl(current.id),
          action_label: 'Open application',
          source: 'application',
          source_record_id: current.id,
          source_record_type: 'application',
        });
      }
      // Provider failure or explicit failure_reason update
      if (userId && patch.failure_reason) {
      createNotification({
          user_id: userId,
          type: 'system',
          title: 'Application error',
          message: patch.failure_reason.slice(0, 500),
        });
      }
    } catch (e: any) {
      const msg = e.message || "Failed to update application";
      setError(msg);
      toastError("Update failed", msg);
      await list();
      if (userId) {
        createNotification({
          user_id: userId,
          type: 'system',
          title: 'Application update failed',
          message: msg,
        });
      }
    }
  }, [supabase, success, toastError, warning, list, applications, userId]);

  /** Bulk status update (optimistic). Rolls back to previous collection on failure. */
  const bulkUpdateStatus = useCallback(async (ids: string[], status: ApplicationStatus) => {
    if (!ids.length) return;
    const prev = applications;
    const affected = new Set(ids);
    const canonicalStage = canonicalStageFromDisplayStatus(status);
    setApplications(
      applications.map((a) =>
        affected.has(a.id)
          ? normalizeApplicationRecord({ ...a, status, canonical_stage: canonicalStage })
          : a,
      ),
    );
    try {
      const { error } = await (supabase as any)
        .from('applications')
        .update({ status, canonical_stage: canonicalStage })
        .in('id', ids);
      if (error) throw error;
      success('Statuses updated', `${ids.length} application${ids.length > 1 ? 's' : ''}`);
      if (userId) {
        // Aggregate notification (avoid spamming one per record)
        const label = status === 'Offer' ? 'Offer stage' : status === 'Interview' ? 'Interview stage' : `Status: ${status}`;
        createNotification({
          user_id: userId,
          type: status === 'Rejected' || status === 'Failed' ? 'system' : 'application',
          title: `${label} (${ids.length})`,
          message: `Updated ${ids.length} application${ids.length>1?'s':''} to ${status}.`,
        });
      }
      if (status === "Rejected") {
        warning(
          "Resume rebuild recommended",
          buildResumeRebuildPrompt({ count: ids.length }),
          9000,
        );
      }
    } catch (e: any) {
      setApplications(prev); // rollback
      const msg = e.message || 'Bulk status update failed';
      setError(msg);
      toastError('Bulk update failed', msg);
    }
  }, [applications, supabase, success, toastError, userId, warning]);

  /** Lightweight client-side search (case-insensitive across title/company/location). */
  const search = useCallback((q: string) => {
    if (!q.trim()) return applications;
    const needle = q.trim().toLowerCase();
    return applications.filter(a =>
      a.job_title.toLowerCase().includes(needle) ||
      a.company.toLowerCase().includes(needle) ||
      a.location.toLowerCase().includes(needle)
    );
  }, [applications]);

  /** Filter applications by simple criteria. */
  const filter = useCallback((opts: { status?: ApplicationStatus | ApplicationStatus[]; from?: string; to?: string; }) => {
    const statuses = opts.status ? (Array.isArray(opts.status) ? opts.status : [opts.status]) : null;
    const fromT = opts.from ? Date.parse(opts.from) : null;
    const toT = opts.to ? Date.parse(opts.to) : null;
    return applications.filter(a => {
      if (statuses && !statuses.includes(a.status)) return false;
      if (fromT || toT) {
        const t = Date.parse(a.applied_date);
        if (fromT && t < fromT) return false;
        if (toT && t > toT) return false;
      }
      return true;
    });
  }, [applications]);

  /** Direct fetch by id from in-memory cache */
  const getById = useCallback((id: string) => byId.get(id) ?? null, [byId]);

  const remove = useCallback(async (id: string) => {
    const current = applications.find(a => a.id === id);
    try {
      setApplications((prev) => prev.filter((r) => r.id !== id));
      const { error } = await (supabase as any)
        .from("applications")
        .delete()
        .eq("id", id);
      if (error) throw error;
      info("Deleted");
      if (userId && current) {
        createNotification({
          user_id: userId,
          type: 'system',
          title: `Application removed: ${current.job_title}`,
          message: `${current.job_title} @ ${current.company}`,
          company: current.company,
        });
      }
    } catch (e: any) {
      const msg = e.message || "Failed to delete application";
      setError(msg);
      toastError("Delete failed", msg);
      await list();
      if (userId) {
        createNotification({
          user_id: userId,
          type: 'system',
          title: 'Application delete failed',
          message: msg,
        });
      }
    }
  }, [supabase, info, toastError, list, applications, userId]);

  const exportCSV = useCallback(() => {
    const headers = [
      "job_title","company","location","applied_date","status","salary","notes","next_step","interview_date","logo"
    ];
    const rows = applications.map((a) => [
      a.job_title, a.company, a.location, a.applied_date, a.status, a.salary ?? "",
      a.notes?.replace(/\n/g, " ") ?? "", a.next_step ?? "", a.interview_date ?? "", a.logo ?? ""
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `applications-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    info("Export started", "CSV");
  }, [applications, info]);

  const syncPendingStatus = useCallback(async () => {
    const pending = applications.filter(
      (a) => a.status === "Pending" && a.run_id,
    );
    if (pending.length === 0) return 0;

    let synced = 0;
    for (const app of pending) {
      try {
        const { data, error: invokeErr } = await (supabase as any).functions.invoke(
          "sync-provider-status",
          { body: { run_id: app.run_id } },
        );
        if (invokeErr) {
          console.warn("sync-status invoke error", app.run_id, invokeErr);
          continue;
        }
        const result = typeof data === "string" ? JSON.parse(data) : data;
        if (result?.app_status && result.app_status !== "Pending") {
          setApplications((prev) =>
            prev.map((a) =>
              a.id === app.id
                ? {
                    ...a,
                    status: result.app_status as ApplicationStatus,
                    canonical_stage: result.canonical_stage ?? a.canonical_stage,
                    provider_status: result.provider_status ?? result.skyvern_status ?? a.provider_status,
                    failure_reason: result.failure_reason ?? a.failure_reason,
                  }
                : a,
            ),
          );
          synced++;
        }
      } catch (e) {
        console.warn("sync-status error for", app.run_id, e);
      }
    }
    return synced;
  }, [applications, supabase]);

  useEffect(() => {
    if (!userId || applications.length === 0) return;
    const hasPending = applications.some((a) => a.status === "Pending" && a.run_id);
    if (!hasPending) return;
    const timer = setTimeout(() => {
      syncPendingStatus();
    }, 2000);
    return () => clearTimeout(timer);
  }, [userId, applications, syncPendingStatus]);

  return {
    applications,
    loading,
    error,
    refresh: list,
    create,
    update,
    remove,
    exportCSV,
    syncPendingStatus,
    stats,
    search,
    filter,
    bulkUpdateStatus,
    getById,
  } as const;
}
