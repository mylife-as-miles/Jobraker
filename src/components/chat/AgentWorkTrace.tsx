import { type ReactNode, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ExternalLink,
  ListChecks,
  Search,
  Sparkles,
} from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";

export type AgentTraceSource = {
  href: string;
  label: string;
};

export type AgentTraceRow = {
  id: string;
  kind: string;
  status: "running" | "done" | "error";
  label: string;
  detail?: string;
  sources?: AgentTraceSource[];
};

type AgentWorkTraceProps = {
  rows: AgentTraceRow[];
  reasoningRows: AgentTraceRow[];
  searchRows: AgentTraceRow[];
  isStreaming: boolean;
  stepLabel: string;
  summaryLabel: string;
  estimatedTimeSaved: number;
  hiddenStepCount: number;
  fallbackLabel: string;
  traceId: string;
};

const rowIcon = (row: AgentTraceRow) => {
  if (row.status === "error") {
    return <AlertTriangle className="size-3.5 shrink-0 text-red-400" />;
  }
  if (row.status === "running") {
    return (
      <ThinkingOrb
        state={row.kind === "tool" ? "searching" : "working"}
        size={20}
        className="shrink-0"
        aria-label="Jobbraker is working"
      />
    );
  }
  return <Check className="size-3.5 shrink-0 text-brand" />;
};

const TraceRows = ({
  rows,
  emptyLabel,
}: {
  rows: AgentTraceRow[];
  emptyLabel?: string;
}) => {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  if (!rows.length) {
    return emptyLabel ? <p className="px-2 py-1.5 text-xs text-muted-foreground">{emptyLabel}</p> : null;
  }

  return (
    <div className="relative ml-1 mt-2 border-l border-brand/20 pl-3">
      <div className="space-y-1">
        {rows.map((row) => {
          const isExpanded = Boolean(expandedRows[row.id]);
          const rowText = row.detail ? `${row.label} — ${row.detail}` : row.label;
          return (
            <div key={row.id} className="relative">
              <span
                aria-hidden="true"
                className={`absolute -left-[17px] top-3 size-1.5 rounded-full ${
                  row.status === "error" ? "bg-red-400" : row.status === "running" ? "bg-brand animate-pulse" : "bg-brand/60"
                }`}
              />
              <button
                type="button"
                onClick={() => setExpandedRows((current) => ({ ...current, [row.id]: !isExpanded }))}
                aria-expanded={isExpanded}
                className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs leading-5 text-muted-foreground transition-colors hover:bg-brand/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                title={rowText}
              >
                {rowIcon(row)}
                <span className={isExpanded ? "min-w-0 flex-1 whitespace-pre-wrap" : "min-w-0 flex-1 truncate"}>
                  {rowText}
                </span>
                <ChevronDown className={`mt-0.5 size-3 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </button>
              {row.sources && row.sources.length > 0 && (
                <div className="ml-7 flex flex-wrap gap-1 pb-1 pt-0.5">
                  {row.sources.map((source) => (
                    <a
                      key={source.href}
                      href={source.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1 rounded bg-brand/[0.08] px-1.5 py-1 text-[11px] text-brand transition-colors hover:bg-brand/[0.15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                    >
                      <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{source.label}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TraceSection = ({
  title,
  description,
  icon,
  rows,
  defaultOpen = true,
  emptyLabel,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  rows: AgentTraceRow[];
  defaultOpen?: boolean;
  emptyLabel?: string;
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-b border-foreground/[0.07] py-2.5 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        <span className="text-brand">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-foreground">{title}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{description}</span>
        </span>
        <span className="rounded-full bg-brand/[0.08] px-1.5 py-0.5 text-[10px] tabular-nums text-brand">
          {rows.length}
        </span>
        <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <TraceRows rows={rows} emptyLabel={emptyLabel} />}
    </section>
  );
};

export function AgentWorkTrace({
  rows,
  reasoningRows,
  searchRows,
  isStreaming,
  stepLabel,
  summaryLabel,
  estimatedTimeSaved,
  hiddenStepCount,
  fallbackLabel,
  traceId,
}: AgentWorkTraceProps) {
  const [expanded, setExpanded] = useState(false);
  const liveRows = useMemo(
    () => (isStreaming ? rows.slice(-3).reverse() : rows),
    [isStreaming, rows],
  );
  const displayedHiddenSteps = hiddenStepCount + Math.max(0, rows.length - liveRows.length);

  return (
    <div className="mb-3 space-y-2">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={traceId}
        className="flex w-full max-w-full items-center gap-2 rounded-lg border border-brand/20 bg-brand/[0.06] px-3 py-2 text-left text-[13px] leading-5 text-muted-foreground transition-colors hover:bg-brand/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        {isStreaming ? (
          <ThinkingOrb state={rows.length ? "working" : "connecting"} size={20} className="shrink-0" aria-label="Jobbraker is working" />
        ) : (
          <ListChecks className="size-3.5 shrink-0 text-brand" />
        )}
        <span className="shrink-0 font-medium text-foreground/80">Working process</span>
        <span className="shrink-0 text-muted-foreground/70">-</span>
        <span className="shrink-0">{stepLabel}</span>
        {estimatedTimeSaved > 0 && (
          <>
            <span className="hidden shrink-0 text-muted-foreground/70 md:inline">-</span>
            <span className="hidden shrink-0 text-brand/90 md:inline">~{estimatedTimeSaved} min saved</span>
          </>
        )}
        <span className="hidden shrink-0 text-muted-foreground/70 sm:inline">-</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground/80">{summaryLabel}</span>
        <ChevronDown className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div id={traceId} className="overflow-hidden rounded-lg border border-brand/15 bg-brand/[0.025] px-2.5" aria-label="Jobbraker work trace">
          <TraceSection title="Steps" description="Completed and active work" icon={<ListChecks className="size-3.5" />} rows={liveRows} emptyLabel={isStreaming ? fallbackLabel : undefined} />
          <TraceSection title="Reasoning summary" description="Safe operational context, not private model reasoning" icon={<Sparkles className="size-3.5" />} rows={reasoningRows.slice(-4)} defaultOpen={false} emptyLabel="No additional operational context was needed." />
          <TraceSection title="Search" description="Queries and sources Jobbraker used" icon={<Search className="size-3.5" />} rows={searchRows} defaultOpen={false} emptyLabel="No search was needed for this response." />
          {displayedHiddenSteps > 0 && (
            <p className="border-t border-foreground/[0.07] px-2 py-2 text-xs text-muted-foreground">
              +{displayedHiddenSteps} earlier working step{displayedHiddenSteps === 1 ? "" : "s"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
