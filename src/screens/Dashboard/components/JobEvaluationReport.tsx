import {
  AlertTriangle,
  BookmarkPlus,
  Briefcase,
  CheckCircle2,
  Compass,
  DollarSign,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { useState } from "react";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import Modal from "../../../components/ui/modal";
import type { JobEvaluationReport as JobEvaluationReportData } from "../../../services/jobs/jobEvaluation";

interface JobEvaluationReportProps {
  evaluation: JobEvaluationReportData | null;
  loading?: boolean;
  savedStoryTitles?: string[];
  onSaveStory?: (
    story: JobEvaluationReportData["interview_stories"][number],
  ) => Promise<void> | void;
}

const decisionTheme: Record<
  JobEvaluationReportData["canonical_decision"],
  { label: string; className: string }
> = {
  strong_yes: {
    label: "Strong yes",
    className: "border-brand/40 bg-brand/10 text-brand",
  },
  draft_first: {
    label: "Draft first",
    className: "border-brand/35 bg-brand/10 text-brand",
  },
  risky: {
    label: "Risky",
    className: "border-brand/35 bg-brand/10 text-brand",
  },
  no_go: {
    label: "No go",
    className: "border-brand/35 bg-brand/10 text-brand",
  },
};

const ListBlock = ({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) => (
  <div className='space-y-3'>
    <div className='text-[11px] uppercase tracking-[0.28em] text-foreground/45'>
      {title}
    </div>
    {items.length > 0 ? (
      <ul className='space-y-2'>
        {items.map((item, index) => (
          <li
            key={`${title}-${index}`}
            className='rounded-xl border border-foreground/10 bg-foreground/5 px-3 py-2 text-sm text-foreground/80'
          >
            {item}
          </li>
        ))}
      </ul>
    ) : (
      <div className='rounded-xl border border-dashed border-foreground/12 bg-foreground/[0.02] px-3 py-3 text-sm text-foreground/45'>
        {empty}
      </div>
    )}
  </div>
);

const getCoverageNumber = (evaluation: JobEvaluationReportData): number => {
  const value = evaluation.ats_keyword_coverage?.coverage_percent;
  return typeof value === "number" ? Math.max(0, Math.min(100, Math.round(value))) : 0;
};

const getCoverageList = (
  evaluation: JobEvaluationReportData,
  key: "covered_terms" | "missing_terms" | "incorporated_terms",
): string[] => {
  const value = evaluation.ats_keyword_coverage?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
};

const scoreBreakdownEntries = (evaluation: JobEvaluationReportData) =>
  Object.entries(evaluation.score_breakdown ?? {})
    .filter(([, value]) => typeof value === "number")
    .map(([key, value]) => ({
      label: key.replace(/_/g, " "),
      value: Math.max(0, Math.min(100, Math.round(value as number))),
    }));

export function JobEvaluationReport({
  evaluation,
  loading = false,
  savedStoryTitles = [],
  onSaveStory,
}: JobEvaluationReportProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (loading) {
    return (
      <Card className='border border-brand/20 bg-card/80 p-6'>
        <div className='space-y-4 animate-pulse'>
          <div className='h-5 w-48 rounded bg-foreground/10' />
          <div className='grid gap-3 md:grid-cols-3'>
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className='h-20 rounded-xl border border-foreground/10 bg-foreground/5'
              />
            ))}
          </div>
          <div className='grid gap-4 lg:grid-cols-2'>
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className='h-36 rounded-xl border border-foreground/10 bg-foreground/5'
              />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (!evaluation) {
    return null;
  }

  const theme = decisionTheme[evaluation.canonical_decision];
  const breakdown = scoreBreakdownEntries(evaluation);
  const coveragePercent = getCoverageNumber(evaluation);
  const coveredTerms = getCoverageList(evaluation, "covered_terms");
  const missingTerms = getCoverageList(evaluation, "missing_terms");
  const incorporatedTerms = getCoverageList(evaluation, "incorporated_terms");

  return (
    <>
      <Card className='border border-brand/20 bg-card/80 p-5 space-y-5'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
          <div className='space-y-3 flex-1 min-w-0'>
            <div className='inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-brand/75'>
              <Sparkles className='h-3.5 w-3.5' />
              Evaluation Report
            </div>
            <div className='flex flex-wrap items-center gap-3'>
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${theme.className}`}
              >
                <ShieldCheck className='h-3.5 w-3.5' />
                {theme.label}
              </span>
              <span className='rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 text-xs font-medium text-foreground/70'>
                Archetype: {evaluation.archetype}
              </span>
            </div>
            <p className='max-w-2xl text-sm text-foreground/55'>
              Full fit evidence, blockers, ATS keywords, compensation notes,
              tailoring guidance, and interview stories are available in the
              detailed report.
            </p>
          </div>
          <div className='grid w-full gap-3 sm:grid-cols-3 shrink-0 lg:w-[380px]'>
            <div className='rounded-2xl border border-foreground/10 bg-foreground/5 px-4 py-4 text-center'>
              <div className='text-[11px] uppercase tracking-wide text-foreground/40'>
                Confidence
              </div>
              <div className='mt-2 text-2xl font-semibold text-brand'>
                {evaluation.confidence_score}%
              </div>
            </div>
            <div className='rounded-2xl border border-foreground/10 bg-foreground/5 px-4 py-4 text-center'>
              <div className='text-[11px] uppercase tracking-wide text-foreground/40'>
                Blockers
              </div>
              <div className='mt-2 text-2xl font-semibold text-foreground'>
                {evaluation.blockers.length}
              </div>
            </div>
            <div className='rounded-2xl border border-foreground/10 bg-foreground/5 px-4 py-4 text-center'>
              <div className='text-[11px] uppercase tracking-wide text-foreground/40'>
                Stories
              </div>
              <div className='mt-2 text-2xl font-semibold text-foreground'>
                {evaluation.interview_stories.length}
              </div>
            </div>
          </div>
        </div>

        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex flex-wrap gap-2 text-xs text-foreground/55'>
            {coveragePercent > 0 ? (
              <span className='rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1'>
                ATS coverage {coveragePercent}%
              </span>
            ) : null}
            {breakdown.length > 0 ? (
              <span className='rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1'>
                {breakdown.length} score factors
              </span>
            ) : null}
            {evaluation.missing_requirements.length > 0 ? (
              <span className='rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1'>
                {evaluation.missing_requirements.length} missing requirement
                {evaluation.missing_requirements.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
          <Button
            type='button'
            className='border border-brand/40 bg-brand/10 text-brand hover:bg-brand/15'
            onClick={() => setDetailsOpen(true)}
          >
            View full report
          </Button>
        </div>
      </Card>

      <Modal
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title='Evaluation report'
        size='xl'
      >
        <div className='space-y-6'>
          <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
            <div className='space-y-3 flex-1 min-w-0'>
              <div className='inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-brand/75'>
                <Sparkles className='h-3.5 w-3.5' />
                Evaluation Report
              </div>
              <div className='flex flex-wrap items-center gap-3'>
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${theme.className}`}
                >
                  <ShieldCheck className='h-3.5 w-3.5' />
                  {theme.label}
                </span>
                <span className='rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 text-xs font-medium text-foreground/70'>
                  Archetype: {evaluation.archetype}
                </span>
              </div>
            </div>
            <div className='grid w-full gap-3 sm:grid-cols-3 shrink-0 lg:w-[380px]'>
              <div className='rounded-2xl border border-foreground/10 bg-foreground/5 px-4 py-4 text-center'>
                <div className='text-[11px] uppercase tracking-wide text-foreground/40'>
                  Confidence
                </div>
                <div className='mt-2 text-2xl font-semibold text-brand'>
                  {evaluation.confidence_score}%
                </div>
              </div>
              <div className='rounded-2xl border border-foreground/10 bg-foreground/5 px-4 py-4 text-center'>
                <div className='text-[11px] uppercase tracking-wide text-foreground/40'>
                  Blockers
                </div>
                <div className='mt-2 text-2xl font-semibold text-foreground'>
                  {evaluation.blockers.length}
                </div>
              </div>
              <div className='rounded-2xl border border-foreground/10 bg-foreground/5 px-4 py-4 text-center'>
                <div className='text-[11px] uppercase tracking-wide text-foreground/40'>
                  Stories
                </div>
                <div className='mt-2 text-2xl font-semibold text-foreground'>
                  {evaluation.interview_stories.length}
                </div>
              </div>
            </div>
          </div>

      <div className='grid gap-4 lg:grid-cols-2'>
        {breakdown.length > 0 ? (
          <div className='rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 space-y-4'>
            <div className='inline-flex items-center gap-2 text-sm font-medium text-foreground/80'>
              <Target className='h-4 w-4 text-brand' />
              Explainable score breakdown
            </div>
            <div className='grid gap-3 sm:grid-cols-2'>
              {breakdown.map((item) => (
                <div
                  key={item.label}
                  className='rounded-xl border border-foreground/10 bg-foreground/5 p-3'
                >
                  <div className='flex items-center justify-between gap-3 text-xs text-foreground/55'>
                    <span className='capitalize'>{item.label}</span>
                    <span className='font-semibold text-foreground'>{item.value}%</span>
                  </div>
                  <div className='mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10'>
                    <div
                      className='h-full rounded-full bg-brand'
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {coveragePercent > 0 || coveredTerms.length > 0 || missingTerms.length > 0 ? (
          <div className='rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 space-y-4'>
            <div className='inline-flex items-center gap-2 text-sm font-medium text-foreground/80'>
              <CheckCircle2 className='h-4 w-4 text-brand' />
              ATS keyword coverage
            </div>
            <div className='rounded-xl border border-foreground/10 bg-foreground/5 p-4'>
              <div className='flex items-center justify-between text-xs text-foreground/55'>
                <span>Coverage</span>
                <span className='text-lg font-semibold text-brand'>{coveragePercent}%</span>
              </div>
              <div className='mt-2 h-2 overflow-hidden rounded-full bg-foreground/10'>
                <div
                  className='h-full rounded-full bg-brand'
                  style={{ width: `${coveragePercent}%` }}
                />
              </div>
            </div>
            <ListBlock
              title='Covered terms'
              items={coveredTerms.slice(0, 10)}
              empty='No covered ATS terms were detected yet.'
            />
            <ListBlock
              title='Missing terms'
              items={missingTerms.slice(0, 10)}
              empty='No missing ATS terms were detected.'
            />
            {incorporatedTerms.length > 0 ? (
              <ListBlock
                title='Incorporated into drafts'
                items={incorporatedTerms.slice(0, 10)}
                empty='No incorporated terms were recorded.'
              />
            ) : null}
          </div>
        ) : null}

        <div className='rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 space-y-4'>
          <div className='inline-flex items-center gap-2 text-sm font-medium text-foreground/80'>
            <Target className='h-4 w-4 text-brand' />
            Exact-fit evidence
          </div>
          <ListBlock
            title='Why this role fits'
            items={evaluation.exact_fit_evidence}
            empty='No exact-fit evidence was captured yet.'
          />
          <ListBlock
            title='Missing requirements'
            items={evaluation.missing_requirements}
            empty='No hard requirements were flagged as missing.'
          />
        </div>

        <div className='rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 space-y-4'>
          <div className='inline-flex items-center gap-2 text-sm font-medium text-foreground/80'>
            <AlertTriangle className='h-4 w-4 text-brand' />
            Risk and blockers
          </div>
          <ListBlock
            title='Blockers'
            items={evaluation.blockers}
            empty='No blockers were identified.'
          />
          <ListBlock
            title='Tailoring suggestions'
            items={evaluation.tailoring_suggestions}
            empty='No tailoring suggestions were captured.'
          />
        </div>

        <div className='rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 space-y-4'>
          <div className='inline-flex items-center gap-2 text-sm font-medium text-foreground/80'>
            <DollarSign className='h-4 w-4 text-brand' />
            Compensation and market read
          </div>
          <div className='rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3 text-sm text-foreground/80'>
            {evaluation.compensation.summary}
          </div>
          <ListBlock
            title='Comp notes'
            items={evaluation.compensation.notes}
            empty='No compensation notes were generated.'
          />
          <ListBlock
            title='Signals'
            items={evaluation.compensation.signals}
            empty='No compensation signals were captured.'
          />
        </div>

        <div className='rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 space-y-4'>
          <div className='inline-flex items-center gap-2 text-sm font-medium text-foreground/80'>
            <Compass className='h-4 w-4 text-brand' />
            Personalization plan
          </div>
          <div className='rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3 text-sm text-foreground/80'>
            {evaluation.personalization_plan.narrative}
          </div>
          <ListBlock
            title='Emphasis points'
            items={evaluation.personalization_plan.emphasis_points}
            empty='No emphasis points were generated.'
          />
          <ListBlock
            title='ATS keywords'
            items={evaluation.personalization_plan.ats_keywords}
            empty='No ATS keywords were generated.'
          />
          <ListBlock
            title='Proof points to highlight'
            items={evaluation.personalization_plan.proof_points_to_highlight}
            empty='No proof-point guidance was generated.'
          />
          <ListBlock
            title='Risk mitigation'
            items={evaluation.personalization_plan.risk_mitigation}
            empty='No mitigation guidance was captured.'
          />
        </div>
      </div>

      <div className='rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 space-y-4'>
        <div className='inline-flex items-center gap-2 text-sm font-medium text-foreground/80'>
          <Briefcase className='h-4 w-4 text-brand' />
          Interview story bank
        </div>
        {evaluation.interview_stories.length > 0 ? (
          <div className='grid gap-3'>
            {evaluation.interview_stories.map((story, index) => {
              const alreadySaved = savedStoryTitles.some(
                (title) => title.toLowerCase() === story.title.toLowerCase(),
              );
              return (
                <div
                  key={`${story.title}-${index}`}
                  className='rounded-2xl border border-foreground/10 bg-foreground/5 p-4 space-y-3'
                >
                  <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                    <div className='space-y-1'>
                      <div className='text-sm font-semibold text-foreground'>
                        {story.title}
                      </div>
                      <p className='text-sm text-foreground/70'>
                        {story.reason}
                      </p>
                    </div>
                    {onSaveStory ? (
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        className='border-brand/30 text-brand hover:bg-brand/10'
                        disabled={alreadySaved}
                        onClick={() => void onSaveStory(story)}
                      >
                        {alreadySaved ? (
                          <>
                            <CheckCircle2 className='mr-2 h-4 w-4' />
                            Saved
                          </>
                        ) : (
                          <>
                            <BookmarkPlus className='mr-2 h-4 w-4' />
                            Save to bank
                          </>
                        )}
                      </Button>
                    ) : null}
                  </div>
                  <ListBlock
                    title='Talking points'
                    items={story.talking_points}
                    empty='No talking points were generated for this story.'
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className='rounded-xl border border-dashed border-foreground/12 bg-foreground/[0.02] px-4 py-4 text-sm text-foreground/45'>
            No interview stories were generated yet.
          </div>
        )}
      </div>

      {evaluation.candidate_memory ? (
        <div className='rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 space-y-3'>
          <div className='inline-flex items-center gap-2 text-sm font-medium text-foreground/80'>
            <Sparkles className='h-4 w-4 text-brand' />
            Candidate memory used
          </div>
          <div className='whitespace-pre-wrap rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3 text-sm text-foreground/70'>
            {evaluation.candidate_memory}
          </div>
        </div>
      ) : null}
        </div>
      </Modal>
    </>
  );
}
