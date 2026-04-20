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
import { useReferrals, type ReferralRow, type ReferralFunnelStage } from "@/hooks/useReferrals";

const LINKEDIN_DATA_EXPORT_URL = "https://www.linkedin.com/mypreferences/d/download-my-data";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = new Set(["pdf", "txt", "text", "docx"]);

function buildReferrerSnapshot(profile: Profile | null): string {
  if (!profile) return "";
  const parts = [
    [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim(),
    profile.job_title,
    profile.location,
    profile.experience_years != null ? `${profile.experience_years} yrs experience` : "",
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

function decisionLabel(d: EvaluateJobFitResponse["canonical_decision"]): string {
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
      toastError("Job description", "Paste a role description (at least a few sentences) so we can compare fairly.");
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
    <Modal open={open} onClose={handleClose} size="lg">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground tracking-tight">Check candidate fit</h2>
            <p className="text-sm product-helper-text mt-1">
              Upload their resume and compare it to a JobRaker job description—same fit engine as your Jobs board.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors shrink-0"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm product-helper-text leading-relaxed">
          Use this before you share your referral link: we only analyze what you upload. JobRaker never emails or messages
          your contacts from this screen.
        </p>

        <div
          role="button"
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
              ? "border-[#1dff00]/70 bg-[#1dff00]/5"
              : "border-foreground/20 bg-foreground/[0.03] hover:border-[#1dff00]/40"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.txt,.docx,text/plain,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void processFile(f);
              e.target.value = "";
            }}
          />
          {parsing ? (
            <div className="flex flex-col items-center gap-2 text-foreground/80">
              <Loader2 className="h-8 w-8 animate-spin text-[#1dff00]" />
              <span className="text-sm">Reading resume…</span>
            </div>
          ) : (
            <>
              <FileUp className="h-10 w-10 mx-auto text-foreground/35 mb-3" />
              <p className="text-sm font-medium text-foreground">
                {file ? file.name : "Drop resume here or click to upload"}
              </p>
              <p className="text-xs product-helper-text mt-1">PDF, DOCX, TXT (max 10MB)</p>
            </>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground/80">Role / job description</label>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description, must-haves, or role summary you’re considering for them…"
            rows={5}
            className="product-input-surface w-full rounded-xl px-3 py-2 text-sm resize-y min-h-[100px]"
          />
          <p className="text-[11px] product-helper-text">
            Job fit analysis requires Basics or higher. Uses credits like other AI evaluations.
          </p>
        </div>

        {result && (
          <div className="rounded-xl border border-[#1dff00]/25 bg-[#1dff00]/5 p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{decisionLabel(result.canonical_decision)}</span>
              <span className="text-xs product-helper-text">
                Confidence {Math.round(result.confidence_score ?? 0)}%
              </span>
            </div>
            {result.blockers?.length ? (
              <div>
                <p className="text-xs font-medium text-foreground/90 mb-1">Blockers</p>
                <ul className="text-xs product-helper-text list-disc list-inside space-y-0.5">
                  {result.blockers.slice(0, 5).map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.exact_fit_evidence?.length ? (
              <div>
                <p className="text-xs font-medium text-foreground/90 mb-1">Signals</p>
                <ul className="text-xs product-helper-text list-disc list-inside space-y-0.5">
                  {result.exact_fit_evidence.slice(0, 4).map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button type="button" variant="outline" className="product-outline-button border-foreground/20" onClick={handleClose}>
            Close
          </Button>
          <Button
            type="button"
            disabled={parsing || analyzing || !resumeText.trim()}
            className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90"
            onClick={() => void onAnalyze()}
          >
            {analyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
    <Modal open={open} onClose={onClose} title="Referrals on JobRaker" size="lg">
      <div className="space-y-4 text-sm text-foreground/90">
        <p className="product-helper-text leading-relaxed">
          Share JobRaker with people in your network. When someone signs up with your link, they stay linked to your
          account for tracking—no cold outreach is sent from JobRaker just because you imported contacts.
        </p>
        <ul className="list-disc pl-5 space-y-2 product-helper-text">
          <li>
            <span className="text-foreground font-medium">Your link</span> adds <code className="text-xs bg-foreground/10 px-1 rounded">?ref=</code>{" "}
            on signup so attribution is automatic.
          </li>
          <li>
            <span className="text-foreground font-medium">LinkedIn export</span> is optional: use it to match people you
            know to roles already on your JobRaker job board.
          </li>
          <li>
            <span className="text-foreground font-medium">Rewards</span> (where applicable) are summarized under Billing—rates
            and eligibility can change; always check the latest terms there.
          </li>
        </ul>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="button" className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90" onClick={onOpenBilling}>
            Open billing &amp; payouts
          </Button>
          <Button type="button" variant="outline" className="product-outline-button border-foreground/20" onClick={onClose}>
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
    <Modal open={open} onClose={onClose} title="How referrals work" size="lg">
      <div className="space-y-5 text-sm">
        <ol className="list-decimal pl-5 space-y-4 product-helper-text">
          <li>
            <span className="text-foreground font-medium">Export from LinkedIn</span>
            <p className="mt-1">
              Request your data archive and download the ZIP. Inside, find{" "}
              <span className="text-foreground">Connections.csv</span> and upload it here. This can take LinkedIn a few
              minutes to generate.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 product-outline-button border-foreground/20"
              onClick={() => window.open(LINKEDIN_DATA_EXPORT_URL, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-2" />
              LinkedIn data export
            </Button>
          </li>
          <li>
            <span className="text-foreground font-medium">Upload to JobRaker</span>
            <p className="mt-1">
              We store connections under your account (RLS) so only you can see them. Use &quot;Replace previous import&quot;
              if you want a full refresh.
            </p>
          </li>
          <li>
            <span className="text-foreground font-medium">Run AI network match</span>
            <p className="mt-1">
              With Basics or higher, JobRaker compares your network to jobs on your board and saves suggestions you can
              review—nothing is auto-sent to candidates.
            </p>
          </li>
          <li>
            <span className="text-foreground font-medium">Share your link</span>
            <p className="mt-1">Copy or email your referral link from the Share menu when you&apos;re ready.</p>
          </li>
        </ol>
        <Button type="button" variant="outline" className="product-outline-button border-foreground/20" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}

function ReferralsWhatsNewModal({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element {
  return (
    <Modal open={open} onClose={onClose} title="Referrals in JobRaker" size="md">
      <ul className="list-disc pl-5 space-y-2 text-sm product-helper-text">
        <li>Share a personal signup link with automatic attribution.</li>
        <li>Import LinkedIn Connections.csv privately to power network ↔ job matching.</li>
        <li>Run an AI match pass against your JobRaker job queue (Basics+).</li>
        <li>Track each invite through signup, applications, and milestones in My referrals.</li>
        <li>Pre-screen a resume against any role with Check candidate fit.</li>
      </ul>
      <Button type="button" className="mt-4 bg-[#1dff00] text-black hover:bg-[#1dff00]/90" onClick={onClose}>
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
  onMarkStage: (referredUserId: string, stage: "hired" | "paid") => Promise<void>;
}): JSX.Element {
  const [timeframe, setTimeframe] = useState<ReferralTimeframe>("all");
  const [highlightStage, setHighlightStage] = useState<FunnelStageId>("signed_up");
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
      const name = `${r.referee?.first_name || ""} ${r.referee?.last_name || ""}`.toLowerCase();
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
                    ? "bg-[#1dff00]/20 text-[#1dff00] border border-[#1dff00]/35"
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
                    ? "bg-[#1dff00]/10 border-b-2 border-[#1dff00] -mb-px"
                    : "hover:bg-foreground/[0.03]"
                }`}
              >
                <p
                  className={`text-[11px] sm:text-xs font-medium leading-tight ${active ? "text-[#1dff00]" : "product-helper-text"}`}
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
                  <SelectItem key={s.id} value={s.label}>
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
          <Loader2 className='w-8 h-8 animate-spin text-[#1dff00] mx-auto' />
          <p className='text-sm product-helper-text mt-3'>Loading referrals…</p>
        </Card>
      ) : filteredReferrals.length === 0 ? (
        <Card className='product-section-card py-16 px-6 text-center border-dashed border-foreground/15 hover:border-[#1dff00]/30 transition-colors'>
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
              className='text-[#1dff00] hover:underline'
              onClick={onOpenFitCheck}
            >
              Check candidate fit
            </button>{" "}
            before you share your link.
          </p>
          <Button
            type='button'
            className='mt-6 bg-[#1dff00] text-black hover:bg-[#1dff00]/90'
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
                  <th className='px-4 py-3 font-medium'>Actions</th>
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
                        <span className='inline-flex rounded-full border border-[#1dff00]/30 bg-[#1dff00]/10 px-2 py-0.5 text-xs text-[#1dff00]'>
                          {FUNNEL_STAGES.find((s) => s.id === r.funnel_stage)
                            ?.label || r.funnel_stage}
                        </span>
                      </td>
                      <td className='px-4 py-3 product-helper-text'>
                        {new Date(r.signed_up_at).toLocaleDateString()}
                      </td>
                      <td className='px-4 py-3'>
                        <div className='flex flex-wrap gap-1'>
                          {r.funnel_stage !== "hired" &&
                          r.funnel_stage !== "paid" ? (
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                              className='h-7 text-[10px] border-foreground/20'
                              onClick={() =>
                                void onMarkStage(
                                  r.referred_user_id,
                                  "hired",
                                ).catch((e) => console.warn(e))
                              }
                            >
                              Mark hired
                            </Button>
                          ) : null}
                          {r.funnel_stage === "hired" ? (
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                              className='h-7 text-[10px] border-foreground/20'
                              onClick={() =>
                                void onMarkStage(
                                  r.referred_user_id,
                                  "paid",
                                ).catch((e) => console.warn(e))
                              }
                            >
                              Mark paid
                            </Button>
                          ) : null}
                        </div>
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
    refreshAll,
    importLinkedInCsv,
    runAgentScan,
    updateReferralStage,
  } = useReferrals();

  useEffect(() => {
    const onEvt = () => void refreshAll();
    window.addEventListener("jobraker:referrals-changed", onEvt);
    return () => window.removeEventListener("jobraker:referrals-changed", onEvt);
  }, [refreshAll]);

  const copyReferralLink = useCallback(async () => {
    const link = referralShareUrl || "";
    if (!link) {
      toastError("Referral link", "Your code is still loading. Try again in a moment.");
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
      toastError("Referral link", "Your link is still loading. Try again in a moment.");
      return;
    }
    const subject = encodeURIComponent("Join me on JobRaker");
    const body = encodeURIComponent(
      `I've been using JobRaker to run my job search—discovery, applications, and follow-ups in one place.\n\nIf you sign up with my link, it helps me track referrals in the app:\n\n${link}\n`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }, [referralShareUrl, toastError]);

  return (
    <div className="product-page-shell min-h-screen">
      <CheckCandidateFitModal open={fitOpen} onClose={() => setFitOpen(false)} />
      <ReferralsProgramInfoModal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        onOpenBilling={() => {
          setInfoOpen(false);
          navigate("/dashboard/billing");
        }}
      />
      <ReferralsHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ReferralsWhatsNewModal open={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />

      <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Referrals</h1>
              <button
                type="button"
                className="rounded-full p-1 text-foreground/40 hover:text-[#1dff00] hover:bg-[#1dff00]/10 transition-colors"
                title="How JobRaker referrals work"
                aria-label="About referrals"
                onClick={() => setInfoOpen(true)}
              >
                <Info className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
            <div className="mt-4 flex gap-6 border-b border-foreground/10">
              {(
                [
                  { id: "connections" as const, label: "My connections" },
                  { id: "referrals" as const, label: "My referrals" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`pb-3 text-sm font-medium transition-colors relative ${
                    tab === t.id ? "text-[#1dff00]" : "text-foreground/50 hover:text-foreground/80"
                  }`}
                >
                  {t.label}
                  {tab === t.id ? (
                    <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-[#1dff00] rounded-full shadow-[0_0_8px_rgba(29,255,0,0.45)]" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-3 shrink-0">
            <span className="inline-flex items-center rounded-full border border-foreground/15 bg-foreground/[0.04] px-3 py-1 text-xs font-medium product-helper-text">
              {stats?.referrals_today ?? 0} / {stats?.referrals_today_cap ?? 100} signups via your link today
            </span>
            {tab === "connections" ? (
              <>
                <div className="flex flex-wrap gap-2 justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="product-outline-button border-foreground/20">
                        <Share2 className="w-3.5 h-3.5 mr-1.5" />
                        Share
                        <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => void copyReferralLink()}>
                        <Link2 className="w-4 h-4 mr-2" />
                        Copy referral link
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={openEmailInvite}>
                        <Mail className="w-4 h-4 mr-2" />
                        Email invite…
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="product-outline-button border-foreground/20"
                    onClick={() => setHelpOpen(true)}
                  >
                    <HelpCircle className="w-3.5 h-3.5 mr-1.5" />
                    Help
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90"
                    onClick={() => setFitOpen(true)}
                  >
                    Check candidate fit
                  </Button>
                </div>
                <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] product-helper-text justify-end">
                  <button type="button" className="underline-offset-2 hover:underline text-[#1dff00]/90" onClick={() => navigate("/dashboard/settings")}>
                    Settings
                  </button>
                  <span className="text-foreground/20">·</span>
                  <button type="button" className="underline-offset-2 hover:underline text-[#1dff00]/90" onClick={() => navigate("/dashboard/billing")}>
                    Billing
                  </button>
                  <span className="text-foreground/20">·</span>
                  <button type="button" className="underline-offset-2 hover:underline text-[#1dff00]/90" onClick={() => setWhatsNewOpen(true)}>
                    What&apos;s new
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="product-outline-button border-foreground/20">
                        <Share2 className="w-3.5 h-3.5 mr-1.5" />
                        Share
                        <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => void copyReferralLink()}>
                        <Link2 className="w-4 h-4 mr-2" />
                        Copy referral link
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={openEmailInvite}>
                        <Mail className="w-4 h-4 mr-2" />
                        Email invite…
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="product-outline-button border-foreground/20"
                    onClick={() => setHelpOpen(true)}
                  >
                    <HelpCircle className="w-3.5 h-3.5 mr-1.5" />
                    Help
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="product-outline-button border-foreground/20"
                    onClick={() => navigate("/dashboard/billing")}
                  >
                    Billing &amp; payouts
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90"
                    onClick={() => setFitOpen(true)}
                  >
                    Check candidate fit
                  </Button>
                </div>
                <div className="flex gap-2 text-[11px] product-helper-text justify-end">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline text-[#1dff00]/90"
                    onClick={() => navigate("/dashboard/settings")}
                  >
                    Settings
                  </button>
                  <span className="text-foreground/20">·</span>
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline text-[#1dff00]/90"
                    onClick={() => setWhatsNewOpen(true)}
                  >
                    What&apos;s new
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {tab === "connections" ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <p className="text-lg sm:text-xl font-semibold text-foreground max-w-3xl">
              Grow JobRaker with people you trust—and see when your invites actually use the product.
            </p>
            <p className="mt-2 text-sm product-helper-text max-w-2xl">
              Import your LinkedIn connections export to match people you know to roles already on your JobRaker board.
              Nothing is messaged automatically; you stay in control of outreach.
            </p>
          </motion.div>
        ) : null}

        {tab === "connections" ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
            <Card className="product-section-card p-5 sm:p-6 hover:border-[#1dff00]/50 transition-all duration-300 md:col-span-1">
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    void importLinkedInCsv(f, { replace: replaceNetwork }).catch((err) =>
                      toastError("Import failed", err instanceof Error ? err.message : "Could not import CSV"),
                    );
                  }
                  e.target.value = "";
                }}
              />
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground">Upload connections</h3>
                <button
                  type="button"
                  className="rounded-full p-1 text-foreground/35 hover:text-[#1dff00] hover:bg-[#1dff00]/10 transition-colors"
                  aria-label="Help with LinkedIn export"
                  onClick={() => setHelpOpen(true)}
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm product-helper-text mb-4">
                Request your LinkedIn data archive, unzip it, and upload <span className="text-foreground/90">Connections.csv</span>{" "}
                here. Rows are scoped to your JobRaker account only.
              </p>
              <label className="flex items-center gap-2 text-xs product-helper-text mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={replaceNetwork}
                  onChange={(e) => setReplaceNetwork(e.target.checked)}
                  className="accent-[#1dff00] rounded"
                />
                Replace previous import (clear old connections)
              </label>
              <p className="text-[11px] product-helper-text mb-2">
                Saved contacts: <span className="text-foreground font-medium">{connectionCount}</span>
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="product-outline-button border-foreground/20 justify-start"
                  onClick={() => window.open(LINKEDIN_DATA_EXPORT_URL, "_blank", "noopener,noreferrer")}
                >
                  <Linkedin className="w-4 h-4 mr-2 text-[#0a66c2]" />
                  Get LinkedIn export
                </Button>
                <Button
                  type="button"
                  disabled={importing}
                  className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 justify-start"
                  onClick={() => csvInputRef.current?.click()}
                >
                  {importing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  {importing ? "Importing…" : "Upload connections"}
                </Button>
              </div>
            </Card>

            <Card className="product-section-card p-5 sm:p-6 hover:border-[#1dff00]/50 transition-all duration-300">
              <div className="w-10 h-10 rounded-full bg-[#1dff00]/15 border border-[#1dff00]/30 flex items-center justify-center mb-4">
                <Sparkles className="w-5 h-5 text-[#1dff00]" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Match network → job board</h3>
              <p className="text-sm product-helper-text mb-4">
                JobRaker compares imported contacts to jobs in your queue and saves ranked suggestions you can act on.
                Requires Basics or higher; uses the same jobs you track in the Jobs tab.
              </p>
              <p className="text-xs product-helper-text flex items-center gap-1.5 mb-3">
                <Clock className="w-3.5 h-3.5 text-[#1dff00]/70" />
                {suggestionCount} saved suggestions
              </p>
              <Button
                type="button"
                disabled={agentRunning || connectionCount === 0}
                title={connectionCount === 0 ? "Upload Connections.csv first" : undefined}
                className="w-full bg-foreground/10 border border-[#1dff00]/40 text-[#1dff00] hover:bg-[#1dff00]/10 disabled:opacity-50"
                onClick={() => void runAgentScan()}
              >
                {agentRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Running match…
                  </>
                ) : (
                  <>
                    <Sparkle className="w-4 h-4 mr-2" />
                    Run AI network match
                  </>
                )}
              </Button>
              {connectionCount === 0 ? (
                <p className="text-[11px] product-helper-text mt-2">Upload connections in the first card to enable matching.</p>
              ) : null}
            </Card>

            <Card className="product-section-card p-5 sm:p-6 hover:border-[#1dff00]/50 transition-all duration-300">
              <div className="w-10 h-10 rounded-full bg-[#1dff00]/15 border border-[#1dff00]/30 flex items-center justify-center mb-4">
                <Banknote className="w-5 h-5 text-[#1dff00]" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Referral rewards</h3>
              <p className="text-sm product-helper-text mb-4">
                Qualifying invites can unlock revenue share (often up to 20% on their spend) once they become paying JobRaker
                members. Exact rates and eligibility are always shown in Billing.
              </p>
              <p className="text-xs product-helper-text flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#1dff00]/70" />
                Tracked from signup through hired / paid milestones
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-3 px-0 text-[#1dff00] hover:text-[#1dff00] hover:bg-transparent"
                onClick={() => navigate("/dashboard/billing")}
              >
                View billing &amp; payouts
              </Button>
            </Card>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
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
                  toastError("Update failed", e instanceof Error ? e.message : "Try again");
                }
              }}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
};
