"use client";

import { LabelList, Pie, PieChart, ResponsiveContainer } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  if (normalized.includes("role") || normalized.includes("focus")) return "#1dff00"; // Applied green
  if (normalized.includes("keyword") || normalized.includes("match")) return "#56c2ff"; // Interview blue
  if (normalized.includes("goal") || normalized.includes("profile")) return "#ffd700"; // Offer gold
  if (normalized.includes("location") || normalized.includes("alignment")) return "#ff6b6b"; // Rejected red
  return "#1dff00"; // Default green
};

export function MatchScorePieChart({ score, summary, breakdown }: MatchScorePieChartProps) {
  const chartData = breakdown?.map((item) => ({
    label: item.label,
    score: Math.round(item.componentScore), // Round to whole number
    fill: getCategoryColor(item.label),
  })) || [];

  const hasBreakdown = chartData.length > 0;

  return (
    <Card className="relative overflow-hidden border border-[#1dff00]/20 bg-gradient-to-br from-[#030303] via-[#050505] to-[#0a160a]">
      <span className="pointer-events-none absolute -top-24 -right-12 h-56 w-56 rounded-full bg-[#1dff00]/20 blur-3xl opacity-60" />
      
      <CardHeader className="relative items-center pb-2">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#1dff00]" />
            <CardTitle className="text-lg text-white/90">AI Match Analysis</CardTitle>
          </div>
          <Badge
            variant="outline"
            className={
              score >= 70
                ? "text-[#1dff00] bg-[#1dff00]/10 border-none"
                : score >= 50
                ? "text-[#ffd78b] bg-[#ffd78b]/10 border-none"
                : "text-[#ff8b8b] bg-[#ff8b8b]/10 border-none"
            }
          >
            <TrendingUp className="h-4 w-4" />
            <span>{score}%</span>
          </Badge>
        </div>
        {summary && (
          <p className="mt-2 w-full text-left text-sm text-white/60">{summary}</p>
        )}
      </CardHeader>

      <CardContent className="flex-1 pb-4">
        {hasBreakdown ? (
          <>
            <div className="w-full h-[280px]">
              <ChartContainer
                config={chartConfig}
                data={chartData}
                className="w-full h-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <ChartTooltip
                      content={<ChartTooltipContent hideLabel />}
                    />
                    <Pie
                      data={chartData}
                      innerRadius={30}
                      outerRadius={80}
                      dataKey="score"
                      nameKey="label"
                      cornerRadius={8}
                      paddingAngle={4}
                    >
                      <LabelList
                        dataKey="score"
                        stroke="none"
                        fontSize={14}
                        fontWeight={600}
                        fill="#000000"
                        formatter={(value: number) => `${value}%`}
                      />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>

            <div className="mt-4 space-y-2">
              {breakdown?.map((item, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-white/10 bg-white/5 p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: getCategoryColor(item.label) }}
                      />
                      <span className="text-sm font-medium text-white/90">{item.label}</span>
                    </div>
                    <span className="text-sm font-semibold text-[#1dff00]">{item.componentScore}%</span>
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex h-[250px] items-center justify-center">
            <div className="text-center space-y-2">
              <div className="text-6xl font-bold text-[#1dff00]">{Math.round(score)}%</div>
              <p className="text-sm text-white/50">Overall Match Score</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
