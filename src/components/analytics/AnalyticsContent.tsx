"use client";

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  CalendarCheck,
  Globe,
  Layers,
} from "lucide-react";
import { InsightCard } from "./InsightCard";
import { IndustriesCard } from "./IndustriesCard";
import { MatchScoreAnalytics } from "./MatchScoreAnalytics";
import { ResumeVersionSuccess } from "./ResumeVersionSuccess";
import { InsightsSection } from "./insights/InsightsSection";
import type { InsightsData } from "../../hooks/insightsComputations";
import { PipelineEarningsProjectionCard } from "./PipelineEarningsProjectionCard";

type Period = "7d" | "30d" | "90d" | "ytd" | "12m";

export function AnalyticsContent({
  period = "30d",
  data = {} as any,
  insights,
}: {
  period?: Period;
  data?: any;
  insights?: InsightsData;
}) {
  const navigate = useNavigate();
  const metrics = data?.metrics || {
    applications: 0,
    interviews: 0,
    jobsFound: 0,
    sources: 0,
    avgMatchScore: 0,
  };
  const comparisons = data?.comparisons || {
    applicationsDeltaPct: 0,
    interviewsDeltaPct: 0,
    jobsFoundDeltaPct: 0,
    avgMatchDelta: 0,
  };

  const postedDays = useMemo(() => {
    switch (period) {
      case "7d":
        return 7;
      case "30d":
        return 30;
      case "90d":
        return 90;
      case "ytd": {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1);
        return Math.max(
          1,
          Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
        );
      }
      case "12m":
        return 365;
      default:
        return 30;
    }
  }, [period]);

  const gotoJobs = () => {
    const params = new URLSearchParams({ posted: String(postedDays) });
    navigate("/dashboard/jobs?" + params.toString());
  };

  const gotoApplications = (status?: string) => {
    const params = new URLSearchParams({ view: "list" });
    if (status) params.set("status", status);
    navigate("/dashboard/application?" + params.toString());
  };

  const Delta = ({ value }: { value: number }) => {
    if (!value)
      return <span className='text-[11px] text-foreground/55'>0%</span>;
    const positive = value > 0;
    return (
      <span
        className={
          "inline-flex items-center gap-1 text-[11px] font-medium " +
          (positive ? "text-brand" : "text-rose-500")
        }
      >
        {positive ? (
          <ArrowUpRight className='h-3 w-3' />
        ) : (
          <ArrowDownRight className='h-3 w-3' />
        )}
        {positive ? "+" : ""}
        {value}%
      </span>
    );
  };

  return (
    <div className='space-y-4 sm:space-y-6 lg:space-y-8'>
      <PipelineEarningsProjectionCard period={period} />

      <div className='grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4'>
        <button
          type='button'
          onClick={() => gotoApplications()}
          className='rounded-2xl border border-foreground/10 duration-75 ease-linear bg-card/85 p-4 text-left transition hover:border-brand/35 hover:bg-card'
        >
          <div className='mb-3 flex items-center justify-between'>
            <span className='text-xs font-medium uppercase tracking-wide text-foreground/55'>
              Applications
            </span>
            <div className='rounded-full bg-brand/10 p-2 text-brand'>
              <Briefcase className='h-4 w-4' />
            </div>
          </div>
          <div className='flex items-end justify-between gap-2'>
            <div className='text-3xl font-bold text-foreground'>
              {metrics.applications}
            </div>
            <Delta value={comparisons.applicationsDeltaPct} />
          </div>
        </button>

        <button
          type='button'
          onClick={() => gotoApplications("Interview")}
          className='rounded-2xl border border-foreground/10 duration-75 ease-linear bg-card/85 p-4 text-left transition hover:border-brand/35 hover:bg-card'
        >
          <div className='mb-3 flex items-center justify-between'>
            <span className='text-xs font-medium uppercase tracking-wide text-foreground/55'>
              Interviews
            </span>
            <div className='rounded-full bg-[#56c2ff]/10 p-2 text-[#56c2ff]'>
              <CalendarCheck className='h-4 w-4' />
            </div>
          </div>
          <div className='flex items-end justify-between gap-2'>
            <div className='text-3xl font-bold text-foreground'>
              {metrics.interviews}
            </div>
            <Delta value={comparisons.interviewsDeltaPct} />
          </div>
        </button>

        <button
          type='button'
          onClick={gotoJobs}
          className='rounded-2xl border border-foreground/10 duration-75 ease-linear bg-card/85 p-4 text-left transition hover:border-brand/35 hover:bg-card'
        >
          <div className='mb-3 flex items-center justify-between'>
            <span className='text-xs font-medium uppercase tracking-wide text-foreground/55'>
              Jobs found
            </span>
            <div className='rounded-full bg-brand/10 p-2 text-brand'>
              <Globe className='h-4 w-4' />
            </div>
          </div>
          <div className='flex items-end justify-between gap-2'>
            <div className='text-3xl font-bold text-foreground'>
              {metrics.jobsFound}
            </div>
            <Delta value={comparisons.jobsFoundDeltaPct} />
          </div>
        </button>

        <div className='rounded-2xl border border-foreground/10 duration-75 ease-linear bg-card/85 p-4'>
          <div className='mb-3 flex items-center justify-between'>
            <span className='text-xs font-medium uppercase tracking-wide text-foreground/55'>
              Sources
            </span>
            <div className='rounded-full bg-foreground/10 p-2 text-foreground/75'>
              <Layers className='h-4 w-4' />
            </div>
          </div>
          <div className='flex items-end justify-between gap-2'>
            <div className='text-3xl font-bold text-foreground'>
              {metrics.sources}
            </div>
            <span className='text-[11px] text-foreground/55'>distinct</span>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 xl:grid-cols-12 xl:gap-6'>
        <div className='xl:col-span-8 min-h-[420px]'>
          <InsightCard period={period} data={data} />
        </div>
        <div className='xl:col-span-4 min-h-[420px]'>
          <IndustriesCard period={period} data={data} />
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6'>
        <div className='min-h-[380px]'>
          <MatchScoreAnalytics period={period} data={data} />
        </div>
        <div className='min-h-[380px]'>
          <ResumeVersionSuccess period={period} data={data} />
        </div>
      </div>

      {/* Deeper Insights Section */}
      {insights && <InsightsSection period={period} insights={insights} />}
    </div>
  );
}
