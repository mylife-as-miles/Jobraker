import { useMemo, useState } from "react";
import {
  Bell,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileCheck2,
  ListFilter,
  Mail,
  Send,
  Search,
  ShieldCheck,
  Tags,
} from "lucide-react";
import type {
  DirectApplyOutput,
  DirectApplyResult,
  SkillConfidence,
} from "@/lib/chatSkills/types";

type Props = {
  output: DirectApplyOutput;
  onRunPrompt?: (prompt: string) => void;
};

const confidenceClass: Record<SkillConfidence, string> = {
  high: "border-brand/30 bg-brand/10 text-brand",
  medium: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  low: "border-red-400/30 bg-red-400/10 text-red-200",
};

const channelLabel = (result: DirectApplyResult) => {
  if (result.channelType === "careers_page") return "Careers page";
  if (result.channelType === "recruitment_email") return "Recruitment email";
  if (result.channelType === "official_form") return "Official form";
  if (result.channelType === "job_board") return "Official job board";
  return "Needs verification";
};

const channelHref = (result: DirectApplyResult) => {
  if (result.channelValue.startsWith("http")) return result.channelValue;
  if (result.channelType === "recruitment_email") {
    return `mailto:${result.channelValue}`;
  }
  return undefined;
};

const resultToExportLine = (result: DirectApplyResult) =>
  [
    result.companyName,
    result.role,
    channelLabel(result),
    result.channelValue,
    result.confidence,
    result.recommendedAction,
  ].join(",");

export const DirectApplySkillCard = ({ output, onRunPrompt }: Props) => {
  const [notice, setNotice] = useState(
    "Connected inbox actions are ready. JobRaker can create drafts, send approved emails, track replies, remind follow-ups, and label job emails when Gmail is connected.",
  );
  const emailResults = useMemo(
    () =>
      output.results.filter(
        (result) =>
          result.channelType === "recruitment_email" &&
          result.confidence !== "low",
      ),
    [output.results],
  );

  const exportText = useMemo(
    () =>
      [
        "Company,Role,Channel,Value,Confidence,Recommended action",
        ...output.results.map(resultToExportLine),
      ].join("\n"),
    [output.results],
  );

  const copyExport = async () => {
    await navigator.clipboard.writeText(exportText);
    setNotice("Direct application channel list copied.");
  };

  const runOrCopyPrompt = async (prompt: string, fallbackNotice: string) => {
    if (onRunPrompt) {
      onRunPrompt(prompt);
      return;
    }
    await navigator.clipboard.writeText(prompt);
    setNotice(fallbackNotice);
  };

  const draftPrompt = emailResults
    .map((result) => result.draftCommand)
    .filter(Boolean)
    .join("\n\n");
  const sendPrompt = emailResults
    .map((result) => result.approvalCommand)
    .filter(Boolean)
    .join("\n\n");
  const refineQuery = [
    ...new Set(output.results.map((result) => result.companyName)),
  ].join(" OR ");

  if (output.needsClarification && output.results.length === 0) {
    return (
      <div className='rounded-2xl border border-amber-400/25 bg-background/70 p-4'>
        <div className='flex items-start gap-3'>
          <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-400/10 text-amber-200'>
            <Search className='h-4 w-4' />
          </div>
          <div>
            <h3 className='text-base font-semibold text-foreground'>
              Direct Apply needs a target
            </h3>
            <p className='mt-1 text-sm leading-relaxed text-muted-foreground'>
              {output.needsClarification.reason}
            </p>
          </div>
        </div>

        <div className='mt-4 space-y-2'>
          {output.needsClarification.suggestedPrompts.map((prompt) => (
            <button
              key={prompt}
              type='button'
              onClick={() => void runOrCopyPrompt(prompt, "Prompt copied.")}
              className='block w-full rounded-xl border border-border bg-card/45 px-3 py-2 text-left text-xs leading-relaxed text-foreground transition hover:border-brand/30 hover:bg-brand/10'
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      <div className='rounded-2xl border border-brand/20 bg-background/70 p-4'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <div className='flex items-center gap-2'>
              <div className='flex h-9 w-9 items-center justify-center rounded-xl border border-brand/20 bg-brand/10 text-brand'>
                <ShieldCheck className='h-4 w-4' />
              </div>
              <div>
                <h3 className='text-base font-semibold text-foreground'>
                  Direct Apply Results
                </h3>
                <p className='text-xs text-muted-foreground'>
                  I found {output.summary.total} possible direct application
                  channels. {output.summary.highConfidence} are high confidence.{" "}
                  {output.summary.needsReview} need review.
                </p>
              </div>
            </div>
          </div>
          <span className='inline-flex w-fit items-center gap-1.5 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[11px] font-semibold text-brand'>
            <CheckCircle2 className='h-3.5 w-3.5' />
            Connected inbox ready
          </span>
        </div>

        {output.connectedInbox?.supportedActions?.length ? (
          <div className='mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5'>
            {output.connectedInbox.supportedActions.map((action) => (
              <div
                key={action.id}
                className='rounded-xl border border-border/70 bg-card/35 px-3 py-2'
              >
                <p className='text-[11px] font-semibold text-foreground'>
                  {action.label}
                </p>
                <p className='mt-1 text-[10px] leading-relaxed text-muted-foreground'>
                  {action.description}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <div className='mt-4 overflow-hidden rounded-xl border border-border/70'>
          <div className='hidden grid-cols-[1.15fr_1.15fr_1fr_.85fr_.95fr] gap-3 border-b border-border/70 bg-accent/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground md:grid'>
            <span>Company</span>
            <span>Role</span>
            <span>Channel</span>
            <span>Confidence</span>
            <span>Action</span>
          </div>
          <div className='divide-y divide-border/60'>
            {output.results.map((result) => (
              <div
                key={`${result.companyName}-${result.channelValue}`}
                className='grid gap-3 px-3 py-3 text-sm md:grid-cols-[1.15fr_1.15fr_1fr_.85fr_.95fr] md:items-center'
              >
                <div>
                  <p className='font-semibold text-foreground'>
                    {result.companyName}
                  </p>
                  <p className='mt-1 truncate text-[11px] text-muted-foreground'>
                    {result.channelValue}
                  </p>
                </div>
                <p className='text-muted-foreground'>{result.role}</p>
                <div>
                  <span className='inline-flex rounded-full border border-border bg-background/80 px-2 py-1 text-[11px] font-medium text-foreground'>
                    {channelLabel(result)}
                  </span>
                </div>
                <div>
                  <span
                    className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${confidenceClass[result.confidence]}`}
                  >
                    {result.confidence} {result.confidenceScore}%
                  </span>
                </div>
                <p className='text-xs leading-relaxed text-muted-foreground'>
                  {result.recommendedAction}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className='mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5'>
          <button
            type='button'
            onClick={() =>
              setNotice("Draft previews are ready below for user review.")
            }
            className='inline-flex items-center justify-center gap-2 rounded-xl border border-brand/25 bg-brand px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-brand/90'
          >
            <FileCheck2 className='h-3.5 w-3.5' />
            Review drafts
          </button>
          <button
            type='button'
            onClick={() =>
              draftPrompt
                ? void runOrCopyPrompt(
                    draftPrompt,
                    "Gmail draft command copied. Paste it into chat to create the drafts.",
                  )
                : setNotice(
                    "No verified recruitment-email channels are ready for Gmail draft creation yet.",
                  )
            }
            className='inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-accent/40'
          >
            <Mail className='h-3.5 w-3.5' />
            Create Gmail drafts
          </button>
          <button
            type='button'
            onClick={() =>
              sendPrompt
                ? void runOrCopyPrompt(
                    sendPrompt,
                    "Approved Gmail send command copied. Paste it into chat to send.",
                  )
                : setNotice(
                    "No approved recruitment-email drafts are ready to send yet.",
                  )
            }
            className='inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-accent/40'
          >
            <Send className='h-3.5 w-3.5' />
            Send approved
          </button>
          <button
            type='button'
            onClick={() =>
              void runOrCopyPrompt(
                `Label job-related Gmail messages connected to this Direct Apply search with "JobRaker/Applications". Use label_gmail_job_emails with refine_query: ${refineQuery || "applications"}.`,
                "Gmail labeling command copied. Paste it into chat to label job emails.",
              )
            }
            className='inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-accent/40'
          >
            <Tags className='h-3.5 w-3.5' />
            Label job emails
          </button>
          <button
            type='button'
            onClick={() =>
              void runOrCopyPrompt(
                "Refresh my application processes including Gmail reply tracking, then remind me which Direct Apply items need follow-up.",
                "Reply tracking and follow-up command copied. Paste it into chat to run it.",
              )
            }
            className='inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-accent/40'
          >
            <Bell className='h-3.5 w-3.5' />
            Track + remind
          </button>
        </div>

        <div className='mt-2 flex flex-wrap gap-2'>
          <button
            type='button'
            onClick={() =>
              setNotice("Low-confidence channels are excluded from connected-inbox sends until verified.")
            }
            className='inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-accent/40'
          >
            <ListFilter className='h-3.5 w-3.5' />
            Ignore low confidence
          </button>
          <button
            type='button'
            onClick={() => void copyExport()}
            className='inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-accent/40'
          >
            <Copy className='h-3.5 w-3.5' />
            Export list
          </button>
          <button
            type='button'
            onClick={() =>
              void runOrCopyPrompt(
                "Continue researching official company application channels for this Direct Apply request and update the confidence scores before drafting.",
                "Research command copied. Paste it into chat to continue.",
              )
            }
            className='inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-accent/40'
          >
            <Search className='h-3.5 w-3.5' />
            Continue researching
          </button>
        </div>

        <p className='mt-3 rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground'>
          {notice}
        </p>
      </div>

      <div className='rounded-2xl border border-border/70 bg-background/60 p-4'>
        <div className='mb-3 flex items-center justify-between gap-3'>
          <h4 className='text-sm font-semibold text-foreground'>
            Draft previews
          </h4>
          <span className='text-[11px] text-muted-foreground'>
            Connected inbox can draft or send after approval
          </span>
        </div>
        <div className='space-y-3'>
          {output.results.map((result) => (
            <details
              key={`${result.companyName}-draft`}
              className='rounded-xl border border-border/70 bg-card/40 px-3 py-2'
            >
              <summary className='cursor-pointer list-none text-sm font-semibold text-foreground'>
                {result.companyName} draft
                <span className='ml-2 text-[11px] font-medium text-muted-foreground'>
                  {result.draftStatus.replace(/_/g, " ")}
                </span>
              </summary>
              <div className='mt-3 space-y-2 text-xs text-muted-foreground'>
                <p className='font-semibold text-foreground'>
                  {result.draftPreview.subject}
                </p>
                <p className='whitespace-pre-wrap leading-relaxed'>
                  {result.draftPreview.body}
                </p>
                <a
                  href={channelHref(result)}
                  target='_blank'
                  rel='noreferrer'
                  className='inline-flex items-center gap-1.5 text-brand hover:underline'
                >
                  Open official channel
                  <ExternalLink className='h-3 w-3' />
                </a>
                {result.draftCommand || result.approvalCommand ? (
                  <div className='flex flex-wrap gap-2 pt-1'>
                    {result.draftCommand ? (
                      <button
                        type='button'
                        onClick={() =>
                          void runOrCopyPrompt(
                            result.draftCommand || "",
                            "Draft command copied. Paste it into chat to create this Gmail draft.",
                          )
                        }
                        className='rounded-lg border border-brand/25 bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand transition hover:bg-brand/15'
                      >
                        Create Gmail draft
                      </button>
                    ) : null}
                    {result.approvalCommand ? (
                      <button
                        type='button'
                        onClick={() =>
                          void runOrCopyPrompt(
                            result.approvalCommand || "",
                            "Send command copied. Paste it into chat to send this approved email.",
                          )
                        }
                        className='rounded-lg border border-border bg-background/70 px-2.5 py-1 text-[11px] font-semibold text-foreground transition hover:bg-accent/40'
                      >
                        Approve send
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
};
