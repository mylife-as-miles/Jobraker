import { AlertTriangle, CheckCircle2, ShieldCheck, Target, Zap } from "lucide-react";
import type { ExplainableJobOpportunity, RankingReason } from "@/services/intelligence/types";
import { getRecommendedActionLabel } from "@/services/intelligence/opportunityScoreEngine";

type OpportunityScoreSummaryProps = {
  opportunity?: ExplainableJobOpportunity | null;
  compact?: boolean;
};

const scoreTone = (score: number): string => {
  if (score >= 85) return "text-brand border-brand/30 bg-brand/10";
  if (score >= 65) return "text-[#f8d74a] border-[#f8d74a]/25 bg-[#f8d74a]/10";
  if (score >= 45) return "text-[#fb923c] border-[#fb923c]/25 bg-[#fb923c]/10";
  return "text-foreground/60 border-foreground/10 bg-foreground/5";
};

const reasonIcon = (reason: RankingReason) => {
  if (reason.impact === "cap" || reason.impact === "negative") {
    return <AlertTriangle className='mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#fb923c]' />;
  }
  return <CheckCircle2 className='mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand' />;
};

export function OpportunityScoreSummary({
  opportunity,
  compact = false,
}: OpportunityScoreSummaryProps) {
  if (!opportunity) return null;

  const topReasons = opportunity.visibleReasons
    .filter((item) => item.id !== "recommended-action")
    .slice(0, compact ? 3 : 5);
  const primaryCap = opportunity.capsApplied[0] ?? null;
  const primaryBlocker = opportunity.blockers[0] ?? null;

  return (
    <div
      className={`rounded-xl border border-foreground/10 bg-foreground/[0.03] ${
        compact ? "p-3" : "p-4"
      } space-y-3`}
    >
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='inline-flex items-center gap-2 text-sm font-medium text-foreground/80'>
          <Zap className='h-4 w-4 text-brand' />
          Opportunity intelligence
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${scoreTone(
              opportunity.opportunityScore,
            )}`}
          >
            {opportunity.opportunityScore}% Opportunity
          </span>
          <span className='rounded-full border border-foreground/10 bg-foreground/5 px-2.5 py-1 text-xs text-foreground/65'>
            #{opportunity.rank || "-"} {opportunity.rankLabel.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      <div className='grid grid-cols-3 gap-2'>
        {[
          { label: "Lead", value: opportunity.leadQualityScore, icon: ShieldCheck },
          { label: "Fit", value: opportunity.candidateFitScore, icon: Target },
          { label: "Evidence", value: opportunity.profileEvidenceScore, icon: CheckCircle2 },
        ].map((item) => (
          <div
            key={item.label}
            className='min-w-0 rounded-lg border border-foreground/10 bg-foreground/5 px-2 py-2'
          >
            <div className='flex items-center gap-1 text-[10px] uppercase tracking-wide text-foreground/40'>
              <item.icon className='h-3 w-3' />
              <span>{item.label}</span>
            </div>
            <div className='mt-1 text-sm font-semibold text-foreground'>
              {item.value}%
            </div>
          </div>
        ))}
      </div>

      {topReasons.length > 0 ? (
        <div className='space-y-2'>
          {topReasons.map((item) => (
            <div key={item.id} className='flex gap-2 text-xs text-foreground/70'>
              {reasonIcon(item)}
              <span>
                <span className='font-medium text-foreground/80'>{item.title}:</span>{" "}
                {item.detail}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {primaryCap || primaryBlocker ? (
        <div className='rounded-lg border border-[#fb923c]/20 bg-[#fb923c]/10 px-3 py-2 text-xs text-foreground/75'>
          <span className='font-medium text-[#fb923c]'>
            {primaryCap ? "Cap applied" : "Watch out"}:
          </span>{" "}
          {primaryCap?.reason || primaryBlocker?.detail}
        </div>
      ) : null}

      <div className='rounded-lg border border-brand/20 bg-brand/10 px-3 py-2 text-xs text-brand'>
        Recommended action: {getRecommendedActionLabel(opportunity.recommendedAction)}
      </div>
    </div>
  );
}
