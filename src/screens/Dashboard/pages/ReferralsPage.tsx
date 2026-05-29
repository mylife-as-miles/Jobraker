import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Upload,
  Sparkles,
  Banknote,
  Clock,
  HelpCircle,
  Share2,
  FileUp,
  X,
  Linkedin,
  Loader2,
  Info,
  Search,
  UserPlus,
  ChevronDown,
  ListFilter,
  Link2,
  Sparkle,
  Mail,
  ExternalLink,
  Lock,
  Trophy,
  CheckCircle2,
  ArrowRight,
  Coins,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useProfileSettings, type Profile } from "@/hooks/useProfileSettings";
import { parsePdfFile } from "@/utils/parsePdf";
import { evaluateJobFit } from "@/services/ai/evaluateJobFit";
import type { EvaluateJobFitResponse } from "@/services/ai/evaluateJobFit";
import {
  useReferrals,
  type ReferralRow,
  type ReferralFunnelStage,
  type ReferralSuggestion,
  type LinkedInConnection,
} from "@/hooks/useReferrals";

const LINKEDIN_DATA_EXPORT_URL =
  "https://www.linkedin.com/mypreferences/d/download-my-data";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = new Set(["pdf", "txt", "text", "docx"]);

function buildReferrerSnapshot(profile: Profile | null): string {
  if (!profile) return "";
  const parts = [
    [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim(),
    profile.job_title,
    profile.location,
    profile.experience_years != null
      ? `${profile.experience_years} yrs experience`
      : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

async function extractResumeText(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error("Use PDF, TXT, or DOCX.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("File must be 10MB or smaller.");
  }
  if (ext === "pdf") {
    const { text } = await parsePdfFile(file);
    return text;
  }
  if (ext === "txt" || ext === "text") {
    return file.text();
  }
  if (ext === "docx") {
    throw new Error("DOCX is not supported yet. Please upload PDF or TXT.");
  }
  throw new Error("Unsupported file type.");
}

function decisionLabel(
  d: EvaluateJobFitResponse["canonical_decision"],
): string {
  switch (d) {
    case "strong_yes":
      return "Strong fit";
    case "draft_first":
      return "Possible fit — review";
    case "risky":
      return "Risky fit";
    case "no_go":
      return "Poor fit";
    default:
      return d;
  }
}

function CheckCandidateFitModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): JSX.Element {
  const { profile } = useProfileSettings();
  const { success, error: toastError } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [parsing, setParsing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<EvaluateJobFitResponse | null>(null);

  const reset = useCallback(() => {
    setFile(null);
    setResumeText("");
    setJobDescription("");
    setResult(null);
    setParsing(false);
    setAnalyzing(false);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const processFile = async (f: File) => {
    setFile(f);
    setResult(null);
    setParsing(true);
    try {
      const text = await extractResumeText(f);
      if (!text.trim()) {
        throw new Error("Could not read text from this file.");
      }
      setResumeText(text);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not read file.";
      toastError("Upload failed", msg);
      setFile(null);
      setResumeText("");
    } finally {
      setParsing(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void processFile(f);
  };

  const onAnalyze = async () => {
    if (!resumeText.trim()) {
      toastError("Resume required", "Upload a resume first.");
      return;
    }
    const jd = jobDescription.trim();
    if (jd.length < 40) {
      toastError(
        "Job description",
        "Paste a role description (at least a few sentences) so we can compare fairly.",
      );
      return;
    }
    setAnalyzing(true);
    setResult(null);
    try {
      const data = await evaluateJobFit(
        null,
        "Referral — target role",
        "Referral opportunity",
        jd,
        buildReferrerSnapshot(profile),
        resumeText,
      );
      setResult(data);
      success("Fit analysis ready");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Analysis failed.";
      toastError("Could not analyze", msg);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} size='lg'>
      <div className='space-y-5'>
        <div className='flex items-start justify-between gap-4 border-b border-border/60 pb-4'>
          <div>
            <h2 className='text-lg font-semibold text-foreground tracking-tight'>
              Check candidate fit
            </h2>
            <p className='text-sm product-helper-text mt-1'>
              Upload their resume and compare it to a JobRaker job
              description—same fit engine as your Jobs board.
            </p>
          </div>
          <button
            type='button'
            aria-label='Close'
            className='rounded-full p-1.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors shrink-0'
            onClick={handleClose}
          >
            <X className='h-4 w-4' />
          </button>
        </div>

        <p className='text-sm product-helper-text leading-relaxed'>
          Use this before you share your referral link: we only analyze what you
          upload. JobRaker never emails or messages your contacts from this
          screen.
        </p>

        <div
          role='button'
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-10 text-center transition-all duration-300 ${
            dragOver
              ? "border-brand/70 bg-brand/5"
              : "border-foreground/20 bg-foreground/[0.03] hover:border-brand/40"
          }`}
        >
          <input
            ref={inputRef}
            type='file'
            accept='.pdf,.txt,.docx,text/plain,application/pdf'
            className='hidden'
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void processFile(f);
              e.target.value = "";
            }}
          />
          {parsing ? (
            <div className='flex flex-col items-center gap-2 text-foreground/80'>
              <Loader2 className='h-8 w-8 animate-spin text-brand' />
              <span className='text-sm'>Reading resume…</span>
            </div>
          ) : (
            <>
              <FileUp className='h-10 w-10 mx-auto text-foreground/35 mb-3' />
              <p className='text-sm font-medium text-foreground'>
                {file ? file.name : "Drop resume here or click to upload"}
              </p>
              <p className='text-xs product-helper-text mt-1'>
                PDF, DOCX, TXT (max 10MB)
              </p>
            </>
          )}
        </div>

        <div className='space-y-2'>
          <label className='text-xs font-medium text-foreground/80'>
            Role / job description
          </label>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder='Paste the job description, must-haves, or role summary you’re considering for them…'
            rows={5}
            className='product-input-surface w-full rounded-xl px-3 py-2 text-sm resize-y min-h-[100px]'
          />
          <p className='text-[11px] product-helper-text'>
            Job fit analysis requires Basics or higher. Uses credits like other
            AI evaluations.
          </p>
        </div>

        {result && (
          <div className='rounded-xl border border-brand/25 bg-brand/5 p-4 space-y-2'>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='text-sm font-semibold text-foreground'>
                {decisionLabel(result.canonical_decision)}
              </span>
              <span className='text-xs product-helper-text'>
                Confidence {Math.round(result.confidence_score ?? 0)}%
              </span>
            </div>
            {result.blockers?.length ? (
              <div>
                <p className='text-xs font-medium text-foreground/90 mb-1'>
                  Blockers
                </p>
                <ul className='text-xs product-helper-text list-disc list-inside space-y-0.5'>
                  {result.blockers.slice(0, 5).map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.exact_fit_evidence?.length ? (
              <div>
                <p className='text-xs font-medium text-foreground/90 mb-1'>
                  Signals
                </p>
                <ul className='text-xs product-helper-text list-disc list-inside space-y-0.5'>
                  {result.exact_fit_evidence.slice(0, 4).map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        <div className='flex flex-wrap justify-end gap-2 pt-1'>
          <Button
            type='button'
            variant='outline'
            className='product-outline-button border-foreground/20'
            onClick={handleClose}
          >
            Close
          </Button>
          <Button
            type='button'
            disabled={parsing || analyzing || !resumeText.trim()}
            className='bg-brand text-black hover:bg-brand/90'
            onClick={() => void onAnalyze()}
          >
            {analyzing ? (
              <>
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                Analyzing…
              </>
            ) : (
              "Run fit check"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ReferralsProgramInfoModal({
  open,
  onClose,
  onOpenBilling,
}: {
  open: boolean;
  onClose: () => void;
  onOpenBilling: () => void;
}): JSX.Element {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title='Referrals on JobRaker'
      size='lg'
    >
      <div className='space-y-4 text-sm text-foreground/90'>
        <p className='product-helper-text leading-relaxed'>
          Share JobRaker with people in your network. When someone signs up with
          your link, they stay linked to your account for tracking—no cold
          outreach is sent from JobRaker just because you imported contacts.
        </p>
        <ul className='list-disc pl-5 space-y-2 product-helper-text'>
          <li>
            <span className='text-foreground font-medium'>Your link</span> adds{" "}
            <code className='text-xs bg-foreground/10 px-1 rounded'>?ref=</code>{" "}
            on signup so attribution is automatic.
          </li>
          <li>
            <span className='text-foreground font-medium'>LinkedIn export</span>{" "}
            is optional: use it to match people you know to roles already on
            your JobRaker job board.
          </li>
          <li>
            <span className='text-foreground font-medium'>Rewards</span> (where
            applicable) are summarized under Billing—rates and eligibility can
            change; always check the latest terms there.
          </li>
        </ul>
        <div className='flex flex-wrap gap-2 pt-2'>
          <Button
            type='button'
            className='bg-brand text-black hover:bg-brand/90'
            onClick={onOpenBilling}
          >
            Open billing &amp; payouts
          </Button>
          <Button
            type='button'
            variant='outline'
            className='product-outline-button border-foreground/20'
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ReferralsHelpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): JSX.Element {
  return (
    <Modal open={open} onClose={onClose} title='How referrals work' size='lg'>
      <div className='space-y-5 text-sm'>
        <ol className='list-decimal pl-5 space-y-4 product-helper-text'>
          <li>
            <span className='text-foreground font-medium'>
              Export from LinkedIn
            </span>
            <p className='mt-1'>
              Request your data archive and download the ZIP. Inside, find{" "}
              <span className='text-foreground'>Connections.csv</span> and
              upload it here. This can take LinkedIn a few minutes to generate.
            </p>
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='mt-2 product-outline-button border-foreground/20'
              onClick={() =>
                window.open(
                  LINKEDIN_DATA_EXPORT_URL,
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              <ExternalLink className='w-3.5 h-3.5 mr-2' />
              LinkedIn data export
            </Button>
          </li>
          <li>
            <span className='text-foreground font-medium'>
              Upload to JobRaker
            </span>
            <p className='mt-1'>
              We store connections under your account (RLS) so only you can see
              them. Use &quot;Replace previous import&quot; if you want a full
              refresh.
            </p>
          </li>
          <li>
            <span className='text-foreground font-medium'>
              Run AI network match
            </span>
            <p className='mt-1'>
              With Basics or higher, JobRaker compares your network to jobs on
              your board and saves suggestions you can review—nothing is
              auto-sent to candidates.
            </p>
          </li>
          <li>
            <span className='text-foreground font-medium'>Share your link</span>
            <p className='mt-1'>
              Copy or email your referral link from the Share menu when
              you&apos;re ready.
            </p>
          </li>
        </ol>
        <Button
          type='button'
          variant='outline'
          className='product-outline-button border-foreground/20'
          onClick={onClose}
        >
          Done
        </Button>
      </div>
    </Modal>
  );
}

function ReferralsWhatsNewModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): JSX.Element {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title='Referrals in JobRaker'
      size='md'
    >
      <ul className='list-disc pl-5 space-y-2 text-sm product-helper-text'>
        <li>Share a personal signup link with automatic attribution.</li>
        <li>
          Import LinkedIn Connections.csv privately to power network ↔ job
          matching.
        </li>
        <li>Run an AI match pass against your JobRaker job queue (Basics+).</li>
        <li>
          Track each invite through signup, applications, and milestones in My
          referrals.
        </li>
        <li>Pre-screen a resume against any role with Check candidate fit.</li>
      </ul>
      <Button
        type='button'
        className='mt-4 bg-brand text-black hover:bg-brand/90'
        onClick={onClose}
      >
        Got it
      </Button>
    </Modal>
  );
}

const FUNNEL_STAGES = [
  { id: "signed_up", label: "Signed Up" },
  { id: "application_started", label: "Application Started" },
  { id: "application_completed", label: "Application Completed" },
  { id: "offer_extended", label: "Offer Extended" },
  { id: "hired", label: "Hired" },
  { id: "paid", label: "Paid" },
] as const;

type FunnelStageId = ReferralFunnelStage;
type ReferralTimeframe = "1d" | "3d" | "7d" | "all";

function PremiumLockOverlay({
  title,
  requiredTier,
  referralsNeeded,
  currentReferrals,
  onUpgrade,
}: {
  title: string;
  requiredTier: string;
  referralsNeeded: number;
  currentReferrals: number;
  onUpgrade: () => void;
}) {
  return (
    <div className='absolute inset-0 z-20 bg-background/95 backdrop-blur-md rounded-xl flex flex-col items-center justify-center p-4 text-center border border-border/40 select-none'>
      <div className='w-10 h-10 rounded-full bg-brand/10 border border-brand/35 flex items-center justify-center mb-2.5 animate-pulse'>
        <Lock className='w-4.5 h-4.5 text-brand' />
      </div>
      <h4 className='font-semibold text-foreground text-sm tracking-tight'>{title}</h4>
      <p className='text-[11px] text-muted-foreground mt-1 max-w-[200px] leading-normal'>
        This feature requires a <span className='text-brand font-semibold'>{requiredTier}</span> subscription or <span className='text-foreground font-semibold'>{referralsNeeded} active referrals</span>.
      </p>
      <div className='mt-3.5 flex flex-col gap-1.5 w-full max-w-[170px]'>
        <Button
          type='button'
          size='sm'
          className='w-full bg-brand text-black hover:bg-brand/90 text-[11px] py-1 h-7.5 font-bold rounded-lg shadow-[0_0_12px_rgba(29,255,0,0.25)]'
          onClick={onUpgrade}
        >
          Upgrade to {requiredTier}
        </Button>
        <div className='text-[9px] text-muted-foreground font-medium'>
          Progress: {currentReferrals}/{referralsNeeded} referrals
        </div>
      </div>
    </div>
  );
}

function MatchSuggestionsSection({
  suggestions,
  onCopyLink,
  onEmailInvite,
}: {
  suggestions: ReferralSuggestion[];
  onCopyLink: (sug: ReferralSuggestion) => void;
  onEmailInvite: (sug: ReferralSuggestion) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [minScore, setMinScore] = useState(45);

  const filtered = useMemo(() => {
    return suggestions.filter((s) => {
      const connName = `${s.connection?.first_name || ""} ${s.connection?.last_name || ""}`.toLowerCase();
      const jobTitle = (s.job?.title || "").toLowerCase();
      const company = (s.job?.company || "").toLowerCase();
      const matchText =
        connName.includes(searchQuery.toLowerCase()) ||
        jobTitle.includes(searchQuery.toLowerCase()) ||
        company.includes(searchQuery.toLowerCase());
      return matchText && s.fit_score >= minScore;
    });
  }, [suggestions, searchQuery, minScore]);

  return (
    <div className='mt-8 space-y-4'>
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
        <div>
          <h3 className='text-base font-bold text-foreground flex items-center gap-2'>
            <Sparkles className='w-4.5 h-4.5 text-brand' />
            AI Network Matches
          </h3>
          <p className='text-xs text-muted-foreground mt-0.5'>
            LinkedIn connections matched to saved job postings on your board.
          </p>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <div className='relative w-48'>
            <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground' />
            <input
              type='search'
              placeholder='Search matches...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='product-input-surface w-full rounded-lg pl-8 pr-2.5 py-1 text-xs h-8 border border-border/40 bg-card/50'
            />
          </div>
          <div className='flex rounded-lg border border-border/40 p-0.5 bg-card/30'>
            {[
              { label: "All (>45%)", value: 45 },
              { label: "Good (>65%)", value: 65 },
              { label: "High (>80%)", value: 80 },
            ].map((t) => (
              <button
                key={t.value}
                type='button'
                onClick={() => setMinScore(t.value)}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${
                  minScore === t.value
                    ? "bg-brand/20 text-brand border border-brand/35"
                    : "text-foreground/55 hover:text-foreground/90"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className='p-8 text-center border-dashed border-border/40 bg-card/20'>
          <Sparkle className='w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-55' />
          <p className='text-xs text-muted-foreground'>No matches found. Try widening your search or fit filter.</p>
        </Card>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {filtered.map((sug) => {
            const connName =
              `${sug.connection?.first_name || ""} ${sug.connection?.last_name || ""}`.trim() ||
              "Someone in your network";
            const scoreColor =
              sug.fit_score >= 80
                ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/10"
                : sug.fit_score >= 65
                  ? "text-brand border-brand/20 bg-brand/10"
                  : "text-amber-500 border-amber-500/20 bg-amber-500/10";
            return (
              <Card
                key={sug.id}
                className='p-5 border border-border/40 bg-card/65 relative overflow-hidden group hover:border-brand/40 transition-all duration-300'
              >
                <div className='absolute top-4 right-4 flex items-center justify-center'>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold ${scoreColor}`}
                  >
                    {sug.fit_score}% Match
                  </span>
                </div>

                <div className='space-y-3'>
                  <div>
                    <h4 className='font-bold text-sm text-foreground leading-tight group-hover:text-brand transition-colors'>
                      {connName}
                    </h4>
                    <p className='text-xs text-muted-foreground mt-0.5'>
                      {[sug.connection?.position, sug.connection?.company]
                        .filter(Boolean)
                        .join(" at ")}
                    </p>
                  </div>

                  <div className='rounded-lg bg-background/50 border border-border/30 p-2.5'>
                    <div className='text-[10px] text-muted-foreground font-semibold uppercase tracking-wider'>
                      Matched Role
                    </div>
                    <div className='text-xs font-semibold text-foreground mt-0.5'>
                      {sug.job?.title}
                    </div>
                    <div className='text-[11px] text-muted-foreground'>
                      {sug.job?.company}{" "}
                      {sug.job?.location ? `· ${sug.job?.location}` : ""}
                    </div>
                  </div>

                  <p className='text-xs text-foreground/80 leading-normal italic bg-brand/5 border-l-2 border-brand/50 pl-2.5 py-1'>
                    &ldquo;{sug.rationale}&rdquo;
                  </p>

                  <div className='flex gap-2 pt-1 border-t border-border/30 mt-2'>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      className='text-[10px] h-8 justify-center flex-1 border-border/40 hover:bg-foreground/5 hover:text-foreground'
                      onClick={() => onCopyLink(sug)}
                    >
                      <Link2 className='w-3.5 h-3.5 mr-1.5' />
                      Copy Referral Msg
                    </Button>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      className='text-[10px] h-8 justify-center flex-1 border-border/40 hover:bg-foreground/5 hover:text-foreground'
                      onClick={() => onEmailInvite(sug)}
                    >
                      <Mail className='w-3.5 h-3.5 mr-1.5' />
                      Quick Invite Email
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConnectionsListSection({
  connections,
}: {
  connections: LinkedInConnection[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return connections.filter((c) => {
      const connName = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase();
      const position = (c.position || "").toLowerCase();
      const company = (c.company || "").toLowerCase();
      const matchText =
        connName.includes(searchQuery.toLowerCase()) ||
        position.includes(searchQuery.toLowerCase()) ||
        company.includes(searchQuery.toLowerCase());

      if (statusFilter === "all") return matchText;
      return matchText && c.agent_scan_status === statusFilter;
    });
  }, [connections, searchQuery, statusFilter]);

  return (
    <div className='mt-8 space-y-4'>
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
        <div>
          <h3 className='text-base font-bold text-foreground flex items-center gap-2'>
            <Users className='w-4.5 h-4.5 text-brand/80' />
            Imported Connections ({connections.length})
          </h3>
          <p className='text-xs text-muted-foreground mt-0.5'>
            Private contacts parsed from your LinkedIn Connections.csv upload.
          </p>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <div className='relative w-48'>
            <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground' />
            <input
              type='search'
              placeholder='Search network...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='product-input-surface w-full rounded-lg pl-8 pr-2.5 py-1 text-xs h-8 border border-border/40 bg-card/50'
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className='product-input-surface px-2.5 py-1 text-xs h-8 border border-border/40 bg-card/50 rounded-lg text-foreground/80 focus:outline-none'
          >
            <option value='all'>All Status</option>
            <option value='pending'>Pending Scan</option>
            <option value='complete'>Complete</option>
            <option value='error'>Error</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className='p-8 text-center border-dashed border-border/40 bg-card/20'>
          <p className='text-xs text-muted-foreground'>No contacts match your filters.</p>
        </Card>
      ) : (
        <Card className='border border-border/40 bg-card/45 overflow-hidden'>
          <div className='overflow-x-auto max-h-[400px] custom-scrollbar'>
            <table className='w-full text-xs'>
              <thead>
                <tr className='border-b border-border/30 text-left text-muted-foreground uppercase tracking-wider font-semibold bg-background/30'>
                  <th className='px-4 py-2.5'>Name</th>
                  <th className='px-4 py-2.5'>Position / Title</th>
                  <th className='px-4 py-2.5'>Company</th>
                  <th className='px-4 py-2.5'>Connected On</th>
                  <th className='px-4 py-2.5'>AI Scan Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const statusColors =
                    c.agent_scan_status === "complete"
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                      : c.agent_scan_status === "error"
                        ? "bg-red-500/10 text-red-500 border-red-500/20"
                        : "bg-muted text-muted-foreground border-border/30";
                  return (
                    <tr
                      key={c.id}
                      className='border-b border-border/20 hover:bg-foreground/[0.01]'
                    >
                      <td className='px-4 py-2.5 font-bold text-foreground'>
                        {c.profile_url ? (
                          <a
                            href={c.profile_url}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='hover:text-brand flex items-center gap-1'
                          >
                            {c.first_name} {c.last_name}
                            <ExternalLink className='w-2.5 h-2.5 text-muted-foreground' />
                          </a>
                        ) : (
                          `${c.first_name} ${c.last_name}`
                        )}
                      </td>
                      <td className='px-4 py-2.5 text-foreground/80'>{c.position || "—"}</td>
                      <td className='px-4 py-2.5 text-foreground/80'>{c.company || "—"}</td>
                      <td className='px-4 py-2.5 text-muted-foreground'>
                        {c.connected_on
                          ? new Date(c.connected_on).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className='px-4 py-2.5'>
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${statusColors}`}
                        >
                          {c.agent_scan_status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function MyReferralsPanel({
  onOpenFitCheck,
  onShareLink,
  onEmailInvite,
  onOpenWhatsNew,
  funnelCounts,
  referrals,
  loading,
  onMarkStage,
}: {
  onOpenFitCheck: () => void;
  onShareLink: () => void;
  onEmailInvite: () => void;
  onOpenWhatsNew: () => void;
  funnelCounts: Record<ReferralFunnelStage, number>;
  referrals: ReferralRow[];
  loading: boolean;
  onMarkStage: (
    referredUserId: string,
    stage: "hired" | "paid",
  ) => Promise<void>;
}): JSX.Element {
  const [timeframe, setTimeframe] = useState<ReferralTimeframe>("all");
  const [highlightStage, setHighlightStage] =
    useState<FunnelStageId>("signed_up");
  const [statusFilter, setStatusFilter] = useState<FunnelStageId>("signed_up");
  const [search, setSearch] = useState("");

  const counts = funnelCounts;

  const filteredReferrals = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const ms =
      timeframe === "1d"
        ? 86400000
        : timeframe === "3d"
          ? 3 * 86400000
          : timeframe === "7d"
            ? 7 * 86400000
            : 0;
    return referrals.filter((r) => {
      if (r.funnel_stage !== statusFilter) return false;
      if (ms > 0 && now - new Date(r.signed_up_at).getTime() > ms) return false;
      if (!q) return true;
      const name =
        `${r.referee?.first_name || ""} ${r.referee?.last_name || ""}`.toLowerCase();
      const em = (r.referred_email || "").toLowerCase();
      return name.includes(q) || em.includes(q);
    });
  }, [referrals, search, statusFilter, timeframe]);

  return (
    <div className='space-y-5'>
      <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
        <p className='text-sm product-helper-text'>
          Track each invite as they use JobRaker—applications, interviews, and
          milestones.
        </p>
        <div className='flex flex-wrap items-center gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='product-outline-button border-foreground/20'
            onClick={onOpenWhatsNew}
          >
            <Sparkle className='w-3.5 h-3.5 mr-1.5 opacity-80' />
            What&apos;s new
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='product-outline-button border-foreground/20'
              >
                <Share2 className='w-3.5 h-3.5 mr-1.5' />
                Share
                <ChevronDown className='w-3.5 h-3.5 ml-1 opacity-60' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='min-w-[12rem]'>
              <DropdownMenuItem onClick={onShareLink}>
                <Link2 className='w-4 h-4 mr-2' />
                Copy referral link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEmailInvite}>
                <Mail className='w-4 h-4 mr-2' />
                Email invite…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className='flex rounded-lg border border-foreground/15 p-0.5 bg-foreground/[0.04]'>
            {(
              [
                { id: "1d" as const, label: "1D" },
                { id: "3d" as const, label: "3D" },
                { id: "7d" as const, label: "7D" },
                { id: "all" as const, label: "ALL" },
              ] as const
            ).map((tf) => (
              <button
                key={tf.id}
                type='button'
                onClick={() => setTimeframe(tf.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  timeframe === tf.id
                    ? "bg-brand/20 text-brand border border-brand/35"
                    : "text-foreground/55 hover:text-foreground/90"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Card className='product-section-card overflow-hidden p-0 border-foreground/15'>
        <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y divide-border/50 lg:divide-y-0 border-b border-border/50'>
          {FUNNEL_STAGES.map((stage) => {
            const active = highlightStage === stage.id;
            return (
              <button
                key={stage.id}
                type='button'
                onClick={() => {
                  setHighlightStage(stage.id);
                  setStatusFilter(stage.id);
                }}
                className={`px-3 py-4 text-left transition-colors ${
                  active
                    ? "bg-brand/10 border-b-2 border-brand -mb-px"
                    : "hover:bg-foreground/[0.03]"
                }`}
              >
                <p
                  className={`text-[11px] sm:text-xs font-medium leading-tight ${active ? "text-brand" : "product-helper-text"}`}
                >
                  {stage.label}
                </p>
                <p className='text-2xl font-bold text-foreground tabular-nums mt-1'>
                  {counts[stage.id]}
                </p>
              </button>
            );
          })}
        </div>
      </Card>

      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex relative items-center gap-2 min-w-0'>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as FunnelStageId)}
          >
            <SelectTrigger className=' text-sm  border-foreground/15'>
              <div className='flex items-center'>
                <ListFilter className='w-4 h-4 text-foreground/40 mr-2' />
                <SelectValue placeholder='Status' />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {FUNNEL_STAGES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className='relative flex-1 max-w-md'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/35' />
          <input
            type='search'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Search by name or email…'
            className='product-input-surface w-full rounded-xl pl-9 pr-3 py-2 text-sm h-10'
          />
        </div>
      </div>

      {loading ? (
        <Card className='product-section-card p-10 text-center border-foreground/15'>
          <Loader2 className='w-8 h-8 animate-spin text-brand mx-auto' />
          <p className='text-sm product-helper-text mt-3'>Loading referrals…</p>
        </Card>
      ) : filteredReferrals.length === 0 ? (
        <Card className='product-section-card py-16 px-6 text-center border-dashed border-foreground/15 hover:border-brand/30 transition-colors'>
          <div className='w-14 h-14 rounded-full bg-foreground/5 border border-foreground/10 flex items-center justify-center mx-auto mb-4'>
            <UserPlus className='w-7 h-7 text-foreground/40' />
          </div>
          <p className='text-sm text-foreground font-medium max-w-md mx-auto'>
            {referrals.length === 0
              ? "You don't have any referrals yet. All your referrals will be visible here."
              : "No referrals match these filters. Try ALL dates or another status."}
          </p>
          <p className='text-xs product-helper-text max-w-sm mx-auto mt-2'>
            Pre-screen candidates with{" "}
            <button
              type='button'
              className='text-brand hover:underline'
              onClick={onOpenFitCheck}
            >
              Check candidate fit
            </button>{" "}
            before you share your link.
          </p>
          <Button
            type='button'
            className='mt-6 bg-brand text-black hover:bg-brand/90'
            onClick={onShareLink}
          >
            <Link2 className='w-4 h-4 mr-2' />
            Share your referral link
          </Button>
        </Card>
      ) : (
        <Card className='product-section-card overflow-hidden border-foreground/15'>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b border-foreground/10 text-left product-helper-text'>
                  <th className='px-4 py-3 font-medium'>Name</th>
                  <th className='px-4 py-3 font-medium'>Email</th>
                  <th className='px-4 py-3 font-medium'>Stage</th>
                  <th className='px-4 py-3 font-medium'>Signed up</th>
                </tr>
              </thead>
              <tbody>
                {filteredReferrals.map((r) => {
                  const name =
                    `${r.referee?.first_name || ""} ${r.referee?.last_name || ""}`.trim() ||
                    "—";
                  return (
                    <tr
                      key={r.id}
                      className='border-b border-foreground/5 hover:bg-foreground/[0.02]'
                    >
                      <td className='px-4 py-3 text-foreground'>{name}</td>
                      <td className='px-4 py-3 product-helper-text'>
                        {r.referred_email || "—"}
                      </td>
                      <td className='px-4 py-3'>
                        <span className='inline-flex rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-xs text-brand'>
                          {FUNNEL_STAGES.find((s) => s.id === r.funnel_stage)
                            ?.label || r.funnel_stage}
                        </span>
                      </td>
                      <td className='px-4 py-3 product-helper-text'>
                        {new Date(r.signed_up_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

export const ReferralsPage = (): JSX.Element => {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const [tab, setTab] = useState<"connections" | "referrals">("connections");
  const [fitOpen, setFitOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [replaceNetwork, setReplaceNetwork] = useState(true);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const { profile } = useProfileSettings();

  const {
    loading,
    importing,
    agentRunning,
    stats,
    referrals,
    connectionCount,
    suggestionCount,
    referralShareUrl,
    funnelCounts,
    suggestions,
    connections,
    refreshAll,
    importLinkedInCsv,
    runAgentScan,
    updateReferralStage,
  } = useReferrals();

  useEffect(() => {
    const onEvt = () => void refreshAll();
    window.addEventListener("jobraker:referrals-changed", onEvt);
    return () =>
      window.removeEventListener("jobraker:referrals-changed", onEvt);
  }, [refreshAll]);

  const copyReferralLink = useCallback(async () => {
    const link = referralShareUrl || "";
    if (!link) {
      toastError(
        "Referral link",
        "Your code is still loading. Try again in a moment.",
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      success("Referral link copied");
    } catch {
      toastError("Copy failed", "Could not copy to clipboard.");
    }
  }, [referralShareUrl, success, toastError]);

  const openEmailInvite = useCallback(() => {
    const link = referralShareUrl || "";
    if (!link) {
      toastError(
        "Referral link",
        "Your link is still loading. Try again in a moment.",
      );
      return;
    }
    const subject = encodeURIComponent("Join me on JobRaker");
    const body = encodeURIComponent(
      `I've been using JobRaker to run my job search—discovery, applications, and follow-ups in one place.\n\nIf you sign up with my link, it helps me track referrals in the app:\n\n${link}\n`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }, [referralShareUrl, toastError]);

  const copyCustomMsg = useCallback(
    async (sug: ReferralSuggestion) => {
      const link = referralShareUrl || "";
      const connName =
        `${sug.connection?.first_name || ""} ${sug.connection?.last_name || ""}`.trim();
      const jobTitle = sug.job?.title || "";
      const compName = sug.job?.company || "";
      const score = sug.fit_score;
      const msg = `Hey ${connName},\n\nI was looking at my career board on JobRaker and our AI matched your background to a ${jobTitle} role at ${compName} with a ${score}% match fit score.\n\nI wanted to share my referral link with you so you can sign up and see the match details:\n\n${link}\n\nHope this is helpful!\n`;

      try {
        await navigator.clipboard.writeText(msg);
        success("Custom referral message copied");
      } catch {
        toastError("Copy failed", "Could not copy message.");
      }
    },
    [referralShareUrl, success, toastError],
  );

  const emailCustomInvite = useCallback(
    (sug: ReferralSuggestion) => {
      const link = referralShareUrl || "";
      const connName =
        `${sug.connection?.first_name || ""} ${sug.connection?.last_name || ""}`.trim();
      const jobTitle = sug.job?.title || "";
      const compName = sug.job?.company || "";
      const score = sug.fit_score;
      const subject = encodeURIComponent(
        `Career Match: ${jobTitle} at ${compName}`,
      );
      const body = encodeURIComponent(
        `Hey ${connName},\n\nI was looking at my career board on JobRaker and our AI matched your background to a ${jobTitle} role at ${compName} with a ${score}% match fit score.\n\nI wanted to share my referral link with you so you can sign up and see the match details:\n\n${link}\n\nHope this is helpful!\n`,
      );
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    },
    [referralShareUrl],
  );

  const userTier = profile?.subscription_tier || "Free";
  const referralCount = referrals.length;
  // Free users can unlock import & match features if they bring in at least 2 referrals.
  const hasAccessToImportAndMatch =
    userTier !== "Free" || referralCount >= 2;

  // Gamification Milestone roadmap settings
  const milestones = [
    {
      level: 1,
      name: "Scout",
      target: 1,
      reward: "+50 Jobricon Credits",
      desc: "1 friend joins",
    },
    {
      level: 2,
      name: "Connector",
      target: 3,
      reward: "Network matching access",
      desc: "3 friends join",
    },
    {
      level: 3,
      name: "Career Broker",
      target: 5,
      reward: "Pro Pack bonus tier",
      desc: "5 friends join",
    },
    {
      level: 4,
      name: "Rainmaker",
      target: 10,
      reward: "Top referral tier",
      desc: "10 friends join",
    },
  ];

  const progressPercent = Math.min(100, (referralCount / 10) * 100);

  const nextMilestone = milestones.find((m) => m.target > referralCount);

  return (
    <div className='product-page-shell min-h-full'>
      <CheckCandidateFitModal
        open={fitOpen}
        onClose={() => setFitOpen(false)}
      />
      <ReferralsProgramInfoModal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        onOpenBilling={() => {
          setInfoOpen(false);
          navigate("/dashboard/billing");
        }}
      />
      <ReferralsHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ReferralsWhatsNewModal
        open={whatsNewOpen}
        onClose={() => setWhatsNewOpen(false)}
      />

      <div className='w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div className='min-w-0 flex-1'>
            <div className='flex items-center gap-2'>
              <h1 className='text-2xl sm:text-3xl font-bold text-foreground tracking-tight'>
                Referrals &amp; Milestones
              </h1>
              <button
                type='button'
                className='rounded-full p-1 text-foreground/40 hover:text-brand hover:bg-brand/10 transition-colors'
                title='How JobRaker referrals work'
                aria-label='About referrals'
                onClick={() => setInfoOpen(true)}
              >
                <Info className='w-4 h-4 sm:w-5 sm:h-5' />
              </button>
            </div>
            <div className='mt-4 flex gap-6 border-b border-foreground/10'>
              {(
                [
                  { id: "connections" as const, label: "My Network & AI Match" },
                  { id: "referrals" as const, label: "My referrals log" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type='button'
                  onClick={() => setTab(t.id)}
                  className={`pb-3 text-sm font-medium transition-colors relative ${
                    tab === t.id
                      ? "text-brand"
                      : "text-foreground/55 hover:text-foreground/85"
                  }`}
                >
                  {t.label}
                  {tab === t.id ? (
                    <span className='absolute left-0 right-0 -bottom-px h-0.5 bg-brand rounded-full shadow-[0_0_8px_rgba(29,255,0,0.45)]' />
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div className='flex flex-col sm:items-end gap-3 shrink-0'>
            <span className='inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-foreground/[0.04] px-3 py-1 text-xs font-medium product-helper-text'>
              <Coins className='w-3.5 h-3.5 text-brand' />
              {stats?.referrals_today ?? 0} /{" "}
              {stats?.referrals_today_cap ?? 100} signups today
            </span>
            <div className='flex flex-wrap gap-2 justify-end'>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='product-outline-button border-foreground/20'
                  >
                    <Share2 className='w-3.5 h-3.5 mr-1.5' />
                    Share
                    <ChevronDown className='w-3.5 h-3.5 ml-1 opacity-60' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  <DropdownMenuItem onClick={() => void copyReferralLink()}>
                    <Link2 className='w-4 h-4 mr-2' />
                    Copy referral link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={openEmailInvite}>
                    <Mail className='w-4 h-4 mr-2' />
                    Email invite…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='product-outline-button border-foreground/20'
                onClick={() => setHelpOpen(true)}
              >
                <HelpCircle className='w-3.5 h-3.5 mr-1.5' />
                Help
              </Button>
              <Button
                type='button'
                size='sm'
                className='bg-brand text-black hover:bg-brand/90 font-bold'
                onClick={() => setFitOpen(true)}
              >
                Check candidate fit
              </Button>
            </div>
          </div>
        </div>

        {/* Milestone Achievement Roadmap Card (Psychological Goal-Gradient Effect) */}
        <Card className='product-section-card p-6 border border-border/40 bg-card/45 overflow-hidden relative shadow-lg'>
          <div className='absolute top-0 right-0 w-64 h-64 bg-brand/5 rounded-full blur-3xl pointer-events-none' />
          <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6'>
            <div>
              <h3 className='text-sm font-bold text-foreground flex items-center gap-2'>
                <Trophy className='w-4.5 h-4.5 text-brand' />
                Referral Perks Roadmap
              </h3>
              <p className='text-xs text-muted-foreground mt-0.5'>
                Give friends <span className='font-semibold text-foreground'>50 Jobricon credits</span> on signup and climb toward premium access perks for yourself.
              </p>
            </div>
            <div className='flex items-center gap-2 text-xs font-semibold text-foreground/80'>
              <span>Referred Friends:</span>
              <span className='inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand/20 border border-brand/40 text-brand text-xs font-bold font-mono'>
                {referralCount}
              </span>
            </div>
          </div>

          <div className='relative mt-6 mb-4 px-4'>
            <div className='absolute top-4 left-0 right-0 h-1 bg-foreground/10 rounded-full' />
            <div
              className='absolute top-4 left-0 h-1 bg-brand rounded-full shadow-[0_0_8px_rgba(29,255,0,0.5)] transition-all duration-500 ease-out'
              style={{ width: `${progressPercent}%` }}
            />

            <div className='relative flex justify-between'>
              {milestones.map((m) => {
                const isUnlocked = referralCount >= m.target;
                return (
                  <div
                    key={m.level}
                    className='flex flex-col items-center relative z-10'
                  >
                    <div
                      className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all duration-300 ${
                        isUnlocked
                          ? "bg-brand border-brand text-black shadow-[0_0_12px_rgba(29,255,0,0.45)] font-bold"
                          : "bg-background border-border text-muted-foreground"
                      }`}
                    >
                      {isUnlocked ? (
                        <CheckCircle2 className='w-5 h-5 text-black' />
                      ) : (
                        <span className='text-xs font-mono font-bold'>
                          {m.target}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-bold mt-2 ${isUnlocked ? "text-brand" : "text-muted-foreground"}`}
                    >
                      {m.name}
                    </span>
                    <span className='text-[9px] text-muted-foreground hidden sm:inline max-w-[90px] text-center mt-0.5 leading-tight font-medium'>
                      {m.reward}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {nextMilestone ? (
            <div className='mt-4 flex items-center gap-1.5 text-xs text-brand/90 font-medium pl-1 bg-brand/5 py-1.5 px-3 rounded-lg border-l-2 border-brand/65'>
              <ArrowRight className='w-3.5 h-3.5 text-brand' />
              <span>
                You are {nextMilestone.target - referralCount} referral
                {nextMilestone.target - referralCount > 1 ? "s" : ""} away from
                unlocking <span className='font-semibold'>{nextMilestone.name}</span> ({nextMilestone.reward}).
              </span>
            </div>
          ) : (
            <div className='mt-4 flex items-center gap-1.5 text-xs text-brand/90 font-medium pl-1 bg-brand/5 py-1.5 px-3 rounded-lg border-l-2 border-brand/65'>
              <CheckCircle2 className='w-3.5 h-3.5 text-brand' />
              <span>You have unlocked all milestone levels! Ultimate rewards active.</span>
            </div>
          )}
        </Card>

        {tab === "connections" ? (
          <div className='space-y-6'>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              <h2 className='text-lg font-semibold text-foreground'>
                Scan LinkedIn Network &amp; AI-Match Roles
              </h2>
              <p className='mt-1 text-sm product-helper-text max-w-2xl'>
                Privately analyze your connections against active roles on your JobRaker board.
                Nothing is emailed or shared automatically; you stay fully in control.
              </p>
            </motion.div>

            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
              {/* Card 1: Import */}
              <Card className='product-section-card p-6 hover:border-brand/35 transition-all duration-300 md:col-span-1 relative overflow-hidden flex flex-col justify-between'>
                {!hasAccessToImportAndMatch && (
                  <PremiumLockOverlay
                    title='LinkedIn Private Import'
                    requiredTier='Basics'
                    referralsNeeded={2}
                    currentReferrals={referralCount}
                    onUpgrade={() => navigate("/dashboard/billing")}
                  />
                )}
                <div>
                  <input
                    ref={csvInputRef}
                    type='file'
                    accept='.csv,text/csv'
                    className='hidden'
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        void importLinkedInCsv(f, {
                          replace: replaceNetwork,
                        }).catch((err) =>
                          toastError(
                            "Import failed",
                            err instanceof Error
                              ? err.message
                              : "Could not import CSV",
                          ),
                        );
                      }
                      e.target.value = "";
                    }}
                  />
                  <div className='flex items-center justify-between mb-3'>
                    <h3 className='font-semibold text-foreground text-sm'>
                      Upload connections
                    </h3>
                    <button
                      type='button'
                      className='rounded-full p-1 text-foreground/35 hover:text-brand hover:bg-brand/10 transition-colors'
                      aria-label='Help with LinkedIn export'
                      onClick={() => setHelpOpen(true)}
                    >
                      <HelpCircle className='w-4 h-4' />
                    </button>
                  </div>
                  <p className='text-xs product-helper-text mb-4 leading-normal'>
                    Upload your unzipped LinkedIn{" "}
                    <span className='text-foreground/95'>Connections.csv</span>.
                    Records are private to your workspace and never shared.
                  </p>
                  <label className='flex items-center gap-2 text-[11px] product-helper-text mb-3 cursor-pointer select-none'>
                    <input
                      type='checkbox'
                      checked={replaceNetwork}
                      onChange={(e) => setReplaceNetwork(e.target.checked)}
                      className='accent-brand rounded'
                    />
                    Replace previous import
                  </label>
                  <p className='text-[10px] product-helper-text mb-3 font-semibold'>
                    Connections: <span className='text-foreground'>{connectionCount}</span>
                  </p>
                </div>
                <div className='flex flex-col gap-2 mt-4'>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='product-outline-button border-foreground/20 justify-start text-xs'
                    onClick={() =>
                      window.open(
                        LINKEDIN_DATA_EXPORT_URL,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  >
                    <Linkedin className='w-3.5 h-3.5 mr-2 text-[#0a66c2]' />
                    Get LinkedIn export
                  </Button>
                  <Button
                    type='button'
                    disabled={importing}
                    size='sm'
                    className='bg-brand text-black hover:bg-brand/90 justify-start text-xs font-bold shadow-md'
                    onClick={() => csvInputRef.current?.click()}
                  >
                    {importing ? (
                      <Loader2 className='w-3.5 h-3.5 mr-2 animate-spin' />
                    ) : (
                      <Upload className='w-3.5 h-3.5 mr-2' />
                    )}
                    {importing ? "Importing…" : "Upload connections"}
                  </Button>
                </div>
              </Card>

              {/* Card 2: Match Scan */}
              <Card className='product-section-card p-6 hover:border-brand/35 transition-all duration-300 md:col-span-1 relative overflow-hidden flex flex-col justify-between'>
                {!hasAccessToImportAndMatch && (
                  <PremiumLockOverlay
                    title='AI Network Matching'
                    requiredTier='Basics'
                    referralsNeeded={2}
                    currentReferrals={referralCount}
                    onUpgrade={() => navigate("/dashboard/billing")}
                  />
                )}
                <div>
                  <div className='w-9 h-9 rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center mb-3.5'>
                    <Sparkles className='w-4.5 h-4.5 text-brand animate-pulse' />
                  </div>
                  <h3 className='font-semibold text-foreground text-sm mb-1.5'>
                    Match network → job board
                  </h3>
                  <p className='text-xs product-helper-text mb-4 leading-normal'>
                    Scans uploaded contacts and cross-compares their professional history
                    against jobs in your queue to find matches.
                  </p>
                  <p className='text-[10px] product-helper-text flex items-center gap-1.5 mb-3 font-semibold'>
                    <Clock className='w-3 h-3 text-brand/70' />
                    AI suggestions: <span className='text-foreground'>{suggestionCount}</span>
                  </p>
                </div>
                <Button
                  type='button'
                  disabled={agentRunning || connectionCount === 0}
                  title={
                    connectionCount === 0
                      ? "Upload Connections.csv first"
                      : undefined
                  }
                  className='w-full bg-foreground/10 border border-brand/40 text-brand hover:bg-brand/10 disabled:opacity-50 text-xs py-1.5 h-9 font-bold shadow-md'
                  onClick={() => void runAgentScan()}
                >
                  {agentRunning ? (
                    <>
                      <Loader2 className='w-3.5 h-3.5 mr-2 animate-spin' />
                      Matching…
                    </>
                  ) : (
                    <>
                      <Sparkle className='w-3.5 h-3.5 mr-2' />
                      Run AI network match
                    </>
                  )}
                </Button>
              </Card>

              {/* Card 3: Referral Rewards */}
              <Card className='product-section-card p-6 hover:border-brand/35 transition-all duration-300 md:col-span-1 relative overflow-hidden flex flex-col justify-between'>
                <div>
                  <div className='w-9 h-9 rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center mb-3.5'>
                    <Banknote className='w-4.5 h-4.5 text-brand' />
                  </div>
                  <h3 className='font-semibold text-foreground text-sm mb-1.5'>
                    Referral rewards
                  </h3>
                  <p className='text-xs product-helper-text mb-4 leading-normal'>
                    Unlock <span className='font-semibold text-foreground/90'>Jobricon credits</span> for friends you refer. Each referral moves you toward milestone perks tied to premium access and extra search capacity.
                  </p>
                  <p className='text-[10px] product-helper-text flex items-center gap-1.5 mb-3 font-semibold'>
                    <Clock className='w-3 h-3 text-brand/70' />
                    Tracks from signup to hiring
                  </p>
                </div>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='w-full text-brand hover:text-brand hover:bg-transparent border border-transparent hover:border-brand/20 text-xs py-1.5 h-9 font-bold'
                  onClick={() => navigate("/dashboard/billing")}
                >
                  View billing &amp; payouts
                </Button>
              </Card>
            </div>

            {/* AI Suggestion Matches Section */}
            {hasAccessToImportAndMatch && suggestions.length > 0 && (
              <MatchSuggestionsSection
                suggestions={suggestions}
                onCopyLink={copyCustomMsg}
                onEmailInvite={emailCustomInvite}
              />
            )}

            {/* Imported Connections List Section */}
            {hasAccessToImportAndMatch && connections.length > 0 && (
              <ConnectionsListSection connections={connections} />
            )}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <MyReferralsPanel
              onOpenFitCheck={() => setFitOpen(true)}
              onShareLink={() => void copyReferralLink()}
              onEmailInvite={openEmailInvite}
              onOpenWhatsNew={() => setWhatsNewOpen(true)}
              funnelCounts={funnelCounts}
              referrals={referrals}
              loading={loading}
              onMarkStage={async (referredUserId, stage) => {
                try {
                  await updateReferralStage(referredUserId, stage);
                } catch (e: unknown) {
                  toastError(
                    "Update failed",
                    e instanceof Error ? e.message : "Try again",
                  );
                }
              }}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
};
