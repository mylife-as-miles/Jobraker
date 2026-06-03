import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Lock,
  ShieldCheck,
  Target,
  Zap,
} from "lucide-react";
import type { ExplainableJobOpportunity, RankingReason } from "@/services/intelligence/types";
import { getRecommendedActionLabel } from "@/services/intelligence/opportunityScoreEngine";
import { Button } from "@/components/ui/button";
import {
  getPromptBadgeLabel,
  type UpgradePromptTier,
} from "@/lib/subscriptionAccess";

type OpportunityScoreSummaryProps = {
  opportunity?: ExplainableJobOpportunity | null;
  compact?: boolean;
  fullAccess?: boolean;
  requiredTier?: UpgradePromptTier;
};

const scoreTone = (score: number): string => {
  if (score >= 85) return "text-brand border-brand/30 bg-brand/10";
  if (score >= 65) return "text-[#f8d74a] border-[#f8d74a]/25 bg-[#f8d74a]/10";
  if (score >= 45) return "text-[#fb923c] border-[#fb923c]/25 bg-[#fb923c]/10";
  return "text-foreground/60 border-foreground/10 bg-foreground/5";
};

const reasonIcon = (item: RankingReason) => {
  if (item.impact === "cap" || item.impact === "negative") {
    return <AlertTriangle className='mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#fb923c]' />;
  }
  return <CheckCircle2 className='mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand' />;
};

export function OpportunityScoreSummary({
  opportunity,
  compact = false,
  fullAccess = true,
  requiredTier = "Pro",
}: OpportunityScoreSummaryProps) {
  const [isOpen, setIsOpen] = useState(!compact);

  if (!opportunity) return null;

  const topReasons = opportunity.visibleReasons
    .filter((item) => item.id !== "recommended-action")
    .slice(0, fullAccess ? (compact ? 3 : 5) : 2);
  const primaryCap = opportunity.capsApplied[0] ?? null;
  const primaryBlocker = opportunity.blockers[0] ?? null;

  return (
    <div
      className={`rounded-xl border border-foreground/10 bg-foreground/[0.03] ${
        compact ? "p-3" : "p-4"
      } space-y-3`}
    >
      <button
        type='button'
        className='flex w-full flex-wrap items-center justify-between gap-3 text-left'
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
      >
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
          {!fullAccess ? (
            <span className='rounded-full border border-brand/25 bg-brand/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand'>
              {getPromptBadgeLabel(requiredTier)}
            </span>
          ) : null}
          <ChevronDown
            className={`h-4 w-4 text-foreground/45 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {isOpen ? (
        <>
          <div className='grid grid-cols-3 gap-2'>
            {[
              { label: "Lead", value: opportunity.leadQualityScore, icon: ShieldCheck },
              { label: "Fit", value: opportunity.candidateFitScore, icon: Target },
              {
                label: "Evidence",
                value: opportunity.profileEvidenceScore,
                icon: CheckCircle2,
              },
            ].map((item) => (
              <div
                key={item.label}
                className='min-w-0 rounded-lg border border-foreground/10 bg-foreground/5 px-2 py-2'
              >
                <div className='flex items-center gap-1 text-[10px] uppercase tracking-wide text-foreground/40'>
                  <item.icon className='h-3 w-3' />
                  <span>{item.label}</span>
                </div>
                <div className='mt-1 text-sm font-semibold text-foreground'>{item.value}%</div>
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

          {!fullAccess ? (
            <div className='rounded-lg border border-brand/20 bg-brand/[0.04] p-3 text-xs text-foreground/75 space-y-3'>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='rounded-full border border-brand/35 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand'>
                  {getPromptBadgeLabel(requiredTier)}
                </span>
                <span className='inline-flex items-center gap-1 text-[11px] text-foreground/45'>
                  <Lock className='h-3 w-3' />
                  Preview only
                </span>
              </div>
              <p className='leading-relaxed'>
                You can see the score preview here. Upgrade to unlock the full
                breakdown, engine synthesis, score caps, proof paths, and next-step
                guidance.
              </p>
              <Link to='/dashboard/billing' className='inline-flex'>
                <Button
                  size='sm'
                  className='h-8 rounded-full bg-brand px-3 text-xs font-semibold text-black hover:bg-brand/90'
                >
                  Unlock full opportunity intelligence
                </Button>
              </Link>
            </div>
          ) : null}

          {fullAccess && (primaryCap || primaryBlocker) ? (
            <div className='rounded-lg border border-[#fb923c]/20 bg-[#fb923c]/10 px-3 py-2 text-xs text-foreground/75'>
              <span className='font-medium text-[#fb923c]'>
                {primaryCap ? "Cap applied" : "Watch out"}:
              </span>{" "}
              {primaryCap?.reason || primaryBlocker?.detail}
            </div>
          ) : null}

          {!compact && fullAccess ? (
            <div className='rounded-lg border border-brand/20 bg-brand/[0.02] p-3 text-xs text-foreground/80 space-y-1'>
              <span className='font-semibold text-foreground/90 flex items-center gap-1.5'>
                <Zap className='h-3.5 w-3.5 text-brand' />
                Engine Synthesis
              </span>
              <p className='text-foreground/75 leading-relaxed'>
                This job ranks{" "}
                <span className='font-semibold text-brand-light'>
                  {opportunity.opportunityScore >= 85
                    ? "exceptionally high"
                    : opportunity.opportunityScore >= 72
                      ? "strong"
                      : opportunity.opportunityScore >= 52
                        ? "moderately"
                        : "low"}
                </span>{" "}
                because your{" "}
                <span className='font-semibold text-brand'>
                  {opportunity.supportingEvidence.length > 0
                    ? opportunity.supportingEvidence
                        .slice(0, 2)
                        .map((s) => s.skill || s.requirement)
                        .join(" & ")
                    : "profile evidence"}
                </span>{" "}
                matches the role.
                {primaryCap ? (
                  <>
                    {" "}However, the score is capped at{" "}
                    <span className='font-semibold text-[#fb923c]'>{primaryCap.maxScore}%</span> because{" "}
                    <span className='text-[#fb923c] font-medium'>
                      {primaryCap.reason.toLowerCase().replace(/\.$/, "")}
                    </span>.
                  </>
                ) : primaryBlocker ? (
                  <>
                    {" "}However, fit is limited because{" "}
                    <span className='text-[#fb923c] font-medium'>
                      {primaryBlocker.detail.toLowerCase().replace(/\.$/, "")}
                    </span>.
                  </>
                ) : null}
              </p>
            </div>
          ) : null}

          {!compact && fullAccess && opportunity.proofPaths && opportunity.proofPaths.length > 0 ? (
            <div className='space-y-1.5 pt-1'>
              <div className='text-[10px] uppercase tracking-wide text-foreground/45 flex items-center gap-1 font-semibold'>
                <span>Verified graph proof paths</span>
              </div>
              <div className='space-y-1'>
                {opportunity.proofPaths.slice(0, 3).map((path, idx) => (
                  <div
                    key={idx}
                    className='rounded-lg border border-brand/15 bg-brand/[0.04] px-2.5 py-1.5 text-xs text-foreground/80 flex flex-col gap-1'
                  >
                    <div className='flex items-center gap-1.5'>
                      <CheckCircle2 className='h-3.5 w-3.5 text-brand flex-shrink-0' />
                      <span className='font-semibold text-brand-light'>Path Proof</span>
                      <span className='ml-auto inline-flex items-center rounded bg-brand/10 px-1 py-0.2 text-[9px] text-brand-light'>
                        {path.confidence}% confidence
                      </span>
                    </div>
                    <div className='flex flex-wrap items-center gap-1 font-mono text-[10px] bg-foreground/[0.02] p-1.5 rounded border border-foreground/5 overflow-x-auto'>
                      {path.nodes.map((node, nodeIdx) => (
                        <span key={nodeIdx} className='flex items-center gap-1 whitespace-nowrap'>
                          <span className='text-foreground font-medium'>{node}</span>
                          {nodeIdx < path.nodes.length - 1 ? (
                            <span className='text-foreground/35 font-normal'>
                              -[{path.edges[nodeIdx]}]-&gt;
                            </span>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!compact && fullAccess && opportunity.supportingEvidence.length > 0 ? (
            <div className='space-y-1.5 pt-1'>
              <div className='text-[10px] uppercase tracking-wide text-foreground/45 flex items-center gap-1 font-semibold'>
                <span>Verified skill matches</span>
              </div>
              <div className='space-y-1'>
                {opportunity.supportingEvidence.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className='rounded-lg border border-brand/10 bg-brand/[0.03] px-2.5 py-1.5 text-xs text-foreground/80 flex items-start gap-2'
                  >
                    <CheckCircle2 className='mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand' />
                    <div className='min-w-0 flex-1'>
                      <span className='font-semibold text-brand-light'>
                        {item.skill || item.requirement}
                      </span>
                      : <span className='text-foreground/75'>{item.evidenceText}</span>
                      {item.confidence ? (
                        <span className='ml-1.5 inline-flex items-center rounded bg-foreground/10 px-1 py-0.2 text-[9px] text-foreground/50'>
                          {item.confidence}% confidence
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!compact && fullAccess && opportunity.missingSignals.length > 0 ? (
            <div className='space-y-1.5 pt-1'>
              <div className='text-[10px] uppercase tracking-wide text-foreground/45 flex items-center gap-1 font-semibold'>
                <span>Missing signals / weak evidence</span>
              </div>
              <div className='space-y-1'>
                {opportunity.missingSignals.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className='rounded-lg border border-[#fb923c]/10 bg-[#fb923c]/[0.03] px-2.5 py-1.5 text-xs text-foreground/80 flex items-start gap-2'
                  >
                    <AlertTriangle className='mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#fb923c]' />
                    <div className='min-w-0 flex-1'>
                      <span className='font-semibold text-[#fb923c]'>{item.title}</span>:{" "}
                      <span className='text-foreground/75'>{item.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {fullAccess ? (
            <div className='rounded-lg border border-brand/20 bg-brand/10 px-3 py-2 text-xs text-brand'>
              Recommended action: {getRecommendedActionLabel(opportunity.recommendedAction)}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
