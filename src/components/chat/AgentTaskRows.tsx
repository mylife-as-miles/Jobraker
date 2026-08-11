import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, LoaderCircle, StopCircle } from "lucide-react";

export type AgentTaskStatus = "running" | "failed" | "completed";

export type AgentTaskRow = {
  id: string;
  label: string;
  detail?: string;
  status: AgentTaskStatus;
  steps?: string[];
};

type Props = {
  tasks: AgentTaskRow[];
  elapsedLabel: string;
  onStop: () => void;
};

const TaskStatusIcon = ({ status }: { status: AgentTaskStatus }) => {
  if (status === "running") {
    return <LoaderCircle aria-label="Running" className="size-4 animate-spin text-brand" />;
  }
  if (status === "failed") {
    return <AlertTriangle aria-label="Failed" className="size-4 text-rose-400" />;
  }
  return <Check aria-label="Completed" className="size-4 text-brand" strokeWidth={3} />;
};

const statusLabel: Record<AgentTaskStatus, string> = {
  running: "Running",
  failed: "Failed",
  completed: "Completed",
};

export const AgentTaskRows = ({ tasks, elapsedLabel, onStop }: Props) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <section
      aria-label="Live agent task status"
      className="mx-auto mt-3 w-full max-w-xl overflow-hidden rounded-xl border border-brand/25 bg-card/95 shadow-lg shadow-black/10 backdrop-blur"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-3.5 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Live task status</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Running for {elapsedLabel || "a moment"}. You can keep this chat open while it finishes.
          </p>
        </div>
        <button
          type="button"
          onClick={onStop}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-rose-400/50 hover:bg-rose-500/10 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          <StopCircle className="size-3.5" />
          Stop
        </button>
      </div>

      <ul className="divide-y divide-border/65" role="list">
        {tasks.map((task) => {
          const isExpanded = Boolean(expanded[task.id]);
          const hasDetails = Boolean(task.detail || task.steps?.length);
          return (
            <li key={task.id}>
              <button
                type="button"
                disabled={!hasDetails}
                aria-expanded={hasDetails ? isExpanded : undefined}
                onClick={() =>
                  hasDetails &&
                  setExpanded((current) => ({ ...current, [task.id]: !current[task.id] }))
                }
                className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left transition-colors enabled:hover:bg-brand/[0.045] disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/60"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-background">
                  <TaskStatusIcon status={task.status} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-foreground">{task.label}</span>
                  {task.detail ? (
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{task.detail}</span>
                  ) : null}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    task.status === "running"
                      ? "bg-brand/[0.12] text-brand"
                      : task.status === "failed"
                        ? "bg-rose-500/10 text-rose-300"
                        : "bg-brand/[0.08] text-brand"
                  }`}
                >
                  {statusLabel[task.status]}
                </span>
                {hasDetails ? (
                  <ChevronDown
                    aria-hidden="true"
                    className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                ) : null}
              </button>
              {hasDetails && isExpanded ? (
                <div className="border-t border-border/50 bg-background/45 px-12 py-2.5 text-xs leading-5 text-muted-foreground">
                  {task.detail ? <p>{task.detail}</p> : null}
                  {task.steps?.length ? (
                    <ul className="mt-1.5 space-y-1" role="list">
                      {task.steps.map((step) => (
                        <li key={step} className="flex gap-2">
                          <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-brand" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
