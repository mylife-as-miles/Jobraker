"use client";

import { Lightbulb } from "lucide-react";
import type { InsightsData } from "../../../hooks/insightsComputations";
import { ScoreTrendCard } from "./ScoreTrendCard";
import { ScoreDistributionCard } from "./ScoreDistributionCard";
import { ApplicationTimelineCard } from "./ApplicationTimelineCard";
import { WeeklyDigestCard } from "./WeeklyDigestCard";
import { SkillGapCard } from "./SkillGapCard";
import { JourneySummaryCard } from "./JourneySummaryCard";

type Period = "7d" | "30d" | "90d" | "ytd" | "12m";

interface InsightsSectionProps {
  period: Period;
  insights: InsightsData;
}

export function InsightsSection({ period, insights }: InsightsSectionProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-foreground/5 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-foreground/70">
          <Lightbulb className="h-3.5 w-3.5" />
          Deeper Insights
        </div>
      </div>

      {/* Row 1: Score Trend (wide) + Score Distribution */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:gap-6">
        <div className="xl:col-span-8 min-h-[420px]">
          <ScoreTrendCard
            scoreTrend={insights.scoreTrend}
            overallAvgScore={insights.overallAvgScore}
            scoreDelta={insights.scoreDelta}
            period={period}
            loading={insights.loading}
          />
        </div>
        <div className="xl:col-span-4 min-h-[420px]">
          <ScoreDistributionCard
            scoreDistribution={insights.scoreDistribution}
            period={period}
            loading={insights.loading}
          />
        </div>
      </div>

      {/* Row 2: Application Timeline + Weekly Digest */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <div className="min-h-[380px]">
          <ApplicationTimelineCard
            timeline={insights.timeline}
            period={period}
            loading={insights.loading}
          />
        </div>
        <div className="min-h-[380px]">
          <WeeklyDigestCard
            weeklyDigest={insights.weeklyDigest}
            loading={insights.loading}
          />
        </div>
      </div>

      {/* Row 3: Skill Gap + Journey Summary */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <div className="min-h-[320px]">
          <SkillGapCard
            skillGaps={insights.skillGaps}
            hasResume={insights.hasResume}
            loading={insights.loading}
          />
        </div>
        <div className="min-h-[320px]">
          <JourneySummaryCard
            narrative={insights.journeyNarrative}
            period={period}
            loading={insights.loading}
          />
        </div>
      </div>
    </div>
  );
}
