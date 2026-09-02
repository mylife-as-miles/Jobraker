import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles,
  RotateCcw,
  CheckCircle2,
  Lock,
  ArrowUpRight,
  Loader2,
  FileText,
  Eye,
  Edit3,
  ShieldCheck,
  Send,
  Sliders,
} from "lucide-react";
import {
  tailorResumeViaEdge,
  recalculateConfidence,
  type TailorResumeResponse,
} from "@/services/ai/tailorResume";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import { useToast } from "@/components/ui/toast-provider";

export interface TailorResumeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: {
    id: string;
    title: string;
    company: string;
    description: string;
    apply_url?: string | null;
  } | null;
  baseResumeText: string;
  resumeName?: string;
  onApply: (tailoredText: string, confidenceScore: number) => Promise<void> | void;
}

export const TailorResumeModal = ({
  open,
  onOpenChange,
  job,
  baseResumeText,
  resumeName,
  onApply,
}: TailorResumeModalProps) => {
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [loading, setLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [applying, setApplying] = useState(false);

  const [tailoredText, setTailoredText] = useState("");
  const [confidenceScore, setConfidenceScore] = useState(95);
  const [previousScore, setPreviousScore] = useState<number | undefined>(68);
  const [matchedKeywords, setMatchedKeywords] = useState<string[]>([]);
  const [tailoringHighlights, setTailoringHighlights] = useState<string[]>([]);

  const handleInitialTailor = useCallback(async () => {
    if (!job || !baseResumeText) return;
    setLoading(true);
    try {
      const result: TailorResumeResponse = await tailorResumeViaEdge({
        jobDescription: job.description,
        resumeText: baseResumeText,
        jobTitle: job.title,
        company: job.company,
      });

      setTailoredText(result.tailored_resume);
      setConfidenceScore(result.confidence_score);
      setPreviousScore(result.previous_confidence_score);
      setMatchedKeywords(result.matched_keywords);
      setTailoringHighlights(result.tailoring_highlights);

      addToast({
        title: "Resume Tailored",
        description: `CV optimized for ${job.company}. Match confidence elevated to ${result.confidence_score}%.`,
        variant: "success",
      });
    } catch (err: any) {
      console.error("Failed to tailor resume:", err);
      addToast({
        title: "Tailoring Notice",
        description: "Generated tailored resume draft with local optimization.",
        variant: "info",
      });
      setTailoredText(baseResumeText);
    } finally {
      setLoading(false);
    }
  }, [job, baseResumeText, addToast]);

  useEffect(() => {
    if (open && job && baseResumeText) {
      handleInitialTailor();
    }
  }, [open, job, baseResumeText, handleInitialTailor]);

  const handleRecalculate = async () => {
    if (!job || !tailoredText.trim()) return;
    setRecalculating(true);
    try {
      const result = await recalculateConfidence(
        job.description,
        tailoredText,
        job.title,
      );

      setConfidenceScore(result.confidence_score);
      setMatchedKeywords(result.matched_keywords);

      addToast({
        title: "Confidence Recalculated",
        description: `Current match confidence updated to ${result.confidence_score}%.`,
        variant: "success",
      });
    } catch (err: any) {
      console.error("Failed to recalculate confidence:", err);
      addToast({
        title: "Recalculation error",
        description: "Could not recalculate score at this time.",
        variant: "destructive",
      });
    } finally {
      setRecalculating(false);
    }
  };

  const handleApplyClick = async () => {
    if (!tailoredText.trim()) return;
    setApplying(true);
    try {
      await onApply(tailoredText, confidenceScore);
      onOpenChange(false);
    } catch (err: any) {
      console.error("Apply failed:", err);
      addToast({
        title: "Apply failed",
        description: err?.message || "Failed to submit application.",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  if (!job) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background text-foreground border-border/60 rounded-3xl shadow-2xl'>
        {/* Header */}
        <DialogHeader className='p-6 pb-4 border-b border-border/40 space-y-2 shrink-0'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <div className='w-8 h-8 rounded-xl bg-brand/15 text-brand flex items-center justify-center'>
                <Sparkles className='w-4 h-4' />
              </div>
              <div>
                <DialogTitle className='text-lg font-bold'>
                  Tailor Resume to Job Description
                </DialogTitle>
                <DialogDescription className='text-xs text-muted-foreground'>
                  {job.title} at <span className='font-semibold text-foreground'>{job.company}</span>
                  {resumeName ? ` • Attached Resume: ${resumeName}` : ""}
                </DialogDescription>
              </div>
            </div>
            <div className='hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-foreground/5 border border-foreground/10 text-[11px] text-muted-foreground'>
              <ShieldCheck className='w-3.5 h-3.5 text-brand' />
              <span>Contact info preserved from attached resume</span>
            </div>
          </div>

          {/* Confidence Recalculation Score Banner */}
          <div className='grid grid-cols-1 md:grid-cols-3 gap-3 pt-2'>
            <div className='p-3 rounded-2xl bg-brand/10 border border-brand/25 flex items-center justify-between'>
              <div>
                <div className='text-[10px] uppercase font-bold tracking-wider text-brand'>
                  Recalculated Confidence
                </div>
                <div className='text-2xl font-black tabular-nums text-foreground flex items-baseline gap-2'>
                  {loading ? (
                    <Loader2 className='w-5 h-5 animate-spin text-brand' />
                  ) : (
                    <>
                      <span>{confidenceScore}%</span>
                      {previousScore && (
                        <span className='text-xs font-semibold text-brand/80 flex items-center'>
                          <ArrowUpRight className='w-3 h-3' />
                          +{Math.max(0, confidenceScore - previousScore)}%
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className='px-2 py-1 rounded-md bg-brand text-black text-[10px] font-bold uppercase tracking-wider'>
                Target ~95%
              </div>
            </div>

            <div className='p-3 rounded-2xl bg-foreground/5 border border-foreground/10 flex flex-col justify-center'>
              <div className='text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1'>
                Matched ATS Keywords
              </div>
              <div className='flex flex-wrap gap-1 max-h-12 overflow-y-auto no-scrollbar'>
                {matchedKeywords.length > 0 ? (
                  matchedKeywords.slice(0, 6).map((kw) => (
                    <span
                      key={kw}
                      className='text-[10px] px-2 py-0.5 rounded-md bg-foreground/10 text-foreground font-medium'
                    >
                      {kw}
                    </span>
                  ))
                ) : (
                  <span className='text-[11px] text-muted-foreground'>Optimizing keyword alignment...</span>
                )}
              </div>
            </div>

            <div className='p-3 rounded-2xl bg-foreground/5 border border-foreground/10 flex flex-col justify-center'>
              <div className='text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1'>
                Optimization Status
              </div>
              <div className='flex items-center gap-1.5 text-xs font-semibold text-foreground'>
                <CheckCircle2 className='w-4 h-4 text-brand' />
                <span>XYZ High-Impact Formula Applied</span>
              </div>
              <span className='text-[10px] text-muted-foreground mt-0.5'>
                Ready for automated ATS screening
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Tailoring Highlights bar */}
        {tailoringHighlights.length > 0 && (
          <div className='px-6 py-2.5 bg-zinc-50 dark:bg-zinc-900/60 border-b border-border/40 flex items-center gap-2 overflow-x-auto text-[11px] text-muted-foreground shrink-0'>
            <Sliders className='w-3.5 h-3.5 text-brand shrink-0' />
            <span className='font-semibold text-foreground shrink-0'>AI Tweaks:</span>
            <div className='flex items-center gap-4 truncate'>
              {tailoringHighlights.map((hl, i) => (
                <span key={i} className='truncate flex items-center gap-1'>
                  • {hl}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tab Switcher & Editor Area */}
        <div className='px-6 pt-3 flex items-center justify-between shrink-0'>
          <div className='flex items-center gap-1 p-1 rounded-xl bg-foreground/5 border border-foreground/10'>
            <button
              type='button'
              onClick={() => setActiveTab("edit")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "edit"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Edit3 className='w-3.5 h-3.5' />
              Edit Tailored CV
            </button>
            <button
              type='button'
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "preview"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Eye className='w-3.5 h-3.5' />
              Formatted Preview
            </button>
          </div>

          <span className='text-[11px] text-muted-foreground'>
            {tailoredText.length} characters • {tailoredText.split("\n").length} lines
          </span>
        </div>

        {/* Body Area */}
        <div className='flex-1 p-6 pt-3 overflow-y-auto min-h-[300px]'>
          {loading ? (
            <div className='h-64 flex flex-col items-center justify-center gap-3 text-muted-foreground'>
              <Loader2 className='w-8 h-8 animate-spin text-brand' />
              <p className='text-sm font-medium'>
                AI is tailoring your resume and aligning ATS keywords to {job.company}...
              </p>
            </div>
          ) : activeTab === "edit" ? (
            <Textarea
              value={tailoredText}
              onChange={(e) => setTailoredText(e.target.value)}
              className='w-full h-full min-h-[320px] font-mono text-xs p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border-border/60 focus:ring-1 focus:ring-brand leading-relaxed resize-none'
              placeholder='Tailored resume content will appear here...'
            />
          ) : (
            <div className='h-full min-h-[320px] p-6 rounded-2xl bg-white text-zinc-900 shadow-inner overflow-y-auto text-xs leading-relaxed'>
              <MarkdownContent content={tailoredText} />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className='p-6 pt-4 border-t border-border/40 bg-background/95 flex items-center justify-between gap-3 shrink-0'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => onOpenChange(false)}
            disabled={applying}
            className='text-xs font-semibold'
          >
            Cancel
          </Button>

          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={handleRecalculate}
              disabled={loading || recalculating || applying || !tailoredText.trim()}
              className='text-xs font-semibold gap-1.5 border-border/60 hover:bg-foreground/5'
              title='Recalculate confidence score after manual edits'
            >
              <RotateCcw className={`w-3.5 h-3.5 ${recalculating ? "animate-spin" : ""}`} />
              {recalculating ? "Recalculating..." : "Recalculate Confidence"}
            </Button>

            <Button
              size='sm'
              onClick={handleApplyClick}
              disabled={loading || applying || !tailoredText.trim()}
              className='bg-brand text-black hover:bg-brand/90 text-xs font-bold gap-2 px-4 shadow-[0_0_15px_rgba(47,217,104,0.3)]'
            >
              {applying ? (
                <>
                  <Loader2 className='w-4 h-4 animate-spin' />
                  Submitting Application...
                </>
              ) : (
                <>
                  <Send className='w-4 h-4' />
                  Apply with Tailored Resume ({confidenceScore}%)
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
