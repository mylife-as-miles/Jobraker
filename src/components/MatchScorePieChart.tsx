"use client";

import { LabelList, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Sparkles } from "lucide-react";

interface MatchScoreBreakdown {
  label: string;
  componentScore: number;
  contribution: number;
  weight: number;
  detail: string;
  matches?: string[];
}

interface MatchScorePieChartProps {
  score: number;
  summary?: string;
  breakdown?: MatchScoreBreakdown[];
}

const chartConfig = {
  score: {
    label: "Score",
  },
  skills: {
    label: "Skills",
    color: "var(--chart-1)",
  },
  experience: {
    label: "Experience",
    color: "var(--chart-2)",
  },
  location: {
    label: "Location",
    color: "var(--chart-3)",
  },
  salary: {
    label: "Salary",
    color: "var(--chart-4)",
  },
  culture: {
    label: "Culture",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

const getCategoryColor = (label: string) => {
  const normalized = label.toLowerCase();
  if (normalized.includes("role") || normalized.includes("focus"))
    return "#1dff00";
  if (normalized.includes("keyword") || normalized.includes("match"))
    return "#56c2ff";
  if (normalized.includes("goal") || normalized.includes("profile"))
    return "#1dff00";
  if (normalized.includes("location") || normalized.includes("alignment"))
    return "#1dff00";
  return "#1dff00";
};

export function MatchScorePieChart({
  score,
  summary,
  breakdown,
}: MatchScorePieChartProps) {
  const displayScore = Math.max(0, Math.min(100, Math.round(score)));
  const normalizedBreakdown = (() => {
    const items =
      breakdown?.map((item, index) => {
        const weight = Number.isFinite(item.weight) ? Math.max(0, item.weight) : 0;
        const componentScore = Number.isFinite(item.componentScore)
          ? Math.max(0, Math.min(100, item.componentScore))
          : 0;
        const rawContribution = Number.isFinite(item.contribution)
          ? Math.max(0, item.contribution)
          : componentScore * weight;
        return { ...item, componentScore, weight, rawContribution, index };
      }) || [];

    const totalContribution = items.reduce(
      (total, item) => total + item.rawContribution,
      0,
    );
    if (items.length === 0 || totalContribution <= 0 || displayScore <= 0) {
      return items.map((item) => ({ ...item, contributionPoints: 0 }));
    }

    const scaled = items.map((item) => {
      const exact = (item.rawContribution / totalContribution) * displayScore;
      const points = Math.floor(exact);
      return { ...item, contributionPoints: points, remainder: exact - points };
    });
    let remaining =
      displayScore -
      scaled.reduce((total, item) => total + item.contributionPoints, 0);
    return scaled
      .sort((a, b) => b.remainder - a.remainder)
      .map((item) => {
        const extra = remaining > 0 ? 1 : 0;
        remaining -= extra;
        return {
          ...item,
          contributionPoints: item.contributionPoints + extra,
        };
      })
      .sort((a, b) => a.index - b.index);
  })();
  const chartData = normalizedBreakdown
    .filter((item) => item.contributionPoints > 0)
    .map((item) => ({
      label: item.label,
      score: item.contributionPoints,
      fill: getCategoryColor(item.label),
    }));

  const hasBreakdown = chartData.length > 0;

  return (
    <Card className='relative overflow-hidden border border-brand/20 bg-gradient-to-br from-background via-background to-background'>
      <span className='pointer-events-none absolute -top-24 -right-12 h-56 w-56 rounded-full bg-brand/20 blur-3xl opacity-60' />

      <CardHeader className='relative items-center pb-2'>
        <div className='flex w-full items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Sparkles className='h-4 w-4 text-brand' />
            <CardTitle className='text-lg text-foreground/90'>
              AI Match Analysis
            </CardTitle>
          </div>
          <Badge
            variant='outline'
            className={
              displayScore >= 70
                ? "text-brand bg-brand/10 border-none"
                : displayScore >= 50
                  ? "text-brand bg-brand/10 border-none"
                  : "text-brand bg-brand/10 border-none"
            }
          >
            <TrendingUp className='h-4 w-4' />
            <span>{displayScore}%</span>
          </Badge>
        </div>
        {summary && (
          <p className='mt-2 w-full text-left text-sm text-foreground/60'>
            {summary}
          </p>
        )}
      </CardHeader>

      <CardContent className='flex-1 pb-4'>
        {hasBreakdown ? (
          <>
            <div className='w-full h-[280px]'>
              <ChartContainer
                config={chartConfig}
                data={chartData}
                className='w-full h-full'
              >
                <ResponsiveContainer width='100%' height='100%'>
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Pie
                      data={chartData}
                      innerRadius={30}
                      outerRadius={80}
                      dataKey='score'
                      nameKey='label'
                      cornerRadius={8}
                      paddingAngle={4}
                    >
                      <LabelList
                        dataKey='score'
                        stroke='none'
                        fontSize={14}
                        fontWeight={600}
                        fill='#000000'
                        formatter={(value: number) => `${value} pts`}
                      />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>

            <div className='mt-4 space-y-2'>
              {normalizedBreakdown.map((item, index) => (
                <div
                  key={index}
                  className='rounded-lg border border-foreground/10 bg-foreground/5 p-3'
                >
                  <div className='flex items-center justify-between mb-1'>
                    <div className='flex items-center gap-2'>
                      <span
                        className='h-3 w-3 rounded-full'
                        style={{
                          backgroundColor: getCategoryColor(item.label),
                        }}
                      />
                      <span className='text-sm font-medium text-foreground/90'>
                        {item.label}
                      </span>
                    </div>
                    <span className='text-sm font-semibold text-brand'>
                      {item.contributionPoints} pts
                    </span>
                  </div>
                  <div className='mb-1 text-[11px] text-foreground/45'>
                    {Math.round(item.componentScore)}% component score,{" "}
                    {Math.round(item.weight * 100)}% weight
                  </div>
                  <p className='text-xs text-foreground/60 leading-relaxed'>
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className='flex h-[250px] items-center justify-center'>
            <div className='text-center space-y-2'>
              <div className='text-6xl font-bold text-brand'>
                {displayScore}%
              </div>
              <p className='text-sm text-foreground/50'>Overall Match Score</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
