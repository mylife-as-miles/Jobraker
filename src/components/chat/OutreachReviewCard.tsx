import React, { useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  Send,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { OutreachPackage } from "@/lib/outreach/types";
import { useSubscriptionTier } from "@/hooks/useSubscriptionTier";
import { invokeProtectedFunction } from "@/services/supabase/invokeProtectedFunction";
import { trackOutreachEvent } from "@/lib/outreach/outreachTelemetry";

export interface OutreachReviewCardProps {
  outreachPackage: OutreachPackage;
  onUpdatePackage?: (updated: OutreachPackage) => void;
  onRegenerateMessage?: () => Promise<void>;
  gmailConnected?: boolean;
  onConnectGmail?: () => void;
  className?: string;
}

export const OutreachReviewCard: React.FC<OutreachReviewCardProps> = ({
  outreachPackage,
  onUpdatePackage,
  onRegenerateMessage,
  gmailConnected = true,
  onConnectGmail,
  className = "",
}) => {
  const { subscriptionTier } = useSubscriptionTier();
  const isPaidSendAllowed = ["Basics", "Pro", "Ultimate"].includes(subscriptionTier);

  const [subject, setSubject] = useState(outreachPackage.message.subject || "");
  const [body, setBody] = useState(outreachPackage.message.body || "");
  const [showRationale, setShowRationale] = useState(false);
  const [copied, setCopied] = useState(false);

  // Delivery action states
  const [deliveringMode, setDeliveringMode] = useState<"draft" | "send" | null>(null);
  const [deliveryResult, setDeliveryResult] = useState<{
    draftId?: string;
    messageId?: string;
    error?: string;
  } | null>(
    outreachPackage.delivery.draftId || outreachPackage.delivery.messageId
      ? {
          draftId: outreachPackage.delivery.draftId,
          messageId: outreachPackage.delivery.messageId,
        }
      : null,
  );

  const contact = outreachPackage.contact;
  const opportunity = outreachPackage.opportunity;
  const evidenceList = outreachPackage.candidateEvidence || [];
  const reasons = contact.selectionReasons || [
    "Relevant role alignment for target position",
    "Verified company email domain",
  ];

  const hasEmail = Boolean(contact.email && contact.email.includes("@"));

  const handleSubjectChange = (val: string) => {
    setSubject(val);
    if (onUpdatePackage) {
      onUpdatePackage({
        ...outreachPackage,
        message: { ...outreachPackage.message, subject: val },
      });
    }
  };

  const handleBodyChange = (val: string) => {
    setBody(val);
    if (onUpdatePackage) {
      onUpdatePackage({
        ...outreachPackage,
        message: { ...outreachPackage.message, body: val },
      });
    }
  };

  // Lightweight AI revision actions
  const handleMakeShorter = () => {
    const lines = body.split("\n").filter((l) => l.trim().length > 0);
    // Condense into max 3 punchy sentences
    const greeting = lines[0] || `Hi ${contact.name?.split(" ")[0] || "there"},`;
    const signoff = lines[lines.length - 1]?.startsWith("Best") ? lines[lines.length - 1] : "Best,\nJobRaker Candidate";
    const contentLines = lines.slice(1, -1).filter((l) => !l.startsWith("Best") && !l.startsWith("Sincerely"));

    const condensedBody = [
      greeting,
      "",
      contentLines.slice(0, 2).join(" ").slice(0, 220) + ".",
      "",
      "Would you be open to a brief 10-minute conversation this week?",
      "",
      signoff,
    ].join("\n");

    setBody(condensedBody);
    trackOutreachEvent("message_edited", { actionType: outreachPackage.strategy.action, revision: "make_shorter" });
  };

  const handleMoreDirect = () => {
    const recipientFirst = contact.name ? contact.name.split(" ")[0] : "there";
    const directBody = `Hi ${recipientFirst},\n\nI saw the ${opportunity.jobTitle} position at ${opportunity.companyName}. With relevant experience matching this role, I'm confident I can make an immediate contribution to your team.\n\nWould you be open to connecting directly?\n\nBest,\nJobRaker Candidate`;
    setBody(directBody);
    trackOutreachEvent("message_edited", { actionType: outreachPackage.strategy.action, revision: "more_direct" });
  };

  const handleChangeCTA = () => {
    const ctas = [
      "Would you be open to a quick 10-minute chat this week?",
      "Are you available for a brief call, or would you prefer I send over a quick work sample?",
      "Could you point me to the hiring manager for this team if you are not directly managing it?",
    ];
    // Cycle CTA
    let nextCTA = ctas[0];
    for (let i = 0; i < ctas.length; i++) {
      if (body.includes(ctas[i])) {
        nextCTA = ctas[(i + 1) % ctas.length];
        setBody(body.replace(ctas[i], nextCTA));
        return;
      }
    }
    // If not found, append CTA before sign-off
    const lines = body.split("\n");
    const signoffIdx = lines.findIndex((l) => /^best|^sincerely|^regards/i.test(l.trim()));
    if (signoffIdx > 0) {
      lines.splice(signoffIdx, 0, nextCTA, "");
      setBody(lines.join("\n"));
    } else {
      setBody(body + `\n\n${nextCTA}`);
    }
    trackOutreachEvent("message_edited", { actionType: outreachPackage.strategy.action, revision: "change_cta" });
  };

  const handleCopyMessage = () => {
    const full = `Subject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateDraftOrSend = async (mode: "draft" | "send") => {
    if (deliveringMode) return;
    setDeliveringMode(mode);
    setDeliveryResult(null);

    try {
      const payload = outreachPackage.signedPreparationToken
        ? {
            action: "create_gmail_draft",
            preparationToken: outreachPackage.signedPreparationToken,
          }
        : {
            action: "create_gmail_draft",
            jobId: opportunity.jobId,
            companyName: opportunity.companyName,
            jobTitle: opportunity.jobTitle,
            recipientName: contact.name,
            recipientTitle: contact.title,
            recipientSource: contact.provenance?.sourceUrl || contact.provenance?.sourceType,
            recipientConfidence: contact.confidence >= 0.8 ? "high" : "medium",
            to: contact.email,
            subject,
            body,
          };

      const response = await invokeProtectedFunction<any>("cold-mail", {
        body: payload,
      });

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

      const draftId = confirmedDraftId;
      trackOutreachEvent("gmail_draft_created", {
        actionType: outreachPackage.strategy.action,
        jobId: opportunity.jobId,
        draftId,
      });

      if (mode === "send" && isPaidSendAllowed) {
        const sendRes = await invokeProtectedFunction<any>("cold-mail", {
          body: {
            action: "send_gmail_draft",
            draftId,
          },
        });
        if (!sendRes || sendRes.success === false || !sendRes.messageId) {
          throw new Error(sendRes?.error || "Draft created, but message delivery could not be confirmed.");
        }
        setDeliveryResult({ draftId, messageId: sendRes.messageId });
        trackOutreachEvent("email_sent", {
          actionType: outreachPackage.strategy.action,
          jobId: opportunity.jobId,
          messageId: sendRes.messageId,
        });
      } else {
        setDeliveryResult({ draftId });
      }
    } catch (err: any) {
      setDeliveryResult({
        error: err?.message || "Delivery failed. Please check your Gmail connection and try again.",
      });
    } finally {
      setDeliveringMode(null);
    }
  };

  return (
    <div className={`space-y-4 rounded-2xl border border-brand/25 bg-card/90 p-4 shadow-xl backdrop-blur-sm sm:p-5 ${className}`}>
      {/* Header: Opportunity & Recruiter Profile */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Mail className="h-4 w-4" />
            </span>
            <h3 className="text-base font-semibold text-foreground">
              {contact.name || `${opportunity.companyName} Recruiting Team`}
            </h3>
            {hasEmail ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                <ShieldCheck className="h-3 w-3" />
                Verified work email
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">
                LinkedIn profile ready
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {contact.title ? `${contact.title} · ` : ""}{opportunity.companyName} ({opportunity.jobTitle})
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowRationale(!showRationale)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Why {contact.name ? contact.name.split(" ")[0] : "this person"}?
          {showRationale ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Why Jobraker Chose This Person Collapsible */}
      {showRationale && (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs space-y-1.5 animate-in fade-in-50 duration-200">
          <p className="font-semibold text-foreground">Selection rationale:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
            {contact.verification && (
              <li>Verification level: {contact.verification.replace(/_/g, " ")}</li>
            )}
          </ul>
        </div>
      )}

      {/* Disconnected Gmail Alert */}
      {!gmailConnected && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Gmail is not connected. Connect your account to draft or send messages directly.</span>
          </div>
          {onConnectGmail && (
            <button
              type="button"
              onClick={onConnectGmail}
              className="shrink-0 rounded-lg bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/30"
            >
              Connect Gmail
            </button>
          )}
        </div>
      )}

      {/* In-Place Editable Subject & Message */}
      <div className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-3.5">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => handleSubjectChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border/80 bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground focus:border-brand focus:outline-none"
            placeholder="Subject line"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Message
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleCopyMessage}
                className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                title="Copy message"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <textarea
            rows={7}
            value={body}
            onChange={(e) => handleBodyChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border/80 bg-background/80 p-3 text-xs leading-relaxed text-foreground focus:border-brand focus:outline-none"
            placeholder="Write or edit your pitch..."
          />
        </div>

        {/* Candidate Evidence Badges */}
        {evidenceList.length > 0 && (
          <div className="border-t border-border/40 pt-2.5">
            <p className="text-[11px] font-medium text-muted-foreground">Grounded in your verified evidence:</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {evidenceList.map((ev) => (
                <span
                  key={ev.id}
                  className="inline-flex items-center gap-1 rounded-md border border-brand/20 bg-brand/5 px-2 py-0.5 text-[10px] text-foreground"
                >
                  <CheckCircle2 className="h-2.5 w-2.5 text-brand" />
                  {ev.text.length > 50 ? ev.text.slice(0, 48) + "..." : ev.text}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Quick Revision Bar */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-2.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-1">
            Revisions:
          </span>
          <button
            type="button"
            onClick={handleMakeShorter}
            className="rounded-lg border border-border/70 bg-background/60 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
          >
            Make shorter
          </button>
          <button
            type="button"
            onClick={handleMoreDirect}
            className="rounded-lg border border-border/70 bg-background/60 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
          >
            More direct
          </button>
          <button
            type="button"
            onClick={handleChangeCTA}
            className="rounded-lg border border-border/70 bg-background/60 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
          >
            Change CTA
          </button>
          {onRegenerateMessage && (
            <button
              type="button"
              onClick={onRegenerateMessage}
              className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background/60 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              Regenerate
            </button>
          )}
        </div>
      </div>

      {/* Action Footer: Tier-Aware Delivery */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
        {hasEmail ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={Boolean(deliveringMode) || Boolean(deliveryResult?.draftId)}
              onClick={() => handleCreateDraftOrSend("draft")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand/30 bg-brand px-3.5 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-brand/90 disabled:opacity-60"
            >
              {deliveringMode === "draft" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mail className="h-3.5 w-3.5" />
              )}
              {deliveryResult?.draftId ? "Draft Created in Gmail" : "Create Gmail draft"}
            </button>

            {isPaidSendAllowed && (
              <button
                type="button"
                disabled={Boolean(deliveringMode) || Boolean(deliveryResult?.messageId)}
                onClick={() => handleCreateDraftOrSend("send")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-foreground/5 px-3.5 py-2 text-xs font-semibold text-foreground transition hover:bg-foreground/10 disabled:opacity-60"
              >
                {deliveringMode === "send" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {deliveryResult?.messageId ? "Message Sent" : "Send reviewed email"}
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={contact.linkedinUrl || `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(opportunity.companyName)}%20recruiter`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand/30 bg-brand px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-brand/90"
            >
              Open LinkedIn Recruiter Search
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <button
              type="button"
              onClick={handleCopyMessage}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-foreground/5 px-3 py-2 text-xs font-semibold text-foreground hover:bg-foreground/10"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy LinkedIn Message
            </button>
          </div>
        )}

        {/* Quota or Tier Note */}
        {!isPaidSendAllowed && (
          <p className="text-[11px] text-muted-foreground">
            Starter plan drafts directly to Gmail.{" "}
            <a href="/dashboard/billing" className="text-brand hover:underline font-medium">
              Upgrade for auto-send
            </a>
          </p>
        )}
      </div>

      {/* Outcome Banner */}
      {deliveryResult?.draftId && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>
              {deliveryResult.messageId
                ? `Outreach successfully delivered via Gmail. Message ID: ${deliveryResult.messageId}`
                : `Gmail drafted successfully · Draft ID: ${deliveryResult.draftId}`}
            </span>
          </div>
        </div>
      )}

      {deliveryResult?.error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{deliveryResult.error}</span>
          </div>
        </div>
      )}

      {/* Relationship Timeline */}
      <div className="border-t border-border/40 pt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block h-2 w-2 rounded-full ${deliveryResult?.messageId ? "bg-emerald-400" : deliveryResult?.draftId ? "bg-brand" : "bg-muted-foreground/50"}`} />
          <span>Status: {deliveryResult?.messageId ? "Sent" : deliveryResult?.draftId ? "Drafted in Gmail" : "Ready for review"}</span>
        </div>
        <span>Next best action: Wait for recruiter reply</span>
      </div>
    </div>
  );
};
