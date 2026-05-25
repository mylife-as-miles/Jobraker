import { useState } from "react";
import {
  Building2,
  ExternalLink,
  Mail,
  Copy,
  PenTool,
  CheckCircle2,
  AlertCircle,
  Search,
  Globe,
} from "lucide-react";

export interface CompanyScoutResult {
  companyName: string;
  domain: string;
  careersPageUrl: string;
  contactEmail: string;
  publicContactChannels: string[];
  confidence: "high" | "medium" | "low";
  foundSource: string;
}

export interface CompanyScoutOutput {
  results: CompanyScoutResult[];
  summary: {
    total: number;
    foundEmails: number;
    needsVerification: number;
  };
  progress?: string[];
  needsClarification?: {
    reason: string;
    suggestedPrompts: string[];
  };
}

type Props = {
  output: CompanyScoutOutput;
  onRunPrompt?: (prompt: string) => void;
};

const confidenceClass = {
  high: "border-brand/30 bg-brand/10 text-brand",
  medium: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  low: "border-red-400/30 bg-red-400/10 text-red-200",
};

export const CompanyScoutSkillCard = ({ output, onRunPrompt }: Props) => {
  const [notice, setNotice] = useState<string>(
    "Company Scout found contact channels. You can visit their careers pages, copy emails, or draft custom outreach messages immediately."
  );

  const runOrCopyPrompt = async (prompt: string, fallbackNotice: string) => {
    if (onRunPrompt) {
      onRunPrompt(prompt);
      return;
    }
    try {
      await navigator.clipboard.writeText(prompt);
      setNotice(fallbackNotice);
    } catch {
      setNotice("Failed to copy prompt.");
    }
  };

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setNotice(`Copied email address: ${email}`);
    } catch {
      setNotice("Failed to copy email.");
    }
  };

  const copyAllFindings = async () => {
    try {
      const text = output.results
        .map(
          (r) =>
            `${r.companyName} (${r.domain})\nCareers: ${r.careersPageUrl}\nEmail: ${r.contactEmail || "None"}\nSource: ${r.foundSource}`
        )
        .join("\n\n");
      await navigator.clipboard.writeText(text);
      setNotice("Scout findings copied to clipboard!");
    } catch {
      setNotice("Failed to copy findings.");
    }
  };

  if (output.needsClarification && (!output.results || output.results.length === 0)) {
    return (
      <div className="rounded-2xl border border-amber-400/25 bg-background/70 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-400/10 text-amber-200">
            <Search className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Company Scout needs a target
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {output.needsClarification.reason}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {output.needsClarification.suggestedPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void runOrCopyPrompt(prompt, "Prompt copied to clipboard.")}
              className="block w-full rounded-xl border border-border bg-card/45 px-3 py-2 text-left text-xs leading-relaxed text-foreground transition hover:border-brand/30 hover:bg-brand/10"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-brand/20 bg-background/70 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand/20 bg-brand/10 text-brand">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Company Scout Results
              </h3>
              <p className="text-xs text-muted-foreground">
                Found {output.summary.total} target companies &middot; {output.summary.foundEmails} contact emails
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[11px] font-semibold text-brand">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Research Complete
          </span>
        </div>

        {/* List of findings */}
        <div className="mt-4 space-y-3">
          {output.results.map((result) => (
            <div
              key={result.companyName}
              className="rounded-xl border border-border/70 bg-card/45 p-4 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    {result.companyName}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({result.domain})
                    </span>
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Source: {result.foundSource}
                  </p>
                </div>
                <span
                  className={`inline-flex w-fit rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${confidenceClass[result.confidence]}`}
                >
                  {result.confidence} confidence
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 text-xs">
                {result.careersPageUrl && (
                  <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 p-2.5">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5" />
                      Careers Page
                    </span>
                    <a
                      href={result.careersPageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-brand hover:underline font-medium"
                    >
                      Visit site
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}

                <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 p-2.5">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </span>
                  {result.contactEmail ? (
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">{result.contactEmail}</span>
                      <button
                        onClick={() => copyEmail(result.contactEmail)}
                        className="text-muted-foreground hover:text-foreground transition"
                        title="Copy Email"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic">None found</span>
                  )}
                </div>
              </div>

              {result.publicContactChannels && result.publicContactChannels.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider self-center mr-1">
                    Channels:
                  </span>
                  {result.publicContactChannels.map((chan) => (
                    <span
                      key={chan}
                      className="inline-flex items-center rounded bg-accent/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {chan}
                    </span>
                  ))}
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    runOrCopyPrompt(
                      `@OutreachWriter write a targeted outreach note for ${result.companyName}`,
                      `Draft prompt copied: @OutreachWriter write outreach for ${result.companyName}`
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand/20 bg-brand/5 px-2.5 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand/10"
                >
                  <PenTool className="h-3.5 w-3.5" />
                  Draft outreach note
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Card Footer Actions */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={copyAllFindings}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-accent/40"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy all findings
          </button>
        </div>

        <p className="mt-3 rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
          {notice}
        </p>
      </div>
    </div>
  );
};
