import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

export type JobTaskType =
  | "scout_search"
  | "job_reevaluation"
  | "pipeline_cleanup";

export type JobTaskStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "canceled";

export interface JobIntelligenceTask {
  id: string;
  user_id: string;
  type: JobTaskType;
  status: JobTaskStatus;
  title: string;
  message: string | null;
  progress_current: number;
  progress_total: number;
  cancel_requested: boolean;
  retry_of: string | null;
  params: Record<string, unknown>;
  result: Record<string, unknown>;
  logs: Array<Record<string, unknown>>;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

type CreateTaskInput = {
  type: JobTaskType;
  title: string;
  message?: string;
  progressTotal?: number;
  params?: Record<string, unknown>;
  retryOf?: string | null;
};

type UpdateTaskInput = Partial<
  Pick<
    JobIntelligenceTask,
    | "status"
    | "message"
    | "progress_current"
    | "progress_total"
    | "cancel_requested"
    | "result"
    | "logs"
    | "started_at"
    | "completed_at"
  >
>;

const terminalStatuses = new Set<JobTaskStatus>([
  "completed",
  "failed",
  "canceled",
]);

export function useJobIntelligenceTasks(limit = 8) {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<JobIntelligenceTask[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const nextUserId = user?.id ?? null;
    setUserId(nextUserId);

    if (!nextUserId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("job_intelligence_tasks")
      .select("*")
      .eq("user_id", nextUserId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("Failed to load job intelligence tasks", error);
      setLoading(false);
      return;
    }

    setTasks((data ?? []) as JobIntelligenceTask[]);
    setLoading(false);
  }, [limit, supabase]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`job-intelligence-tasks:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_intelligence_tasks",
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          setTasks((current) => {
            if (payload.eventType === "DELETE") {
              return current.filter((task) => task.id !== payload.old?.id);
            }

            const nextTask = payload.new as JobIntelligenceTask;
            if (!nextTask?.id) return current;

            const without = current.filter((task) => task.id !== nextTask.id);
            return [nextTask, ...without]
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .slice(0, limit);
          });
        },
      )
      .subscribe();

    const poll = window.setInterval(() => {
      void loadTasks();
    }, 8000);

    return () => {
      window.clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [limit, loadTasks, supabase, userId]);

  const createTask = useCallback(
    async (input: CreateTaskInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be signed in to start this task.");
      }

      const { data, error } = await supabase
        .from("job_intelligence_tasks")
        .insert({
          user_id: user.id,
          type: input.type,
          title: input.title,
          message: input.message ?? null,
          progress_total: input.progressTotal ?? 0,
          params: input.params ?? {},
          retry_of: input.retryOf ?? null,
        })
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message || "Failed to create task.");
      }

      const task = data as JobIntelligenceTask;
      setTasks((current) => [task, ...current].slice(0, limit));
      return task;
    },
    [limit, supabase],
  );

  const updateTask = useCallback(
    async (taskId: string, patch: UpdateTaskInput) => {
      const now = new Date().toISOString();
      const nextPatch: UpdateTaskInput & { updated_at: string } = {
        ...patch,
        updated_at: now,
      } as UpdateTaskInput & { updated_at: string };

      if (patch.status === "running" && !patch.started_at) {
        nextPatch.started_at = now;
      }
      if (
        patch.status &&
        terminalStatuses.has(patch.status) &&
        !patch.completed_at
      ) {
        nextPatch.completed_at = now;
      }

      const { data, error } = await supabase
        .from("job_intelligence_tasks")
        .update(nextPatch)
        .eq("id", taskId)
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message || "Failed to update task.");
      }

      const task = data as JobIntelligenceTask;
      setTasks((current) => {
        const without = current.filter((item) => item.id !== task.id);
        return [task, ...without]
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, limit);
      });
      return task;
    },
    [limit, supabase],
  );

  const cancelTask = useCallback(
    async (taskId: string) =>
      await updateTask(taskId, {
        status: "canceled",
        cancel_requested: true,
        message: "Canceled by user.",
      }),
    [updateTask],
  );

  return {
    tasks,
    loading,
    createTask,
    updateTask,
    cancelTask,
    reloadTasks: loadTasks,
  } as const;
}
