import { useCallback, useRef, useState } from "react";
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

  const onDrop = (e: React.DragEvent) => {
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
              Upload a resume to see if they would be a good fit for a role you have in mind.
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
          Not sure if someone you know would be a good fit? Upload their resume and we&apos;ll analyze their background
          against a job description you paste — same engine as JobRaker job fit, without messaging anyone automatically.
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
              ? "border-[#ffd700]/70 bg-[#ffd700]/5"
              : "border-foreground/20 bg-foreground/[0.03] hover:border-[#ffd700]/40"
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
              <Loader2 className="h-8 w-8 animate-spin text-[#ffd700]" />
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
          <div className="rounded-xl border border-[#ffd700]/25 bg-[#ffd700]/5 p-4 space-y-2">
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
            className="bg-[#ffd700] text-black hover:bg-[#ffd700]/90"
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

const FUNNEL_STAGES = [
  { id: "signed_up", label: "Signed Up" },
  { id: "application_started", label: "Application Started" },
  { id: "application_completed", label: "Application Completed" },
  { id: "offer_extended", label: "Offer Extended" },
  { id: "hired", label: "Hired" },
  { id: "paid", label: "Paid" },
] as const;

type FunnelStageId = (typeof FUNNEL_STAGES)[number]["id"];
type ReferralTimeframe = "1d" | "3d" | "7d" | "all";

function MyReferralsPanel({
  onOpenFitCheck,
  onShareLink,
}: {
  onOpenFitCheck: () => void;
  onShareLink: () => void;
}): JSX.Element {
  const { success } = useToast();
  const [timeframe, setTimeframe] = useState<ReferralTimeframe>("all");
  const [highlightStage, setHighlightStage] = useState<FunnelStageId>("signed_up");
  const [statusFilter, setStatusFilter] = useState<FunnelStageId>("signed_up");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    const base: Record<FunnelStageId, number> = {
      signed_up: 0,
      application_started: 0,
      application_completed: 0,
      offer_extended: 0,
      hired: 0,
      paid: 0,
    };
    void timeframe;
    void search;
    void statusFilter;
    return base;
  }, [timeframe, search, statusFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm product-helper-text">Track your referral earnings and progress</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="product-outline-button border-foreground/20"
            onClick={() => success("You're on the latest referrals experience.")}
          >
            <Sparkle className="w-3.5 h-3.5 mr-1.5 opacity-80" />
            What&apos;s new
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="product-outline-button border-foreground/20">
                <Share2 className="w-3.5 h-3.5 mr-1.5" />
                Share
                <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              <DropdownMenuItem onClick={onShareLink}>
                <Link2 className="w-4 h-4 mr-2" />
                Copy referral link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => success("Invite email flow coming soon.")}>Email invite</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex rounded-lg border border-foreground/15 p-0.5 bg-foreground/[0.04]">
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
                type="button"
                onClick={() => setTimeframe(tf.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  timeframe === tf.id
                    ? "bg-[#ffd700]/20 text-[#ffd700] border border-[#ffd700]/35"
                    : "text-foreground/55 hover:text-foreground/90"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Card className="product-section-card overflow-hidden p-0 border-foreground/15">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y divide-border/50 lg:divide-y-0 border-b border-border/50">
          {FUNNEL_STAGES.map((stage) => {
            const active = highlightStage === stage.id;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => {
                  setHighlightStage(stage.id);
                  setStatusFilter(stage.id);
                }}
                className={`px-3 py-4 text-left transition-colors ${
                  active ? "bg-[#ffd700]/10 border-b-2 border-[#ffd700] -mb-px" : "hover:bg-foreground/[0.03]"
                }`}
              >
                <p className={`text-[11px] sm:text-xs font-medium leading-tight ${active ? "text-[#ffd700]" : "product-helper-text"}`}>
                  {stage.label}
                </p>
                <p className="text-2xl font-bold text-foreground tabular-nums mt-1">{counts[stage.id]}</p>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <ListFilter className="w-4 h-4 text-foreground/40 shrink-0" />
          <span className="text-xs text-foreground/50 shrink-0">Status</span>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FunnelStageId)}>
            <SelectTrigger className="w-[min(100%,220px)] h-9 text-sm border-foreground/15">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {FUNNEL_STAGES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/35" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="product-input-surface w-full rounded-xl pl-9 pr-3 py-2 text-sm h-10"
          />
        </div>
      </div>

      <Card className="product-section-card py-16 px-6 text-center border-dashed border-foreground/15 hover:border-[#ffd700]/30 transition-colors">
        <div className="w-14 h-14 rounded-full bg-foreground/5 border border-foreground/10 flex items-center justify-center mx-auto mb-4">
          <UserPlus className="w-7 h-7 text-foreground/40" />
        </div>
        <p className="text-sm text-foreground font-medium max-w-md mx-auto">
          You don&apos;t have any referrals yet. All your referrals will be visible here.
        </p>
        <p className="text-xs product-helper-text max-w-sm mx-auto mt-2">
          Pre-screen candidates with{" "}
          <button type="button" className="text-[#ffd700] hover:underline" onClick={onOpenFitCheck}>
            Check candidate fit
          </button>{" "}
          before you share your link.
        </p>
        <Button
          type="button"
          className="mt-6 bg-[#ffd700] text-black hover:bg-[#ffd700]/90"
          onClick={onShareLink}
        >
          <Link2 className="w-4 h-4 mr-2" />
          Share your referral link
        </Button>
      </Card>
    </div>
  );
}

export const ReferralsPage = (): JSX.Element => {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const [tab, setTab] = useState<"connections" | "referrals">("connections");
  const [fitOpen, setFitOpen] = useState(false);

  const referralLink = `${typeof window !== "undefined" ? window.location.origin : ""}/signIn?ref=pending`;

  const copyReferralLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      success("Referral link copied");
    } catch {
      toastError("Copy failed", "Could not copy to clipboard.");
    }
  }, [referralLink, success, toastError]);

  return (
    <div className="product-page-shell min-h-screen">
      <CheckCandidateFitModal open={fitOpen} onClose={() => setFitOpen(false)} />

      <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Referrals</h1>
              <button
                type="button"
                className="rounded-full p-1 text-foreground/40 hover:text-[#ffd700] hover:bg-[#ffd700]/10 transition-colors"
                title="Referrals let you share JobRaker with people you trust. You stay in control—no automatic messages when you upload connections."
                aria-label="About referrals"
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
                    tab === t.id ? "text-[#ffd700]" : "text-foreground/50 hover:text-foreground/80"
                  }`}
                >
                  {t.label}
                  {tab === t.id ? (
                    <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-[#ffd700] rounded-full shadow-[0_0_8px_rgba(255,215,0,0.45)]" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-3 shrink-0">
            <span className="inline-flex items-center rounded-full border border-foreground/15 bg-foreground/[0.04] px-3 py-1 text-xs font-medium product-helper-text">
              0 / 100 referrals today
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
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="product-outline-button border-foreground/20"
                    onClick={() => navigate("/dashboard/settings/profile")}
                  >
                    <HelpCircle className="w-3.5 h-3.5 mr-1.5" />
                    Help
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-[#ffd700] text-black hover:bg-[#ffd700]/90"
                    onClick={() => setFitOpen(true)}
                  >
                    Check candidate fit
                  </Button>
                </div>
                <div className="flex gap-2 text-[11px] product-helper-text justify-end">
                  <button type="button" className="underline-offset-2 hover:underline text-[#ffd700]/90" onClick={() => navigate("/dashboard/settings")}>
                    Settings
                  </button>
                  <span className="text-foreground/20">·</span>
                  <button type="button" className="underline-offset-2 hover:underline text-[#ffd700]/90" onClick={() => navigate("/dashboard/billing")}>
                    Billing
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="product-outline-button border-foreground/20"
                  onClick={() => navigate("/dashboard/billing")}
                >
                  Billing & payouts
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-[#ffd700] text-black hover:bg-[#ffd700]/90"
                  onClick={() => setFitOpen(true)}
                >
                  Check candidate fit
                </Button>
              </div>
            )}
          </div>
        </div>

        {tab === "connections" ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <p className="text-lg sm:text-xl font-semibold text-foreground max-w-3xl">
              Refer people you&apos;ve worked with. Earn when they get hired.
            </p>
            <p className="mt-2 text-sm product-helper-text max-w-2xl">
              Uploading your LinkedIn connections will not trigger any messages. You remain in control.
            </p>
          </motion.div>
        ) : null}

        {tab === "connections" ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
            <Card className="product-section-card p-5 sm:p-6 hover:border-[#ffd700]/50 transition-all duration-300 md:col-span-1">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground">Upload connections</h3>
                <HelpCircle className="w-4 h-4 text-foreground/35" />
              </div>
              <p className="text-sm product-helper-text mb-4">
                Extract the ZIP from LinkedIn and upload &quot;Connections.csv&quot; here.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="product-outline-button border-foreground/20 justify-start"
                  onClick={() => window.open("https://www.linkedin.com/mypreferences/d/download-my-data", "_blank", "noopener,noreferrer")}
                >
                  <Linkedin className="w-4 h-4 mr-2 text-[#0a66c2]" />
                  Get my connections
                </Button>
                <Button
                  type="button"
                  className="bg-[#ffd700] text-black hover:bg-[#ffd700]/90 justify-start"
                  onClick={() => {}}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload connections
                </Button>
              </div>
            </Card>

            <Card className="product-section-card p-5 sm:p-6 hover:border-[#ffd700]/50 transition-all duration-300">
              <div className="w-10 h-10 rounded-full bg-[#ffd700]/15 border border-[#ffd700]/30 flex items-center justify-center mb-4">
                <Sparkles className="w-5 h-5 text-[#ffd700]" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">We find matches</h3>
              <p className="text-sm product-helper-text mb-4">
                We scan your network against active roles and surface strong fits.
              </p>
              <p className="text-xs product-helper-text flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#ffd700]/70" />
                Within minutes of upload
              </p>
            </Card>

            <Card className="product-section-card p-5 sm:p-6 hover:border-[#ffd700]/50 transition-all duration-300">
              <div className="w-10 h-10 rounded-full bg-[#ffd700]/15 border border-[#ffd700]/30 flex items-center justify-center mb-4">
                <Banknote className="w-5 h-5 text-[#ffd700]" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">You earn 20%</h3>
              <p className="text-sm product-helper-text mb-4">
                Get paid for everything your referral earns from their first billable hour.
              </p>
              <p className="text-xs product-helper-text flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#ffd700]/70" />
                Starts when they are hired
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-3 px-0 text-[#ffd700] hover:text-[#ffd700] hover:bg-transparent"
                onClick={() => navigate("/dashboard/billing")}
              >
                View billing & payouts
              </Button>
            </Card>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <MyReferralsPanel onOpenFitCheck={() => setFitOpen(true)} onShareLink={() => void copyReferralLink()} />
          </motion.div>
        )}
      </div>
    </div>
  );
};
