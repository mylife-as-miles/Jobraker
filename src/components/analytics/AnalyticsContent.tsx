"use client"
import { InsightCard } from "./InsightCard"
import { MatchScoreAnalytics } from "./MatchScoreAnalytics"
import { ResumeVersionSuccess } from "./ResumeVersionSuccess"
import { IndustriesCard } from "./IndustriesCard"
import { Briefcase, CalendarCheck, Globe, Layers, ArrowDownRight, ArrowUpRight } from "lucide-react"

type Period = "7d" | "30d" | "90d" | "ytd" | "12m";

export function AnalyticsContent({ period = "30d", data = {} as any }: { period?: Period; data?: any }) {
  const metrics = data?.metrics || { applications: 0, interviews: 0, jobsFound: 0, sources: 0, avgMatchScore: 0 }
  const comparisons = data?.comparisons || { applicationsDeltaPct: 0, interviewsDeltaPct: 0, jobsFoundDeltaPct: 0, avgMatchDelta: 0 }

  const Delta = ({ value }: { value: number }) => {
    if (!value) return <span className="text-[11px] text-white/60">0%</span>
    const positive = value > 0
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
        {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {positive ? '+' : ''}{value}{Math.abs(value) <= 100 ? '%' : ''}
      </span>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8 p-1 sm:p-2">
      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <div className="rounded-xl border border-white/15 bg-white/[0.04] p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/70">Applications</span>
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center"><Briefcase className="w-4 h-4 text-white/80" /></div>
          </div>
          <div className="flex items-end justify-between">
            <div className="text-2xl sm:text-3xl font-bold text-white">{metrics.applications}</div>
            <Delta value={comparisons.applicationsDeltaPct} />
          </div>
        </div>
        <div className="rounded-xl border border-white/15 bg-white/[0.04] p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/70">Interviews</span>
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center"><CalendarCheck className="w-4 h-4 text-white/80" /></div>
          </div>
          <div className="flex items-end justify-between">
            <div className="text-2xl sm:text-3xl font-bold text-white">{metrics.interviews}</div>
            <Delta value={comparisons.interviewsDeltaPct} />
          </div>
        </div>
        <div className="rounded-xl border border-white/15 bg-white/[0.04] p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/70">Jobs found</span>
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center"><Globe className="w-4 h-4 text-white/80" /></div>
          </div>
          <div className="flex items-end justify-between">
            <div className="text-2xl sm:text-3xl font-bold text-white">{metrics.jobsFound}</div>
            <Delta value={comparisons.jobsFoundDeltaPct} />
          </div>
        </div>
        <div className="rounded-xl border border-white/15 bg-white/[0.04] p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/70">Sources</span>
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center"><Layers className="w-4 h-4 text-white/80" /></div>
          </div>
          <div className="flex items-end justify-between">
            <div className="text-2xl sm:text-3xl font-bold text-white">{metrics.sources}</div>
            <span className="text-[11px] text-white/60">distinct</span>
          </div>
        </div>
      </div>

      {/* Top row - Insight and Industries cards with consistent heights */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4 lg:gap-6">
        {/* Insight Card - Takes 8 columns on xl screens, full width on smaller screens */}
        <div className="xl:col-span-8 min-h-[350px] sm:min-h-[400px] lg:min-h-[450px] xl:min-h-[500px]">
          <InsightCard period={period} data={data} />
        </div>
        
        {/* Industries Card - Takes 4 columns on xl screens, full width on smaller screens */}
        <div className="xl:col-span-4 min-h-[350px] sm:min-h-[400px] lg:min-h-[450px] xl:min-h-[500px]">
          <IndustriesCard period={period} data={data} />
        </div>
      </div>

      {/* Bottom row - Match Score and Resume Success with consistent heights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
        <div className="min-h-[300px] sm:min-h-[350px] lg:min-h-[400px]">
          <MatchScoreAnalytics period={period} data={data} />
        </div>
        <div className="min-h-[300px] sm:min-h-[350px] lg:min-h-[400px]">
          <ResumeVersionSuccess period={period} data={data} />
        </div>
      </div>
    </div>
  )
}