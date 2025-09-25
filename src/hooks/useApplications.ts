import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabaseClient";
import { useToast } from "../components/ui/toast";
import { createNotification } from "../utils/notifications";

export type ApplicationStatus = "Pending" | "Applied" | "Interview" | "Offer" | "Rejected" | "Withdrawn";

export interface ApplicationRecord {any notifications on 
  id: string;
  user_id: string;
  job_title: string;
  company: string;
  location: string;
  applied_date: string; // ISO string
  status: ApplicationStatus;
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
}

type CreateInput = Partial<Omit<ApplicationRecord, "id" | "user_id" | "created_at" | "updated_at">> & {
  job_title: string;
  company: string;
};

export function useApplications() {
  const supabase = useMemo(() => createClient(), []);
  const { success, error: toastError, info } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await (supabase as any)
        .from("applications")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      // Use raw data from DB only (no mock values)
      setApplications((data ?? []) as ApplicationRecord[]);
    } catch (e: any) {
      const msg = e.message || "Failed to load applications";
      setError(msg);
      toastError("Failed to load applications", msg);
    } finally {
      setLoading(false);
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
                return [newRow as ApplicationRecord, ...prev];
              case 'UPDATE': {
                const updated = prev.map((r) => (r.id === newRow.id ? { ...r, ...newRow } : r));
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
        job_title: input.job_title,
        company: input.company,
        location: input.location ?? "",
    applied_date: input.applied_date ?? new Date().toISOString(),
    status: (input.status ?? "Pending") as ApplicationStatus,
        salary: input.salary ?? null,
        notes: input.notes ?? null,
        next_step: input.next_step ?? null,
        interview_date: input.interview_date ?? null,
        logo: input.logo ?? null,
      };
      const { data, error } = await (supabase as any)
        .from("applications")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      const rec = data as ApplicationRecord;
      setApplications((prev) => [rec, ...prev]);
      success("Application added", `${rec.job_title} @ ${rec.company}`);
      // Notification: new application added
      createNotification({
        user_id: userId,
        type: 'application',
        title: `Application added: ${rec.job_title}`,
        message: `${rec.job_title} @ ${rec.company}`,
        company: rec.company,
        action_url: rec.app_url ?? undefined,
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
      setApplications((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      const { error } = await (supabase as any)
        .from("applications")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
      success("Saved changes");
      // Create notifications for key lifecycle transitions
      if (userId && oldStatus && newStatus && oldStatus !== newStatus && current) {
        if (newStatus === 'Interview') {
          createNotification({
            user_id: userId,
            type: 'interview',
            title: `Interview stage: ${current.job_title}`,
            message: `${current.job_title} @ ${current.company} advanced to Interview`,
            company: current.company,
            action_url: current.app_url ?? undefined,
          });
        } else if (newStatus === 'Offer') {
          createNotification({
            user_id: userId,
            type: 'application',
            title: `Offer received: ${current.job_title}`,
            message: `Congratulations! Offer stage reached for ${current.job_title} @ ${current.company}`,
            company: current.company,
            action_url: current.app_url ?? undefined,
          });
        } else if (newStatus === 'Rejected') {
          createNotification({
            user_id: userId,
            type: 'system',
            title: `Application rejected: ${current.job_title}`,
            message: `${current.job_title} @ ${current.company}`,
            company: current.company,
          });
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
          action_url: current.app_url ?? undefined,
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
  }, [supabase, success, toastError, list, applications, userId]);

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

  return { applications, loading, error, refresh: list, create, update, remove, exportCSV } as const;
}
