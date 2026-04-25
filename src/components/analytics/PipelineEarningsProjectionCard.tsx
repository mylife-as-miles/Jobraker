"use client";

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Briefcase,
  CalendarRange,
  DollarSign,
  Sparkles,
  Timer,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useApplications } from "@/hooks/useApplications";
import {
  buildPipelineEarningsSeries,
  computeAnalyticsDateRange,
  DEFAULT_PIPELINE_SIM,
  faceValuePipelineParams,
  type AnalyticsPeriod,
  type PipelineSimulationParams,
} from "@/lib/pipelineEarningsModel";

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

type ViewMode = "simulated" | "face";

export function PipelineEarningsProjectionCard({
  period,
}: {
  period: AnalyticsPeriod;
}) {
  const navigate = useNavigate();
  const { applications, loading } = useApplications();
  const [viewMode, setViewMode] = useState<ViewMode>("simulated");
  const [includeInterview, setIncludeInterview] = useState(true);
  const [sim, setSim] = useState<PipelineSimulationParams>({
    ...DEFAULT_PIPELINE_SIM,
  });

  const range = useMemo(() => computeAnalyticsDateRange(period), [period]);

  const rangeLabel = useMemo(() => {
    const a = range.start.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const b = range.end.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${a} – ${b}`;
  }, [range]);

  const effectiveParams = useMemo((): PipelineSimulationParams => {
    if (viewMode === "face") {
      return faceValuePipelineParams(includeInterview);
    }
    return {
      ...sim,
      includeInterviewPipeline: includeInterview,
    };
  }, [viewMode, sim, includeInterview]);

  const model = useMemo(
    () => buildPipelineEarningsSeries(applications, range, effectiveParams),
    [applications, range, effectiveParams],
  );

  const chartData = useMemo(() => {
    if (model.chart.length === 0) return [];
    const startTs = range.start.getTime();
    const head = {
      label: "Start",
      ts: startTs,
      conservative: 0,
      expected: 0,
      optimistic: 0,
    };
    return [
      head,
      ...model.chart.map((p) => ({
        ...p,
        label: new Date(p.ts).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
      })),
    ];
  }, [model.chart, range.start]);

  const resetSimulation = () => {
    setSim({ ...DEFAULT_PIPELINE_SIM });
    setIncludeInterview(true);
    setViewMode("simulated");
  };

  return (
    <Card className='rounded-2xl border border-foreground/10 bg-gradient-to-br from-card via-card to-foreground/[0.02] p-5 sm:p-6'>
      <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
        <div className='min-w-0 space-y-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <h2 className='text-lg font-semibold tracking-tight text-foreground'>
              How much am I in line to earn?
            </h2>
            <span className='inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand'>
              <Sparkles className='h-3 w-3' />
              Estimate
            </span>
          </div>
          <p className='text-sm text-foreground/55'>
            Probability-weighted rollups from{" "}
            <strong className='text-foreground/80'>Interview</strong> and{" "}
            <strong className='text-foreground/80'>Offer</strong> applications
            with parsed compensation text (annualized, nominal USD).
          </p>
        </div>

        <div className='flex flex-col items-stretch gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-end'>
          <div className='inline-flex rounded-xl border border-foreground/15 bg-foreground/[0.04] p-0.5'>
            <button
              type='button'
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                viewMode === "simulated"
                  ? "bg-brand/20 text-brand shadow-sm"
                  : "text-foreground/50 hover:text-foreground/80"
              }`}
              onClick={() => setViewMode("simulated")}
            >
              <Timer className='h-3.5 w-3.5' />
              Simulation
            </button>
            <button
              type='button'
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                viewMode === "face"
                  ? "bg-brand/20 text-brand shadow-sm"
                  : "text-foreground/50 hover:text-foreground/80"
              }`}
              onClick={() => setViewMode("face")}
            >
              <DollarSign className='h-3.5 w-3.5' />
              Face value
            </button>
          </div>
        </div>
      </div>

      <div className='mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-200'>
            <CalendarRange className='h-3.5 w-3.5' />
            Billing window: {rangeLabel}
          </span>
          <span className='inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 bg-foreground/[0.04] px-2.5 py-1 text-xs text-foreground/65'>
            <Briefcase className='h-3.5 w-3.5 text-foreground/45' />
            {model.includedCount} roles · {model.missingCompCount} missing comp
          </span>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='h-8 border-foreground/20 text-xs'
            onClick={() =>
              navigate("/dashboard/application?view=list&status=Offer")
            }
          >
            Open offers
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='h-8 text-xs text-foreground/50'
            onClick={resetSimulation}
          >
            Reset
          </Button>
        </div>

        <div className='flex flex-wrap items-center gap-3 lg:justify-end'>
          <label className='flex cursor-pointer items-center gap-2 text-xs text-foreground/60'>
            <input
              type='checkbox'
              checked={includeInterview}
              onChange={(e) => setIncludeInterview(e.target.checked)}
              className='accent-brand rounded'
            />
            Include interviews
          </label>
        </div>
      </div>

      {viewMode === "simulated" ? (
        <div className='mt-4 grid gap-4 sm:grid-cols-3'>
          <div>
            <div className='mb-1 flex justify-between text-[11px] text-foreground/50'>
              <span>Interview → offer</span>
              <span>{Math.round(sim.interviewToOffer * 100)}%</span>
            </div>
            <Slider
              min={5}
              max={95}
              step={1}
              value={[Math.round(sim.interviewToOffer * 100)]}
              onValueChange={([v]) =>
                setSim((s) => ({ ...s, interviewToOffer: (v ?? 28) / 100 }))
              }
              aria-label='Interview to offer probability'
            />
          </div>
          <div>
            <div className='mb-1 flex justify-between text-[11px] text-foreground/50'>
              <span>Offer realized</span>
              <span>{Math.round(sim.offerRealized * 100)}%</span>
            </div>
            <Slider
              min={5}
              max={100}
              step={1}
              value={[Math.round(sim.offerRealized * 100)]}
              onValueChange={([v]) =>
                setSim((s) => ({ ...s, offerRealized: (v ?? 55) / 100 }))
              }
              aria-label='Offer realized probability'
            />
          </div>
          <div>
            <div className='mb-1 flex justify-between text-[11px] text-foreground/50'>
              <span>Negotiation uplift (optimistic)</span>
              <span>+{Math.round(sim.negotiationUplift * 100)}%</span>
            </div>
            <Slider
              min={0}
              max={25}
              step={1}
              value={[Math.round(sim.negotiationUplift * 100)]}
              onValueChange={([v]) =>
                setSim((s) => ({ ...s, negotiationUplift: (v ?? 0) / 100 }))
              }
              aria-label='Negotiation uplift percent'
            />
          </div>
        </div>
      ) : null}

      <div className='mt-6 grid gap-4 lg:grid-cols-[1fr_200px] lg:gap-6'>
        <div className='min-h-[280px] w-full'>
          {loading ? (
            <div className='flex h-[280px] items-center justify-center text-sm text-foreground/50'>
              Loading applications…
            </div>
          ) : chartData.length < 2 ? (
            <div className='flex h-[280px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-foreground/15 bg-foreground/[0.02] px-4 text-center'>
              <p className='text-sm font-medium text-foreground/70'>
                No compensable pipeline in this window
              </p>
              <p className='text-xs text-foreground/45'>
                Add compensation on <strong>Offer</strong> or{" "}
                <strong>Interview</strong> rows (Application detail →
                Compensation), or widen the analytics period.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width='100%' height={280}>
              <ComposedChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 4, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray='3 3'
                  stroke='rgba(255,255,255,0.06)'
                  vertical={false}
                />
                <XAxis
                  dataKey='label'
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) =>
                    v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`
                  }
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(12,14,18,0.95)",
                    border: "1px solid rgba(29,255,0,0.25)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => [
                    usd0.format(value),
                    name,
                  ]}
                />
                <Area
                  type='monotone'
                  dataKey='optimistic'
                  name='Optimistic'
                  stroke='#34d399'
                  fill='url(#optGrad)'
                  fillOpacity={0.15}
                  strokeWidth={1.5}
                />
                <Area
                  type='monotone'
                  dataKey='expected'
                  name='Expected'
                  stroke='#1dff00'
                  fill='url(#expGrad)'
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                <Line
                  type='monotone'
                  dataKey='conservative'
                  name='Conservative'
                  stroke='#94a3b8'
                  dot={false}
                  strokeWidth={1.5}
                  strokeDasharray='4 4'
                />
                <defs>
                  <linearGradient id='expGrad' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%' stopColor='#1dff00' stopOpacity={0.35} />
                    <stop offset='100%' stopColor='#1dff00' stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id='optGrad' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%' stopColor='#34d399' stopOpacity={0.3} />
                    <stop offset='100%' stopColor='#34d399' stopOpacity={0} />
                  </linearGradient>
                </defs>
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className='flex flex-col justify-center gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4 lg:border-l lg:border-t-0 lg:border-foreground/10'>
          <p className='text-[11px] font-medium uppercase tracking-wider text-foreground/45'>
            Expected annual (weighted)
          </p>
          <p className='text-3xl font-bold tabular-nums text-brand'>
            {usd0.format(model.totals.expected)}
          </p>
          <div className='space-y-1 text-xs text-foreground/55'>
            <p>
              Band: {usd0.format(model.totals.conservative)} —{" "}
              {usd0.format(model.totals.optimistic)}
            </p>
            <p className='text-[10px] leading-relaxed text-foreground/40'>
              Modeled cumulative comp if listings/offers parse cleanly. Not tax
              or offer advice—tune sliders to stress-test your pipeline.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
