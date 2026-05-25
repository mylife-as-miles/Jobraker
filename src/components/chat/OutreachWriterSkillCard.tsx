import { useState } from "react";
import {
  Copy,
  Mail,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface OutreachWriterResult {
  companyName: string;
  role: string;
  subject: string;
  body: string;
  publicProfileUrl?: string;
  status: string;
}

interface OutreachWriterOutput {
  results: OutreachWriterResult[];
  summary: {
    total: number;
    success: number;
    failed: number;
  };
}

type Props = {
  output: OutreachWriterOutput;
  onRunPrompt?: (prompt: string) => void;
};

export const OutreachWriterSkillCard = ({ output, onRunPrompt }: Props) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [notice, setNotice] = useState<string>(
    "Outreach drafts created. You can select a company, copy its message, save it as a Gmail draft, or set a follow-up reminder."
  );
  const [remindersSet, setRemindersSet] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);

  const result = output.results?.[activeIndex];

  if (!result) {
    return (
      <div className="rounded-2xl border border-red-400/25 bg-background/70 p-4 text-xs text-red-200">
        <AlertCircle className="h-4 w-4 inline mr-2" />
        No outreach drafts found.
      </div>
    );
  }

  const copyToClipboard = async () => {
    try {
      const fullText = `Subject: ${result.subject}\n\n${result.body}`;
      await navigator.clipboard.writeText(fullText);
      setNotice(`Outreach draft for ${result.companyName} copied to clipboard!`);
    } catch {
      setNotice("Failed to copy outreach draft.");
    }
  };

  const createGmailDraft = () => {
    if (onRunPrompt) {
      const cmd = `Create a connected Gmail draft for my outreach message to ${result.companyName}. Use create_gmail_job_draft with To: recruitment@${result.companyName.toLowerCase().replace(/\s+/g, "")}.com, Subject: ${result.subject}, Body:\n${result.body}`;
      onRunPrompt(cmd);
    } else {
      setNotice("Gmail integration is available when connected to chat.");
    }
  };

  const setFollowUpReminder = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setNotice("Please sign in to set follow-up reminders.");
        return;
      }

      const reminderDate = new Date();
      reminderDate.setDate(reminderDate.getDate() + 3); // 3 days

      const { error } = await supabase.from("notifications").insert({
        user_id: user.id,
        type: "application",
        title: `Follow-up reminder: ${result.companyName}`,
        message: `It has been 3 days since you drafted outreach for the ${result.role} position at ${result.companyName}. Scan your inbox or send a follow-up.`,
        company: result.companyName,
        priority: "medium",
        created_at: reminderDate.toISOString(),
      });

      if (error) throw error;
      setRemindersSet((prev) => ({ ...prev, [activeIndex]: true }));
      setNotice(`Follow-up reminder set for ${result.companyName} on ${reminderDate.toLocaleDateString()} (3 days from now).`);
    } catch (err: any) {
      console.error(err);
      setNotice("Failed to set reminder: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const isReminderSet = remindersSet[activeIndex] || false;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-brand/20 bg-background/70 p-4">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand/20 bg-brand/10 text-brand">
              <FileCheck2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Outreach Writer Drafts
              </h3>
              <p className="text-xs text-muted-foreground">
                Generated {output.results.length} draft{output.results.length === 1 ? "" : "s"} &middot; {output.summary.success} successful
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[11px] font-semibold text-brand">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Ready for review
          </span>
        </div>

        {/* Company Selector Tab Bar (if there are multiple companies) */}
        {output.results.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-2.5 mb-3 border-b border-border/40 scrollbar-none">
            {output.results.map((r, idx) => (
              <button
                key={`${r.companyName}-${idx}`}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition border ${
                  activeIndex === idx
                    ? "border-brand/40 bg-brand/10 text-brand"
                    : "border-border/60 bg-transparent text-muted-foreground hover:bg-accent/25 hover:text-foreground"
                }`}
              >
                {r.companyName}
              </button>
            ))}
          </div>
        )}

        {/* Active Draft Details */}
        <div className="rounded-xl border border-border/70 bg-card/45 p-4 space-y-3">
          <div className="flex justify-between items-center text-xs text-muted-foreground pb-2 border-b border-border/20">
            <span>Company: <strong className="text-foreground">{result.companyName}</strong></span>
            <span>Role: <strong className="text-foreground">{result.role}</strong></span>
          </div>

          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Subject Line
            </span>
            <span className="text-sm font-medium text-foreground block mt-1">
              {result.subject}
            </span>
          </div>

          <div className="border-t border-border/40 pt-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Message Body
            </span>
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap mt-1">
              {result.body}
            </p>
          </div>

          {result.publicProfileUrl && (
            <div className="border-t border-border/40 pt-3 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Portfolio Preview Link
              </span>
              <a
                href={result.publicProfileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-brand hover:underline font-medium"
              >
                Open Portfolio
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={copyToClipboard}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand/25 bg-brand px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-brand/90"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy message
          </button>
          <button
            type="button"
            onClick={createGmailDraft}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-accent/40"
          >
            <Mail className="h-3.5 w-3.5" />
            Create Gmail draft
          </button>
          <button
            type="button"
            disabled={isReminderSet || loading}
            onClick={setFollowUpReminder}
            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
              isReminderSet
                ? "border-green-400/20 bg-green-400/10 text-green-200 cursor-not-allowed"
                : "border-border bg-background/70 text-foreground hover:bg-accent/40"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            {isReminderSet ? "Reminder scheduled" : "Set reminder (3d)"}
          </button>
        </div>

        <p className="mt-3 rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
          {notice}
        </p>
      </div>
    </div>
  );
};
