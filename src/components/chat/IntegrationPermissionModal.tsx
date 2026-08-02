import React from "react";
import { Shield, Check, X, Lock } from "lucide-react";

export type PendingPermissionRequest = {
  integrationSlug: string;
  integrationName: string;
  toolName: string;
  toolSummary: string;
  icon?: string;
  resolve: (decision: "allow_always" | "allow_once" | "deny") => void;
};

type Props = {
  request: PendingPermissionRequest | null;
  onRespond: (decision: "allow_always" | "allow_once" | "deny") => void;
};

export const IntegrationPermissionModal: React.FC<Props> = ({
  request,
  onRespond,
}) => {
  if (!request) return null;

  const { integrationName, toolSummary } = request;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border/80 bg-card/95 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="flex items-center gap-3 border-b border-border/50 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-brand/20 bg-brand/10 text-brand">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Security Consent
            </span>
            <h3 className="text-base font-semibold text-foreground">
              Allow JobRaker to use {integrationName}?
            </h3>
          </div>
        </div>

        <div className="py-5 space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            JobRaker AI needs permission to run <strong className="text-foreground">{toolSummary}</strong> using your connected <strong className="text-foreground">{integrationName}</strong> account.
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0 text-brand" />
            <span>Your credentials and tokens are securely encrypted. You can revoke access anytime in Settings.</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={() => onRespond("allow_always")}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-medium text-primary-foreground transition-all hover:opacity-95 active:scale-[0.98]"
          >
            <Check className="h-4 w-4" />
            Always allow {integrationName}
          </button>
          <button
            type="button"
            onClick={() => onRespond("allow_once")}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary/80 px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-secondary active:scale-[0.98]"
          >
            Allow once for this turn
          </button>
          <button
            type="button"
            onClick={() => onRespond("deny")}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-transparent px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive hover:bg-destructive/10"
          >
            <X className="h-3.5 w-3.5" />
            Deny access
          </button>
        </div>
      </div>
    </div>
  );
};
