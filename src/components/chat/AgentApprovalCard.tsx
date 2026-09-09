import { useState } from "react";
import {
  ArrowUp,
  Check,
  ChevronRight,
  CircleDollarSign,
  Globe2,
  Mail,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type {
  AgentApprovalRequest,
  AgentApprovalStep,
} from "@/lib/chat/agentApproval";

type Props = {
  request: AgentApprovalRequest;
  onApprove: (request: AgentApprovalRequest) => void;
  onAdjust: (request: AgentApprovalRequest) => void;
  onDecline: (request: AgentApprovalRequest) => void;
  disabled?: boolean;
};

const stepIcon = (step: AgentApprovalStep) => {
  switch (step.kind) {
    case "browser":
      return Globe2;
    case "email":
      return Mail;
    case "credits":
      return CircleDollarSign;
    case "data":
      return Trash2;
    default:
      return ShieldCheck;
  }
};

export const AgentApprovalCard = ({
  request,
  onApprove,
  onAdjust,
  onDecline,
  disabled = false,
}: Props) => {
  const [localDecision, setLocalDecision] = useState<"pending" | "approved" | "declined">("pending");
  const [showAll, setShowAll] = useState(false);
  const decision = request.decision || localDecision;
  const visibleSteps = showAll ? request.steps : request.steps.slice(0, 3);
  const extraSteps = request.steps.length - visibleSteps.length;

  const approve = () => {
    setLocalDecision("approved");
    onApprove(request);
  };

  const decline = () => {
    setLocalDecision("declined");
    onDecline(request);
  };

  if (decision === "approved") {
    return (
      <div className="my-3 flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/[0.08] px-3 py-2.5 text-xs text-brand">
        <span className="flex size-5 items-center justify-center rounded-full bg-brand text-background">
          <Check className="size-3" strokeWidth={3} />
        </span>
        <span className="font-medium">Plan approved. JobRaker is continuing with these steps.</span>
      </div>
    );
  }

  if (decision === "declined") {
    return (
      <div className="my-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
        This plan was not approved. You can ask JobRaker to adjust it instead.
      </div>
    );
  }

  return (
    <section
      aria-labelledby={`agent-approval-${request.id}`}
      className="my-3 max-w-xl overflow-hidden rounded-2xl border border-brand/30 bg-card shadow-[0_16px_40px_rgba(0,0,0,0.24)]"
    >
      <div className="border-b border-border/70 bg-brand/[0.045] px-4 py-3.5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-brand/35 bg-brand/[0.12] text-brand">
            <ShieldCheck className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand">Agent approval</p>
            <h3 id={`agent-approval-${request.id}`} className="mt-1 text-sm font-semibold text-foreground">
              {request.title}
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{request.description}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Proposed steps
        </p>
        <ol className="space-y-1.5">
          {visibleSteps.map((step, index) => {
            const Icon = stepIcon(step);
            return (
              <li key={step.approvalKey} className="flex items-start gap-2.5 rounded-lg bg-background/50 px-2.5 py-2">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-brand/[0.1] text-[10px] font-semibold text-brand">
                  {index + 1}
                </span>
                <Icon className="mt-1 size-3.5 shrink-0 text-brand" />
                <span className="min-w-0 text-xs leading-5 text-muted-foreground">
                  <span className="font-medium text-foreground">{step.title}</span>
                  {step.detail ? <span className="block text-muted-foreground/85">{step.detail}</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
        {extraSteps > 0 ? (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand transition-colors hover:text-brand/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            Show {extraSteps} more step{extraSteps === 1 ? "" : "s"}
            <ChevronRight className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-4 py-3">
        <button
          type="button"
          onClick={decline}
          disabled={disabled}
          className="rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          Not now
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAdjust(request)}
            disabled={disabled}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-brand/45 hover:bg-brand/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            Adjust plan
          </button>
          <button
            type="button"
            onClick={approve}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-background shadow-[0_8px_18px_rgba(47,217,104,0.18)] transition-transform hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            Approve {request.steps.length === 1 ? "step" : "plan"}
            <ArrowUp className="size-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
};
