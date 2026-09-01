import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
} from "lucide-react";
import type { ColdMailOutput } from "@/lib/chatSkills/types";
import { invokeProtectedFunction } from "@/services/supabase/invokeProtectedFunction";

type Props = {
  output: ColdMailOutput;
};

type GmailDraftResponse = {
  success?: boolean;
  draftId?: string | null;
  messageId?: string | null;
  threadId?: string | null;
  draftFrom?: string;
  to?: string;
  error?: string;
};

export const ColdMailSkillCard = ({ output }: Props) => {
  const [creating, setCreating] = useState(false);
  const [draftId, setDraftId] = useState("");
  const [error, setError] = useState("");
  const { preparation } = output;

  const createGmailDraft = async () => {
    if (creating || draftId) return;
    setCreating(true);
    setError("");
    try {
      const response = await invokeProtectedFunction<GmailDraftResponse>(
        "cold-mail",
        {
          body: {
            action: "create_gmail_draft",
            preparationToken: output.preparationToken,
          },
        },
      );
      const confirmedDraftId =
        response?.success === true && typeof response.draftId === "string"
          ? response.draftId.trim()
          : "";
      if (!confirmedDraftId) {
        throw new Error(
          response?.error ||
            "Gmail did not return a draft ID, so draft creation could not be confirmed.",
        );
      }
      setDraftId(confirmedDraftId);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Gmail draft creation failed.",
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-brand/20 bg-background/70 p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand/20 bg-brand/10 text-brand">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Cold Mail
              </h3>
              <p className="text-xs text-muted-foreground">
                {preparation.jobTitle} at {preparation.companyName}
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[11px] font-semibold text-brand">
            {draftId ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Mail className="h-3.5 w-3.5" />
            )}
            {draftId ? "Created" : "Ready for approval"}
          </span>
        </div>

        <div className="space-y-3 rounded-xl border border-border/70 bg-card/45 p-4">
          <div className="flex flex-col gap-1 border-b border-border/20 pb-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              To: <strong className="text-foreground">{preparation.recipient.email}</strong>
            </span>
            <span className="capitalize">
              {preparation.recipient.confidence} confidence
            </span>
          </div>

          {(preparation.recipient.name || preparation.recipient.title) && (
            <p className="text-xs text-muted-foreground">
              {[preparation.recipient.name, preparation.recipient.title]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}

          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Subject
            </span>
            <span className="mt-1 block text-sm font-medium text-foreground">
              {preparation.subject}
            </span>
          </div>

          <div className="border-t border-border/40 pt-3">
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Message
            </span>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {preparation.body}
            </p>
          </div>

          {/^https?:\/\//i.test(preparation.recipient.source) && (
            <div className="border-t border-border/40 pt-3">
              <a
                href={preparation.recipient.source}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
              >
                Verified recipient source
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={creating || Boolean(draftId)}
          onClick={createGmailDraft}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand/25 bg-brand px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {creating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : draftId ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <Mail className="h-3.5 w-3.5" />
          )}
          {creating
            ? "Creating Gmail draft…"
            : draftId
              ? "Draft created in Gmail"
              : "Create Gmail draft"}
        </button>

        <div aria-live="polite">
          {draftId && (
            <p className="mt-3 rounded-xl border border-green-400/20 bg-green-400/10 px-3 py-2 text-xs text-green-200">
              Draft created in Gmail · Draft ID: {draftId}
            </p>
          )}
          {error && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
