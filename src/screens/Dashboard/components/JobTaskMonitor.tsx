import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Square,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  JobIntelligenceTask,
  JobTaskStatus,
} from "@/hooks/useJobIntelligenceTasks";

interface JobTaskMonitorProps {
  tasks: JobIntelligenceTask[];
  onStop: (task: JobIntelligenceTask) => void;
  onRetry: (task: JobIntelligenceTask) => void;
}

const statusCopy: Record<JobTaskStatus, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  canceled: "Canceled",
};

const getProgress = (task: JobIntelligenceTask) => {
  if (task.progress_total <= 0) return task.status === "completed" ? 100 : 0;
  return Math.max(
    0,
    Math.min(100, Math.round((task.progress_current / task.progress_total) * 100)),
  );
};

const getStatusIcon = (status: JobTaskStatus) => {
  if (status === "running" || status === "queued") {
    return <Loader2 className='h-3.5 w-3.5 animate-spin text-brand' />;
  }
  if (status === "completed") {
    return <CheckCircle2 className='h-3.5 w-3.5 text-brand' />;
  }
  return <AlertTriangle className='h-3.5 w-3.5 text-brand' />;
};

const getUpdatedCopy = (task: JobIntelligenceTask) => {
  const parsed = Date.parse(task.updated_at || task.created_at);
  if (Number.isNaN(parsed)) return null;

  const minutes = Math.max(0, Math.floor((Date.now() - parsed) / 60000));
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  return `Updated ${hours}h ago`;
};

export function JobTaskMonitor({
  tasks,
  onStop,
  onRetry,
}: JobTaskMonitorProps) {
  const [dismissedTaskIds, setDismissedTaskIds] = useState<Set<string>>(new Set());
  const [, setRenderTrigger] = useState(0);

  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = [];
    const now = Date.now();

    tasks.forEach((task) => {
      const isTerminal =
        task.status === "completed" ||
        task.status === "failed" ||
        task.status === "canceled";

      if (isTerminal) {
        const completedTime = task.completed_at ? Date.parse(task.completed_at) : null;
        if (completedTime) {
          const age = now - completedTime;
          const maxAge = task.status === "completed" ? 5000 : 15000; // 5s for completed, 15s for failed/canceled
          if (age < maxAge) {
            const timeout = setTimeout(() => {
              setRenderTrigger((prev) => prev + 1);
            }, maxAge - age);
            timeouts.push(timeout);
          }
        }
      }
    });

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [tasks]);

  // Find all task IDs that have been retried (so we can hide the original/old failed task)
  const retriedTaskIds = new Set<string>();
  tasks.forEach((task) => {
    if (task.retry_of) {
      retriedTaskIds.add(task.retry_of);
    }
  });

  const visibleTasks = tasks
    .filter((task) => {
      if (dismissedTaskIds.has(task.id)) return false;
      if (retriedTaskIds.has(task.id)) return false;

      const isTerminal =
        task.status === "completed" ||
        task.status === "failed" ||
        task.status === "canceled";

      if (isTerminal) {
        const completedTime = task.completed_at ? Date.parse(task.completed_at) : null;
        if (completedTime) {
          const maxAge = task.status === "completed" ? 5000 : 15000;
          return Date.now() - completedTime < maxAge;
        }
      }

      return true;
    })
    .slice(0, 4);

  if (!visibleTasks.length) {
    return null;
  }

  return (
    <Card className='mb-4 overflow-hidden border border-foreground/10 bg-card/80 p-4'>
      <div className='mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <div className='text-sm font-semibold text-foreground'>
            Jobraker task registry
          </div>
          <p className='text-xs text-foreground/50'>
            Live progress for Scout and cleanup tasks.
          </p>
        </div>
      </div>

      <div className='space-y-3'>
        {visibleTasks.map((task) => {
          const progress = getProgress(task);
          const isActive = task.status === "queued" || task.status === "running";
          const canRetry = task.status === "failed" || task.status === "canceled";
          const updatedCopy = getUpdatedCopy(task);

          return (
            <div
              key={task.id}
              className='rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3'
            >
              <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div className='min-w-0 flex-1 space-y-1'>
                  <div className='flex flex-wrap items-center gap-2'>
                    {getStatusIcon(task.status)}
                    <span className='truncate text-sm font-medium text-foreground'>
                      {task.title}
                    </span>
                    <span className='rounded-full border border-foreground/10 bg-foreground/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-foreground/45'>
                      {statusCopy[task.status]}
                    </span>
                  </div>
                  {task.message ? (
                    <p className='text-xs text-foreground/55'>{task.message}</p>
                  ) : null}
                  {updatedCopy ? (
                    <p className='text-[10px] uppercase tracking-wide text-foreground/35'>
                      {updatedCopy}
                    </p>
                  ) : null}
                </div>

                <div className='flex items-center gap-2'>
                  {isActive ? (
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      className='h-8 border-foreground/15 bg-foreground/5 px-2 text-xs text-foreground/70 hover:border-brand/40 hover:text-brand'
                      onClick={() => onStop(task)}
                    >
                      <Square className='mr-1.5 h-3.5 w-3.5' />
                      Stop
                    </Button>
                  ) : null}
                  {canRetry ? (
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      className='h-8 border-foreground/15 bg-foreground/5 px-2 text-xs text-foreground/70 hover:border-brand/40 hover:text-brand'
                      onClick={() => onRetry(task)}
                    >
                      <RotateCcw className='mr-1.5 h-3.5 w-3.5' />
                      Retry
                    </Button>
                  ) : null}
                  {!isActive ? (
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className='h-8 w-8 p-0 text-foreground/40 hover:bg-foreground/5 hover:text-foreground/75'
                      onClick={() => setDismissedTaskIds((prev) => {
                        const next = new Set(prev);
                        next.add(task.id);
                        return next;
                      })}
                      title="Dismiss task"
                    >
                      <X className='h-3.5 w-3.5' />
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className='mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/10'>
                <div
                  className='h-full rounded-full bg-brand transition-all duration-500'
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className='mt-1.5 text-right text-[10px] text-foreground/40'>
                {task.progress_total > 0
                  ? `${task.progress_current}/${task.progress_total}`
                  : `${progress}%`}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
