// Pure computation functions for the Analytics Insights feature.
// All functions are deterministic and side-effect free.

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface ScoreTrendPoint {
  label: string;
  timestamp: number;
  avgScore: number;
  count: number;
}

export interface ScoreDistributionBucket {
  range: string;
  count: number;
  percentage: number;
  color: string;
}

export interface TimelineEvent {
  id: string;
  jobTitle: string;
  company: string | null;
  status: string;
  matchScore: number | null;
  date: string;
  isStatusChange: boolean;
}

export interface WeeklyDigest {
  weekLabel: string;
  applications: number;
  jobsDiscovered: number;
  interviews: number;
  avgMatchScore: number;
  deltas: {
    applications: number;
    jobsDiscovered: number;
    interviews: number;
    avgMatchScore: number;
  };
}

export interface SkillGapItem {
  skill: string;
  frequency: number;
}

export interface InsightsData {
  scoreTrend: ScoreTrendPoint[];
  overallAvgScore: number;
  scoreDelta: number;
  scoreDistribution: ScoreDistributionBucket[];
  timeline: TimelineEvent[];
  weeklyDigest: WeeklyDigest | null;
  skillGaps: SkillGapItem[];
  hasResume: boolean;
  journeyNarrative: string;
  loading: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getISOWeek(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Return a bucket key for a given date and granularity. */
function bucketKey(
  d: Date,
  granularity: "day" | "week" | "month",
): string {
  if (granularity === "day") {
    return d.toISOString().slice(0, 10);
  }
  if (granularity === "week") {
    // ISO week: find the Monday of this week
    const copy = new Date(d);
    const day = (copy.getDay() + 6) % 7; // Monday = 0
    copy.setDate(copy.getDate() - day);
    const w = getISOWeek(copy);
    return `${copy.getFullYear()}-W${String(w).padStart(2, "0")}`;
  }
  // month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Human-readable label for a bucket key. */
function bucketLabel(
  d: Date,
  granularity: "day" | "week" | "month",
): string {
  if (granularity === "month") {
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
  if (granularity === "week") {
    const w = getISOWeek(d);
    return `Wk ${String(w).padStart(2, "0")} ${d.getFullYear().toString().slice(-2)}`;
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Timestamp for the start of a bucket (used for sorting). */
function bucketTimestamp(
  d: Date,
  granularity: "day" | "week" | "month",
): number {
  if (granularity === "day") {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }
  if (granularity === "week") {
    const copy = new Date(d);
    const day = (copy.getDay() + 6) % 7;
    copy.setDate(copy.getDate() - day);
    copy.setHours(0, 0, 0, 0);
    return copy.getTime();
  }
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

/** Monday 00:00:00 of the week containing `d`. */
function startOfWeekMonday(d: Date): Date {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7; // Monday = 0
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Format a date as "Mon D" (e.g. "Dec 9"). */
function shortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// 1. computeScoreTrend
// ---------------------------------------------------------------------------

export function computeScoreTrend(
  items: { date: Date; score: number }[],
  granularity: "day" | "week" | "month",
  _period: string,
): ScoreTrendPoint[] {
  if (items.length === 0) return [];

  // Group by bucket
  const buckets = new Map<
    string,
    { scores: number[]; label: string; timestamp: number }
  >();

  for (const item of items) {
    const key = bucketKey(item.date, granularity);
    if (!buckets.has(key)) {
      buckets.set(key, {
        scores: [],
        label: bucketLabel(item.date, granularity),
        timestamp: bucketTimestamp(item.date, granularity),
      });
    }
    buckets.get(key)!.scores.push(item.score);
  }

  // Build result sorted by timestamp ascending
  return Array.from(buckets.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((b) => ({
      label: b.label,
      timestamp: b.timestamp,
      avgScore: Math.round(
        b.scores.reduce((s, v) => s + v, 0) / b.scores.length,
      ),
      count: b.scores.length,
    }));
}

// ---------------------------------------------------------------------------
// 2. computeOverallAvgAndDelta
// ---------------------------------------------------------------------------

export function computeOverallAvgAndDelta(
  currentScores: number[],
  previousScores: number[],
): { overallAvgScore: number; scoreDelta: number } {
  const currentAvg =
    currentScores.length > 0
      ? Math.round(
          currentScores.reduce((s, v) => s + v, 0) / currentScores.length,
        )
      : 0;

  const previousAvg =
    previousScores.length > 0
      ? Math.round(
          previousScores.reduce((s, v) => s + v, 0) / previousScores.length,
        )
      : 0;

  return {
    overallAvgScore: currentAvg,
    scoreDelta: currentAvg - previousAvg,
  };
}

// ---------------------------------------------------------------------------
// 3. computeScoreDistribution
// ---------------------------------------------------------------------------

export function computeScoreDistribution(
  scores: number[],
): ScoreDistributionBucket[] {
  const total = scores.length;

  const buckets: ScoreDistributionBucket[] = [
    { range: "90–100", count: 0, percentage: 0, color: "#1dff00" },
    { range: "75–89", count: 0, percentage: 0, color: "#56c2ff" },
    { range: "60–74", count: 0, percentage: 0, color: "#1dff00" },
    { range: "<60", count: 0, percentage: 0, color: "#1dff00" },
  ];

  for (const score of scores) {
    if (score >= 90) {
      buckets[0].count++;
    } else if (score >= 75) {
      buckets[1].count++;
    } else if (score >= 60) {
      buckets[2].count++;
    } else {
      buckets[3].count++;
    }
  }

  if (total > 0) {
    for (const bucket of buckets) {
      bucket.percentage = Math.round((bucket.count / total) * 100);
    }
  }

  return buckets;
}

// ---------------------------------------------------------------------------
// 4. computeTimeline
// ---------------------------------------------------------------------------

export function computeTimeline(
  applications: Array<{
    id: string;
    applied_date: string | null;
    created_at: string;
    status: string;
    updated_at: string;
    match_score: number | null;
    job?: { id: string; title: string; company: string | null };
  }>,
  jobs: Array<{
    id: string;
    title: string;
    company: string | null;
    created_at: string;
  }>,
): TimelineEvent[] {
  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  const events: TimelineEvent[] = [];

  for (const app of applications) {
    const job = app.job ?? jobMap.get(app.id);
    const jobTitle = job?.title ?? "Unknown Position";
    const company = job?.company ?? null;
    const primaryDate = app.applied_date ?? app.created_at;

    // Primary application event
    events.push({
      id: `${app.id}-applied`,
      jobTitle,
      company,
      status: app.status,
      matchScore: app.match_score,
      date: primaryDate,
      isStatusChange: false,
    });

    // Status-change event: if updated_at > primary date and status is not initial
    const primaryTs = new Date(primaryDate).getTime();
    const updatedTs = new Date(app.updated_at).getTime();
    const isInitialStatus =
      app.status.toLowerCase() === "applied" ||
      app.status.toLowerCase() === "new";

    if (updatedTs > primaryTs && !isInitialStatus) {
      events.push({
        id: `${app.id}-status`,
        jobTitle,
        company,
        status: app.status,
        matchScore: app.match_score,
        date: app.updated_at,
        isStatusChange: true,
      });
    }
  }

  // Sort newest-first, cap at 20
  events.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return events.slice(0, 20);
}

// ---------------------------------------------------------------------------
// 5. computeWeeklyDigest
// ---------------------------------------------------------------------------

export function computeWeeklyDigest(
  applications: Array<{
    applied_date: string | null;
    created_at: string;
    status: string;
    match_score: number | null;
  }>,
  jobs: Array<{ created_at: string }>,
): WeeklyDigest | null {
  // Find the most recent complete Monday–Sunday week.
  // "Complete" means the Sunday has already passed.
  const now = new Date();
  const todayMonday = startOfWeekMonday(now);

  // The most recent complete week ended on the Sunday before todayMonday.
  const currentWeekEnd = new Date(todayMonday);
  currentWeekEnd.setDate(currentWeekEnd.getDate() - 1); // Sunday
  currentWeekEnd.setHours(23, 59, 59, 999);

  const currentWeekStart = startOfWeekMonday(currentWeekEnd);

  // Check if we have any data at all in or before this week
  const allDates = [
    ...applications.map((a) => new Date(a.applied_date ?? a.created_at)),
    ...jobs.map((j) => new Date(j.created_at)),
  ];

  if (allDates.length === 0) return null;

  const earliest = new Date(
    Math.min(...allDates.map((d) => d.getTime())),
  );

  // If the earliest data is after the current complete week start, no complete week exists
  if (earliest > currentWeekEnd) return null;

  const cwStart = currentWeekStart.getTime();
  const cwEnd = currentWeekEnd.getTime();

  // Prior week
  const priorWeekStart = new Date(currentWeekStart);
  priorWeekStart.setDate(priorWeekStart.getDate() - 7);
  const priorWeekEnd = new Date(currentWeekStart);
  priorWeekEnd.setDate(priorWeekEnd.getDate() - 1);
  priorWeekEnd.setHours(23, 59, 59, 999);

  const pwStart = priorWeekStart.getTime();
  const pwEnd = priorWeekEnd.getTime();

  // Filter applications and jobs for current week
  const inRange = (dateStr: string, start: number, end: number) => {
    const t = new Date(dateStr).getTime();
    return t >= start && t <= end;
  };

  const cwApps = applications.filter((a) =>
    inRange(a.applied_date ?? a.created_at, cwStart, cwEnd),
  );
  const cwJobs = jobs.filter((j) => inRange(j.created_at, cwStart, cwEnd));
  const cwInterviews = cwApps.filter((a) =>
    a.status.toLowerCase().includes("interview"),
  ).length;
  const cwScores = cwApps
    .map((a) => a.match_score)
    .filter((s): s is number => s !== null && s !== undefined);
  const cwAvgScore =
    cwScores.length > 0
      ? Math.round(cwScores.reduce((s, v) => s + v, 0) / cwScores.length)
      : 0;

  // Prior week metrics
  const pwApps = applications.filter((a) =>
    inRange(a.applied_date ?? a.created_at, pwStart, pwEnd),
  );
  const pwJobs = jobs.filter((j) => inRange(j.created_at, pwStart, pwEnd));
  const pwInterviews = pwApps.filter((a) =>
    a.status.toLowerCase().includes("interview"),
  ).length;
  const pwScores = pwApps
    .map((a) => a.match_score)
    .filter((s): s is number => s !== null && s !== undefined);
  const pwAvgScore =
    pwScores.length > 0
      ? Math.round(pwScores.reduce((s, v) => s + v, 0) / pwScores.length)
      : 0;

  // Compute deltas (percentage change, absolute for avgMatchScore)
  const pctDelta = (prev: number, curr: number): number => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  const weekLabel = `${shortDate(currentWeekStart)} – ${shortDate(currentWeekEnd)}`;

  return {
    weekLabel,
    applications: cwApps.length,
    jobsDiscovered: cwJobs.length,
    interviews: cwInterviews,
    avgMatchScore: cwAvgScore,
    deltas: {
      applications: pctDelta(pwApps.length, cwApps.length),
      jobsDiscovered: pctDelta(pwJobs.length, cwJobs.length),
      interviews: pctDelta(pwInterviews, cwInterviews),
      avgMatchScore: cwAvgScore - pwAvgScore,
    },
  };
}

// ---------------------------------------------------------------------------
// 6. computeSkillGaps
// ---------------------------------------------------------------------------

export function computeSkillGaps(
  userSkills: string[],
  jobSkillSets: string[][],
): SkillGapItem[] {
  const userSkillsLower = new Set(userSkills.map((s) => s.toLowerCase()));
  const freq = new Map<string, number>();

  for (const skillSet of jobSkillSets) {
    for (const skill of skillSet) {
      const lower = skill.toLowerCase();
      if (!userSkillsLower.has(lower)) {
        freq.set(lower, (freq.get(lower) || 0) + 1);
      }
    }
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([skill, frequency]) => ({ skill, frequency }));
}

// ---------------------------------------------------------------------------
// 7. generateJourneyNarrative
// ---------------------------------------------------------------------------

export function generateJourneyNarrative(metrics: {
  totalApplications: number;
  interviewRate: number;
  topMatchScore: number;
  mostActiveSource: string;
  trendDirection: "improving" | "declining" | "steady";
}): string {
  const {
    totalApplications,
    interviewRate,
    topMatchScore,
    mostActiveSource,
    trendDirection,
  } = metrics;

  const interviewPct = `${Math.round(interviewRate * 100)}%`;

  const trendPhrase =
    trendDirection === "improving"
      ? "Your match scores are improving over time, which is a positive sign."
      : trendDirection === "declining"
        ? "Your match scores have been declining recently, so consider refining your approach."
        : "Your match scores have remained steady throughout this period.";

  return (
    `You have submitted ${totalApplications} application${totalApplications !== 1 ? "s" : ""} during this period. ` +
    `Your interview rate stands at ${interviewPct}, ` +
    `and your top match score reached ${topMatchScore}. ` +
    `Most of your activity came from ${mostActiveSource}. ` +
    trendPhrase
  );
}
