import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Bot,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  ChevronDown,
  ChevronUp,
  Square,
} from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import type { JobIntelligenceTask } from "@/hooks/useJobIntelligenceTasks";
import { Button } from "@/components/ui/button";

interface LiveAgentTaskCardProps {
  taskId: string;
  initialTitle?: string;
  initialType?: string;
  onTaskCompleted?: (task: JobIntelligenceTask) => void;
}

export const LiveAgentTaskCard: React.FC<LiveAgentTaskCardProps> = ({
  taskId,
  initialTitle,
  initialType,
  onTaskCompleted,
}) => {
  const [task, setTask] = useState<JobIntelligenceTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogs, setShowLogs] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;

    const loadTask = async () => {
      try {
        const { data, error } = await supabase
          .from("job_intelligence_tasks")
          .select("*")
          .eq("id", taskId)
          .single();

        if (!error && data && isMounted) {
          setTask(data as JobIntelligenceTask);
          if (data.status === "completed" && onTaskCompleted) {
            onTaskCompleted(data as JobIntelligenceTask);
          }
        }
      } catch (err) {
        console.warn("[LiveAgentTaskCard] Failed to fetch task:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadTask();

    // Subscribe to realtime updates for this specific task
    const channel = supabase
      .channel(`task-${taskId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_intelligence_tasks",
          filter: `id=eq.${taskId}`,
        },
        (payload) => {
          if (!isMounted) return;
          const updated = payload.new as JobIntelligenceTask;
          if (updated && updated.id === taskId) {
            setTask(updated);
            if (updated.status === "completed" && onTaskCompleted) {
              onTaskCompleted(updated);
            }
          }
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [taskId, supabase, onTaskCompleted]);

  const handleCancel = async () => {
    if (cancelling || !task || task.status === "completed" || task.status === "canceled") return;
    setCancelling(true);
    try {
      await supabase
        .from("job_intelligence_tasks")
        .update({ cancel_requested: true })
        .eq("id", taskId);
    } catch (err) {
      console.warn("[LiveAgentTaskCard] Cancel error:", err);
    } finally {
      setCancelling(false);
    }
  };

  const title = task?.title || initialTitle || "Autonomous Background Agent";
  const status = task?.status || "queued";
  const message = task?.message || (loading ? "Connecting to cloud worker..." : "Agent queued in cloud...");
  const current = task?.progress_current ?? 0;
  const total = Math.max(task?.progress_total ?? 1, 1);
  const percentage = Math.min(100, Math.round((current / total) * 100));
  const logs = task?.logs || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className='my-3 w-full max-w-xl overflow-hidden rounded-2xl border border-brand/25 bg-gradient-to-b from-neutral-900/95 to-neutral-950/95 p-4 shadow-xl backdrop-blur-md'
    >
      {/* Header */}
      <div className='flex items-center justify-between gap-3 border-b border-foreground/10 pb-3'>
        <div className='flex items-center gap-2.5 min-w-0'>
          <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand ring-1 ring-brand/30 shadow-inner'>
            {status === "running" ? (
              <Loader2 className='h-4 w-4 animate-spin text-brand' />
            ) : status === "completed" ? (
              <CheckCircle2 className='h-4 w-4 text-emerald-400' />
            ) : status === "failed" ? (
              <XCircle className='h-4 w-4 text-red-400' />
            ) : (
              <Bot className='h-4 w-4 text-brand' />
            )}
          </div>
          <div className='min-w-0'>
            <div className='flex items-center gap-1.5'>
              <span className='text-[10px] font-bold uppercase tracking-wider text-brand flex items-center gap-1'>
                <Sparkles className='h-3 w-3' />
                Cloud Agent Task
              </span>
            </div>
            <h4 className='truncate text-xs font-semibold text-foreground/90'>{title}</h4>
          </div>
        </div>

        {/* Status Pill */}
        <div className='shrink-0'>
          {status === "running" ? (
            <span className='inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-2.5 py-1 text-[11px] font-medium text-brand ring-1 ring-brand/30 animate-pulse'>
              <span className='h-1.5 w-1.5 rounded-full bg-brand' />
              Running in Cloud
            </span>
          ) : status === "completed" ? (
            <span className='inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-400 ring-1 ring-emerald-500/30'>
              <span className='h-1.5 w-1.5 rounded-full bg-emerald-400' />
              Completed
            </span>
          ) : status === "failed" ? (
            <span className='inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-medium text-red-400 ring-1 ring-red-500/30'>
              <span className='h-1.5 w-1.5 rounded-full bg-red-400' />
              Failed
            </span>
          ) : (
            <span className='inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-400 ring-1 ring-amber-500/30'>
              <Clock className='h-3 w-3' />
              Queued
            </span>
          )}
        </div>
      </div>

      {/* Progress & Message */}
      <div className='mt-3 space-y-2'>
        <div className='flex items-center justify-between text-xs'>
          <span className='truncate text-foreground/75 font-mono text-[11px]'>{message}</span>
          <span className='shrink-0 font-medium text-foreground/60 text-[11px] ml-2'>
            {percentage}% ({current}/{total})
          </span>
        </div>

        {/* Progress Bar */}
        <div className='h-1.5 w-full overflow-hidden rounded-full bg-foreground/10'>
          <motion.div
            className='h-full bg-gradient-to-r from-brand to-emerald-400'
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Cloud Persistence Notice */}
      {status === "running" && (
        <p className='mt-2.5 text-[11px] text-foreground/45 flex items-center gap-1.5'>
          <span>☁️</span>
          <span>Runs persistently in the cloud. You can close this tab/window anytime.</span>
        </p>
      )}

      {/* Controls and Logs toggle */}
      <div className='mt-3 flex items-center justify-between pt-2 border-t border-foreground/5'>
        {logs.length > 0 ? (
          <button
            type='button'
            onClick={() => setShowLogs(!showLogs)}
            className='flex items-center gap-1 text-[11px] font-medium text-foreground/60 hover:text-foreground transition-colors'
          >
            <Terminal className='h-3 w-3' />
            <span>{showLogs ? "Hide Logs" : `Logs (${logs.length})`}</span>
            {showLogs ? <ChevronUp className='h-3 w-3' /> : <ChevronDown className='h-3 w-3' />}
          </button>
        ) : (
          <div />
        )}

        {(status === "running" || status === "queued") && (
          <Button
            type='button'
            variant='ghost'
            size='sm'
            disabled={cancelling}
            onClick={handleCancel}
            className='h-6 px-2 text-[11px] text-red-400 hover:bg-red-500/10 hover:text-red-300'
          >
            <Square className='mr-1 h-2.5 w-2.5 fill-current' />
            {cancelling ? "Stopping..." : "Stop Agent"}
          </Button>
        )}
      </div>

      {/* Expandable Logs Viewer */}
      <AnimatePresence>
        {showLogs && logs.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className='mt-2 overflow-hidden rounded-lg border border-foreground/10 bg-neutral-950/80 p-2.5 font-mono text-[10px] text-foreground/70 max-h-36 overflow-y-auto space-y-1'
          >
            {logs.map((log: any, idx: number) => (
              <div key={idx} className='flex items-start gap-2 border-b border-foreground/5 pb-1 last:border-0 last:pb-0'>
                <span className='shrink-0 text-foreground/30'>
                  {log.time ? new Date(log.time).toLocaleTimeString() : `#${idx + 1}`}
                </span>
                <span className='break-all text-foreground/80'>
                  {log.message || log.event || JSON.stringify(log)}
                </span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
