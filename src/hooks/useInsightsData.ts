import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabaseClient";
import type { useAnalyticsData } from "./useAnalyticsData";
import {
  computeScoreTrend,
  computeOverallAvgAndDelta,
  computeScoreDistribution,
  computeTimeline,
  computeWeeklyDigest,
  computeSkillGaps,
  generateJourneyNarrative,
} from "./insightsComputations";
import type { InsightsData } from "./insightsComputations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Period = "7d" | "30d" | "90d" | "ytd" | "12m";
type Granularity = "day" | "week" | "month";

type AnalyticsData = ReturnType<typeof useAnalyticsData>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute the date range for a given period. */
function computeRange(period: Period): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  switch (period) {
    case "7d":
      start.setDate(end.getDate() - 6);
      break;
    case "30d":
      start.setDate(end.getDate() - 29);
      break;
    case "90d":
      start.setDate(end.getDate() - 89);
      break;
    case "ytd":
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
    case "12m":
      start.setFullYear(end.getFullYear() - 1);
      break;
    default:
      start.setDate(end.getDate() - 29);
  }
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Compute the previous period range (same duration, immediately before). */
function computePreviousRange(cur: {
  start: Date;
  end: Date;
}): { start: Date; end: Date } {
  const rangeMs = cur.end.getTime() - cur.start.getTime();
  const prevEnd = new Date(cur.start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - rangeMs);
  prevStart.setHours(0, 0, 0, 0);
  prevEnd.setHours(23, 59, 59, 999);
  return { start: prevStart, end: prevEnd };
}

/** Clamp a score to 0–100 range. */
function clampScore(score: number): number {
  const value = Number(score);
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Extract skill keywords from a summary string and/or job title.
 * Splits on commas, semicolons, " and ", " or ", pipes, and newlines.
 * Returns trimmed, non-empty tokens.
 */
function extractSkillKeywords(
  summary: string | null | undefined,
  title: string | null | undefined,
): string[] {
  const keywords: string[] = [];
  const delimiters = /[,;|\n]+|\s+and\s+|\s+or\s+/gi;

  if (summary && typeof summary === "string") {
    const parts = summary.split(delimiters);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.length > 0 && trimmed.length < 60) {
        keywords.push(trimmed);
      }
    }
  }

  if (title && typeof title === "string") {
    // Extract meaningful words from the title (skip very short/common words)
    const titleWords = title.split(/[\s/,;|()-]+/);
    for (const word of titleWords) {
      const trimmed = word.trim();
      if (trimmed.length > 2) {
        keywords.push(trimmed);
      }
    }
  }

  return keywords;
}

// ---------------------------------------------------------------------------
// Empty state constant
// ---------------------------------------------------------------------------

const EMPTY_INSIGHTS: InsightsData = {
  scoreTrend: [],
  overallAvgScore: 0,
  scoreDelta: 0,
  scoreDistribution: [],
  timeline: [],
  weeklyDigest: null,
  skillGaps: [],
  hasResume: false,
  journeyNarrative: "",
  loading: false,
  error: null,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useInsightsData(
  period: Period,
  granularity: Granularity,
  analyticsData: AnalyticsData,
  options?: { enabled?: boolean },
): InsightsData {
  const enabled = options?.enabled ?? true;
  const supabase = useMemo(() => createClient(), []);

  const [insightsState, setInsightsState] = useState<InsightsData>({
    ...EMPTY_INSIGHTS,
    loading: true,
  });

  // Compute date ranges
  const range = useMemo(() => computeRange(period), [period]);
  const prevRange = useMemo(
    () => computePreviousRange(range),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [range.start.getTime(), range.end.getTime()],
  );

  useEffect(() => {
    if (!enabled) {
      setInsightsState({ ...EMPTY_INSIGHTS, loading: false, error: null });
      return;
    }

    // If analyticsData is still loading, reflect that
    if (analyticsData.loading) {
      setInsightsState((prev) => ({ ...prev, loading: true, error: null }));
      return;
    }

    // If analyticsData has an error, propagate it
    if (analyticsData.error) {
      setInsightsState((prev) => ({
        ...prev,
        loading: false,
        error: analyticsData.error,
      }));
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function fetchAndCompute() {
      setInsightsState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        // 1. Get authenticated user
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;

        if (!user) {
          setInsightsState({ ...EMPTY_INSIGHTS, loading: false });
          return;
        }

        const startIso = range.start.toISOString();
        const endIso = range.end.toISOString();
        const prevStartIso = prevRange.start.toISOString();
        const prevEndIso = prevRange.end.toISOString();

        // 2. Fetch applications, jobs, and parsed_resumes in parallel
        const [appsResult, jobsResult, resumeResult] = await Promise.all([
          supabase
            .from("applications")
            .select(
              "id, applied_date, created_at, status, updated_at, match_score",
            )
            .eq("user_id", user.id)
            .order("created_at", { ascending: true }),
          supabase
            .from("jobs")
            .select(
              "id, created_at, source_type, title, company, raw_data",
            )
            .eq("user_id", user.id)
            .order("created_at", { ascending: true }),
          supabase
            .from("parsed_resumes")
            .select("skills")
            .eq("user_id", user.id)
            .limit(1),
        ]);

        if (cancelled) return;

        // Handle resume query error gracefully — still compute other insights
        let resumeError: string | null = null;
        let userSkills: string[] = [];
        let hasResume = false;

        if (resumeResult.error) {
          resumeError = `Resume data unavailable: ${resumeResult.error.message}`;
        } else if (
          resumeResult.data &&
          resumeResult.data.length > 0
        ) {
          hasResume = true;
          const skills = (resumeResult.data[0] as any)?.skills;
          if (Array.isArray(skills)) {
            userSkills = skills.filter(
              (s: unknown): s is string =>
                typeof s === "string" && s.trim().length > 0,
            );
          }
        }

        if (appsResult.error) {
          throw new Error(
            `Failed to load applications: ${appsResult.error.message}`,
          );
        }
        if (jobsResult.error) {
          throw new Error(
            `Failed to load jobs: ${jobsResult.error.message}`,
          );
        }

        const appsAll = appsResult.data ?? [];
        const jobsAll = jobsResult.data ?? [];

        // 3. Filter by period date range
        const startTs = range.start.getTime();
        const endTs = range.end.getTime();
        const prevStartTs = prevRange.start.getTime();
        const prevEndTs = prevRange.end.getTime();

        const apps = appsAll.filter((a: any) => {
          const t = new Date(a.applied_date || a.created_at).getTime();
          return t >= startTs && t <= endTs;
        });

        const jobs = jobsAll.filter((j: any) => {
          const t = new Date(j.created_at).getTime();
          return t >= startTs && t <= endTs;
        });

        const prevApps = appsAll.filter((a: any) => {
          const t = new Date(a.applied_date || a.created_at).getTime();
          return t >= prevStartTs && t <= prevEndTs;
        });

        const prevJobs = jobsAll.filter((j: any) => {
          const t = new Date(j.created_at).getTime();
          return t >= prevStartTs && t <= prevEndTs;
        });

        // 4. Extract match scores from jobs (primary) with fallback to applications
        const currentScoreItems: { date: Date; score: number }[] = [];
        const currentScores: number[] = [];

        for (const job of jobs) {
          const rawData = (job as any)?.raw_data;
          const matchInsights = rawData?.match_insights;
          if (
            matchInsights &&
            typeof matchInsights.score === "number"
          ) {
            const score = clampScore(matchInsights.score);
            currentScoreItems.push({
              date: new Date((job as any).created_at),
              score,
            });
            currentScores.push(score);
          }
        }

        // Fallback: if no job-based scores, use application match_score
        if (currentScores.length === 0) {
          for (const app of apps) {
            const ms = (app as any).match_score;
            if (ms !== null && ms !== undefined && typeof ms === "number") {
              const score = clampScore(ms);
              currentScoreItems.push({
                date: new Date(
                  (app as any).applied_date || (app as any).created_at,
                ),
                score,
              });
              currentScores.push(score);
            }
          }
        }

        // Previous period scores for delta calculation
        const previousScores: number[] = [];
        for (const job of prevJobs) {
          const rawData = (job as any)?.raw_data;
          const matchInsights = rawData?.match_insights;
          if (
            matchInsights &&
            typeof matchInsights.score === "number"
          ) {
            previousScores.push(clampScore(matchInsights.score));
          }
        }
        if (previousScores.length === 0) {
          for (const app of prevApps) {
            const ms = (app as any).match_score;
            if (ms !== null && ms !== undefined && typeof ms === "number") {
              previousScores.push(clampScore(ms));
            }
          }
        }

        // 5. Extract skill keywords from job raw_data
        const jobSkillSets: string[][] = [];
        for (const job of jobs) {
          const rawData = (job as any)?.raw_data;
          const summary = rawData?.match_insights?.summary;
          const title = (job as any)?.title;
          const keywords = extractSkillKeywords(summary, title);
          if (keywords.length > 0) {
            jobSkillSets.push(keywords);
          }
        }

        // 6. Call pure computation functions
        const scoreTrend = computeScoreTrend(
          currentScoreItems,
          granularity,
          period,
        );

        const { overallAvgScore, scoreDelta } = computeOverallAvgAndDelta(
          currentScores,
          previousScores,
        );

        const scoreDistribution = computeScoreDistribution(currentScores);

        const timeline = computeTimeline(
          apps.map((a: any) => ({
            id: a.id,
            applied_date: a.applied_date,
            created_at: a.created_at,
            status: a.status,
            updated_at: a.updated_at,
            match_score: a.match_score,
          })),
          jobs.map((j: any) => ({
            id: j.id,
            title: j.title || "Unknown Position",
            company: j.company || null,
            created_at: j.created_at,
          })),
        );

        const weeklyDigest = computeWeeklyDigest(
          apps.map((a: any) => ({
            applied_date: a.applied_date,
            created_at: a.created_at,
            status: a.status,
            match_score: a.match_score,
          })),
          jobs.map((j: any) => ({
            created_at: j.created_at,
          })),
        );

        const skillGaps = computeSkillGaps(userSkills, jobSkillSets);

        // 7. Compute journey narrative metrics
        const totalApplications = apps.length;
        const interviews = apps.filter(
          (a: any) =>
            String(a.status).toLowerCase().includes("interview"),
        ).length;
        const interviewRate =
          totalApplications > 0 ? interviews / totalApplications : 0;
        const topMatchScore =
          currentScores.length > 0 ? Math.max(...currentScores) : 0;

        // Most active source
        const sourceCounts = new Map<string, number>();
        for (const job of jobs) {
          const src = String((job as any).source_type || "Unknown")
            .trim()
            .replace(/^www\./, "")
            .replace(/[-_]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          const key = src || "Unknown";
          sourceCounts.set(key, (sourceCounts.get(key) || 0) + 1);
        }
        let mostActiveSource = "Unknown";
        let maxSourceCount = 0;
        for (const [name, count] of sourceCounts) {
          if (count > maxSourceCount) {
            maxSourceCount = count;
            mostActiveSource = name;
          }
        }

        // Trend direction: compare first half vs second half of current scores
        let trendDirection: "improving" | "declining" | "steady" = "steady";
        if (scoreTrend.length >= 2) {
          const mid = Math.floor(scoreTrend.length / 2);
          const firstHalf = scoreTrend.slice(0, mid);
          const secondHalf = scoreTrend.slice(mid);
          const firstAvg =
            firstHalf.reduce((s, p) => s + p.avgScore, 0) /
            firstHalf.length;
          const secondAvg =
            secondHalf.reduce((s, p) => s + p.avgScore, 0) /
            secondHalf.length;
          const diff = secondAvg - firstAvg;
          if (diff > 2) trendDirection = "improving";
          else if (diff < -2) trendDirection = "declining";
        }

        const journeyNarrative =
          totalApplications > 0
            ? generateJourneyNarrative({
                totalApplications,
                interviewRate,
                topMatchScore,
                mostActiveSource,
                trendDirection,
              })
            : "";

        if (cancelled) return;

        // 8. Assemble the InsightsData return object
        setInsightsState({
          scoreTrend,
          overallAvgScore,
          scoreDelta,
          scoreDistribution,
          timeline,
          weeklyDigest,
          skillGaps,
          hasResume,
          journeyNarrative,
          loading: false,
          error: resumeError,
        });
      } catch (err: any) {
        if (cancelled) return;
        setInsightsState((prev) => ({
          ...prev,
          loading: false,
          error: err?.message || "Failed to load insights data",
        }));
      }
    }

    fetchAndCompute();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    supabase,
    period,
    granularity,
    analyticsData.loading,
    analyticsData.error,
    range.start.getTime(),
    range.end.getTime(),
    prevRange.start.getTime(),
    prevRange.end.getTime(),
  ]);

  return insightsState;
}
