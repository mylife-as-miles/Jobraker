"use client"
import { InsightCard } from "./InsightCard"
import { MatchScoreAnalytics } from "./MatchScoreAnalytics"
import { ResumeVersionSuccess } from "./ResumeVersionSuccess"
import { IndustriesCard } from "./IndustriesCard"

type Period = "7d" | "30d" | "90d" | "ytd" | "12m";

export function AnalyticsContent({ period = "30d", data = {} as any }: { period?: Period; data?: any }) {
  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8 p-1 sm:p-2">
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