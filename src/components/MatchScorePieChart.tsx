"use client";

import { LabelList, Pie, PieChart } from "recharts";
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
  if (normalized.includes("role") || normalized.includes("focus")) return "var(--chart-1)";
  if (normalized.includes("keyword") || normalized.includes("match")) return "var(--chart-2)";
  if (normalized.includes("goal") || normalized.includes("profile")) return "var(--chart-3)";
  if (normalized.includes("location") || normalized.includes("alignment")) return "var(--chart-4)";
  return "var(--chart-5)";
};

export function MatchScorePieChart({ score, summary, breakdown }: MatchScorePieChartProps) {
  const chartData = breakdown?.map((item) => ({
    label: item.label,
    score: item.componentScore,
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
            className={`text-${score >= 70 ? 'green' : score >= 50 ? 'yellow' : 'red'}-500 bg-${score >= 70 ? 'green' : score >= 50 ? 'yellow' : 'red'}-500/10 border-none`}
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
            <ChartContainer
              config={chartConfig}
              data={chartData}
              className="[&_.recharts-text]:fill-background mx-auto aspect-square max-h-[250px]"
            >
              <PieChart>
                <ChartTooltip
                  content={<ChartTooltipContent hideLabel />}
                />
                <Pie
                  data={chartData}
                  innerRadius={30}
                  dataKey="score"
                  radius={10}
                  cornerRadius={8}
                  paddingAngle={4}
                >
                  <LabelList
                    dataKey="score"
                    stroke="none"
                    fontSize={12}
                    fontWeight={500}
                    fill="currentColor"
                    formatter={(value: number) => `${value}%`}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>

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
              <div className="text-6xl font-bold text-[#1dff00]">{score}%</div>
              <p className="text-sm text-white/50">Overall Match Score</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
