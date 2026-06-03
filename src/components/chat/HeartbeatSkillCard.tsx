import { useState } from "react";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  ArrowRight,
  RefreshCw,
  Zap,
} from "lucide-react";

export interface HeartbeatCheck {
  id: string;
  name: string;
  status: "success" | "warning" | "info" | "error";
  details: string;
}

export interface HeartbeatRecommendation {
  id: string;
  type: "follow_up" | "draft" | "review";
  companyName: string;
  role: string;
  description: string;
  actionPrompt: string;
}

export interface HeartbeatOutput {
  checks: HeartbeatCheck[];
  recommendations: HeartbeatRecommendation[];
  progress?: string[];
  summary: {
    totalChecks: number;
    healthyChecks: number;
    recommendationsCount: number;
  };
}

type Props = {
  output: HeartbeatOutput;
  onRunPrompt?: (prompt: string) => void;
};

const statusIcon = {
  success: <CheckCircle2 className="h-4 w-4 text-green-400" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-400" />,
  info: <Info className="h-4 w-4 text-blue-400" />,
  error: <XCircle className="h-4 w-4 text-red-400" />,
};

const statusBorderClass = {
  success: "border-green-500/20 bg-green-500/5",
  warning: "border-amber-500/20 bg-amber-500/5",
  info: "border-blue-500/20 bg-blue-500/5",
  error: "border-red-500/20 bg-red-500/5",
};

export const HeartbeatSkillCard = ({ output, onRunPrompt }: Props) => {
  const [notice, setNotice] = useState<string>(
    "Hermes Agent Heartbeat system is active. Review diagnostic logs or trigger the recommended tasks below."
  );

  const runRecommendation = (prompt: string) => {
    if (onRunPrompt) {
      onRunPrompt(prompt);
    } else {
      setNotice(`Action prompt: "${prompt}" (Available when connected to chat).`);
    }
  };

  const reRunCheckup = () => {
    if (onRunPrompt) {
      onRunPrompt("/heartbeat");
    }
  };

  const isFullyHealthy = output.summary.healthyChecks === output.summary.totalChecks;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-brand/20 bg-background/70 p-4">
        {/* Card Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand/20 bg-brand/10 text-brand">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Hermes Agent Checkup
              </h3>
              <p className="text-xs text-muted-foreground">
                {output.summary.healthyChecks} of {output.summary.totalChecks} checks healthy
              </p>
            </div>
          </div>
          <span
            className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${
              isFullyHealthy
                ? "border-green-400/25 bg-green-400/10 text-green-200"
                : "border-amber-400/25 bg-amber-400/10 text-amber-200"
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {isFullyHealthy ? "System Healthy" : "Action Required"}
          </span>
        </div>

        {/* Diagnostic Checklist */}
        <div className="mt-4 space-y-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            System Diagnostics
          </span>
          <div className="grid gap-2 sm:grid-cols-2">
            {output.checks.map((check) => (
              <div
                key={check.id}
                className={`rounded-xl border p-3 flex items-start gap-2.5 transition ${statusBorderClass[check.status]}`}
              >
                <div className="mt-0.5 shrink-0">{statusIcon[check.status]}</div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    {check.name}
                  </h4>
                  <p className="text-[11px] leading-relaxed text-muted-foreground mt-0.5">
                    {check.details}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Proactive Recommendations */}
        {output.recommendations.length > 0 && (
          <div className="mt-4 space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Recommended Actions
            </span>
            <div className="space-y-2">
              {output.recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="rounded-xl border border-brand/20 bg-brand/5 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div>
                    <span className="inline-flex items-center gap-1 rounded bg-brand/10 px-1.5 py-0.5 text-[9px] font-bold text-brand uppercase tracking-wider mb-1.5">
                      <Zap className="h-2.5 w-2.5" />
                      {rec.type.replace("_", " ")}
                    </span>
                    <h4 className="text-xs font-semibold text-foreground">
                      {rec.companyName} &middot; {rec.role}
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {rec.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => runRecommendation(rec.actionPrompt)}
                    className="inline-flex items-center justify-center gap-1 self-end sm:self-center rounded-lg border border-brand/25 bg-brand px-2.5 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-brand/90"
                  >
                    Resolve
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Card Footer Actions */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={reRunCheckup}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-accent/40"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Rerun checkup
          </button>
        </div>

        <p className="mt-3 rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
          {notice}
        </p>
      </div>
    </div>
  );
};
