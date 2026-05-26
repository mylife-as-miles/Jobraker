import type { ApplicationRecord } from "@/hooks/useApplications";
import type { ApplicationStatus } from "@/lib/applicationState";
import { parseAnnualCompensationText } from "@/lib/parseCompensationText";

export type AnalyticsPeriod = "7d" | "30d" | "90d" | "ytd" | "12m";

export function computeAnalyticsDateRange(period: AnalyticsPeriod): { start: Date; end: Date } {
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

export type PipelineSimulationParams = {
  /** Probability an interview-stage app reaches offer (0–1). */
  interviewToOffer: number;
  /** Probability an offer is accepted / comp realized (0–1). */
  offerRealized: number;
  /** Optimistic band: multiply max leg by (1 + this). */
  negotiationUplift: number;
  /** Include Interview rows (weighted by interviewToOffer * offerRealized). */
  includeInterviewPipeline: boolean;
};

export const DEFAULT_PIPELINE_SIM: PipelineSimulationParams = {
  interviewToOffer: 0.28,
  offerRealized: 0.55,
  negotiationUplift: 0.08,
  includeInterviewPipeline: true,
};

/** Listing / entered comp treated as full nominal pipeline (no probability haircut). */
export function faceValuePipelineParams(includeInterview: boolean): PipelineSimulationParams {
  return {
    interviewToOffer: includeInterview ? 1 : 0,
    offerRealized: 1,
    negotiationUplift: 0,
    includeInterviewPipeline: includeInterview,
  };
}

export type WeightedPipelineApp = {
  id: string;
  jobTitle: string;
  company: string;
  status: ApplicationStatus;
  eventTime: number;
  min: number;
  mid: number;
  max: number;
  /** Effective probability weight on compensation */
  weight: number;
  parseConfidence: number;
};

function parseTimestamp(value: string | null | undefined): number {
  if (!value) return Number.NaN;
  return Date.parse(value);
}

function appEventTimestamp(a: ApplicationRecord): number {
  const statusSpecific =
    a.status === "Interview"
      ? parseTimestamp(a.interview_date)
      : a.status === "Offer"
        ? parseTimestamp(a.updated_at)
        : Number.NaN;
  if (!Number.isNaN(statusSpecific)) return statusSpecific;

  const updated = parseTimestamp(a.updated_at);
  if (!Number.isNaN(updated)) return updated;

  const applied = parseTimestamp(a.applied_date);
  if (!Number.isNaN(applied)) return applied;

  return 0;
}

function weightForStatus(
  status: ApplicationStatus,
  params: PipelineSimulationParams,
): number {
  if (status === "Offer") {
    return Math.max(0, Math.min(1, params.offerRealized));
  }
  if (status === "Interview" && params.includeInterviewPipeline) {
    return Math.max(
      0,
      Math.min(1, params.interviewToOffer * params.offerRealized),
    );
  }
  return 0;
}

function collectWeightedApps(
  applications: ApplicationRecord[],
  range: { start: Date; end: Date },
  params: PipelineSimulationParams,
): { rows: WeightedPipelineApp[]; missingCompCount: number } {
  const rows: WeightedPipelineApp[] = [];
  let missingCompCount = 0;
  const { start, end } = range;
  const t0 = start.getTime();
  const t1 = end.getTime();

  for (const a of applications) {
    if (a.status !== "Offer" && a.status !== "Interview") continue;
    const w = weightForStatus(a.status, params);
    if (w <= 0) continue;

    const ts = appEventTimestamp(a);
    if (ts < t0 || ts > t1) continue;

    const parsed = parseAnnualCompensationText(a.salary);
    if (!parsed) {
      missingCompCount++;
      continue;
    }

    const min = parsed.minAnnual;
    const max = parsed.maxAnnual * (1 + Math.max(0, params.negotiationUplift));
    const mid = parsed.midpointAnnual;

    rows.push({
      id: a.id,
      jobTitle: a.job_title,
      company: a.company,
      status: a.status,
      eventTime: ts,
      min,
      mid,
      max,
      weight: w,
      parseConfidence: parsed.parseConfidence,
    });
  }

  rows.sort((a, b) => a.eventTime - b.eventTime);
  return { rows, missingCompCount };
}

export type PipelineChartPoint = {
  label: string;
  ts: number;
  conservative: number;
  expected: number;
  optimistic: number;
};

export function buildPipelineEarningsSeries(
  applications: ApplicationRecord[],
  range: { start: Date; end: Date },
  params: PipelineSimulationParams,
): {
  chart: PipelineChartPoint[];
  totals: { conservative: number; expected: number; optimistic: number };
  rows: WeightedPipelineApp[];
  missingCompCount: number;
  includedCount: number;
} {
  const { rows, missingCompCount } = collectWeightedApps(applications, range, params);
  if (rows.length === 0) {
    return {
      chart: [],
      totals: { conservative: 0, expected: 0, optimistic: 0 },
      rows: [],
      missingCompCount,
      includedCount: 0,
    };
  }

  let cC = 0;
  let cE = 0;
  let cO = 0;
  const chart: PipelineChartPoint[] = rows.map((r) => {
    cC += r.min * r.weight;
    cE += r.mid * r.weight;
    cO += r.max * r.weight;
    const d = new Date(r.eventTime);
    const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return {
      label,
      ts: r.eventTime,
      conservative: Math.round(cC),
      expected: Math.round(cE),
      optimistic: Math.round(cO),
    };
  });

  const last = chart[chart.length - 1];
  const totals = {
    conservative: last?.conservative ?? 0,
    expected: last?.expected ?? 0,
    optimistic: last?.optimistic ?? 0,
  };

  return {
    chart,
    totals,
    rows,
    missingCompCount,
    includedCount: rows.length,
  };
}
