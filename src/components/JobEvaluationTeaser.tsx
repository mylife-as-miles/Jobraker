import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";
import {
  getPromptBadgeLabel,
  type UpgradePromptTier,
} from "@/lib/subscriptionAccess";

export interface JobEvaluationTeaserProps {
  jobTitle: string;
  company?: string | null;
  descriptionPreview?: string | null;
  className?: string;
  compact?: boolean;
  requiredTier?: UpgradePromptTier;
  title?: string;
  ctaLabel?: string;
}

function clipText(text: string, maxLen: number) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen).trim()}…`;
}

export function JobEvaluationTeaser({
  jobTitle,
  company,
  descriptionPreview,
  className = "",
  compact = false,
  requiredTier = "Basics",
  title = "AI job fit verdict",
  ctaLabel = "Upgrade for full AI fit report",
}: JobEvaluationTeaserProps) {
  const snippet =
    descriptionPreview && descriptionPreview.trim().length > 0
      ? clipText(descriptionPreview, compact ? 100 : 140)
      : `How your profile lines up with "${clipText(jobTitle, 48)}"${
          company ? ` at ${company}` : ""
        } — strengths, gaps, and a clear go / no-go signal.`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`relative overflow-hidden rounded-2xl border border-foreground/12 bg-gradient-to-br from-foreground/[0.04] via-background to-background ${compact ? "p-4" : "p-6 sm:p-8"} ${className}`}
    >
      <div className='pointer-events-none absolute inset-0'>
        <div className='absolute -right-8 -top-8 h-40 w-40 rounded-full bg-brand/10 blur-3xl' />
        <div className='absolute -bottom-10 -left-10 h-44 w-44 rounded-full bg-violet-500/10 blur-3xl' />
      </div>

      <div className='relative z-10'>
        <div className='mb-3 flex flex-wrap items-center gap-2'>
          <span className='rounded-full border border-brand/35 bg-brand/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand'>
            {getPromptBadgeLabel(requiredTier)}
          </span>
          <span className='inline-flex items-center gap-1 text-[11px] text-foreground/45'>
            <Lock className='h-3 w-3' />
            Preview — upgrade to unlock the full report
          </span>
        </div>

        <div className='mb-2 flex items-start gap-2'>
          <div className='mt-0.5 rounded-lg bg-brand/15 p-2'>
            <Sparkles className='h-5 w-5 text-brand' />
          </div>
          <div>
            <h3 className='text-base font-semibold text-foreground'>
              {title}
            </h3>
            <p className='mt-1 text-sm text-foreground/60'>
              Full analysis uses your resume and this posting — blockers, match
              score drivers, and interview angles. You’re seeing a short preview
              only.
            </p>
          </div>
        </div>

        <div className='relative mt-4 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4'>
          <p className='text-sm leading-relaxed text-foreground/85'>
            {snippet}
          </p>
          <div
            className='pointer-events-none absolute inset-x-0 bottom-0 top-1/3 bg-gradient-to-b from-transparent to-background/95'
            aria-hidden
          />
          <div
            className='pointer-events-none absolute inset-0 backdrop-blur-[2px] opacity-70'
            style={{
              maskImage:
                "linear-gradient(to bottom, transparent 0%, black 55%)",
            }}
            aria-hidden
          />
          <p className='relative mt-3 text-center text-[11px] font-medium uppercase tracking-wider text-foreground/40'>
            Unlock on {requiredTier} to read the full evaluation
          </p>
        </div>

        <div className='mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <p className='text-xs text-foreground/45'>
            Same engine as single-job apply — see risks before you send.
          </p>
          <Link to='/dashboard/billing' className='shrink-0'>
            <Button className='w-full bg-gradient-to-r from-brand to-brand/85 font-semibold text-black hover:from-brand/90 sm:w-auto'>
              {ctaLabel}
              <ArrowRight className='ml-2 h-4 w-4' />
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
