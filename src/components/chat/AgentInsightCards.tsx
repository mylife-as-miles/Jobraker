import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChartNoAxesCombined } from "lucide-react";

export type AgentAnalyticsSnapshot = {
  periodDays: number;
  applications: number;
  previousApplications: number;
  applicationsDelta: number;
  interviews: number;
  offers: number;
  offerRate: number;
  interviewOrOfferRate: number;
  statusBreakdown: Record<string, number>;
  jobSources: Record<string, number>;
  jobsFound?: number;
};

type InsightPage = {
  id: string;
  eyebrow: string;
  title: string;
  value: string;
  detail: string;
  series: { label: string; value: number; tone: "brand" | "sky" | "amber" }[];
};

const tones = {
  brand: { stroke: "hsl(var(--brand))", fill: "hsl(var(--brand) / 0.16)" },
  sky: { stroke: "rgb(125 211 252)", fill: "rgb(125 211 252 / 0.14)" },
  amber: { stroke: "rgb(252 211 77)", fill: "rgb(252 211 77 / 0.14)" },
};

const makePages = (snapshot: AgentAnalyticsSnapshot): InsightPage[] => {
  const pages: InsightPage[] = [
    {
      id: "momentum",
      eyebrow: `${snapshot.periodDays}-day snapshot`,
      title: "Application momentum",
      value: String(snapshot.applications),
      detail: `${snapshot.applicationsDelta >= 0 ? "+" : ""}${snapshot.applicationsDelta} compared with the previous ${snapshot.periodDays} days`,
      series: [
        { label: "Previous period", value: snapshot.previousApplications, tone: "sky" },
        { label: "Current period", value: snapshot.applications, tone: "brand" },
      ],
    },
  ];

  const statusSeries = Object.entries(snapshot.statusBreakdown)
    .filter(([, value]) => Number.isFinite(value))
    .sort(([, left], [, right]) => right - left)
    .slice(0, 6)
    .map(([label, value], index) => ({
      label,
      value,
      tone: (index === 0 ? "brand" : index === 1 ? "sky" : "amber") as "brand" | "sky" | "amber",
    }));
  if (statusSeries.length > 0) {
    pages.push({
      id: "pipeline",
      eyebrow: "Pipeline health",
      title: "Where applications stand",
      value: `${snapshot.interviews} interview${snapshot.interviews === 1 ? "" : "s"}`,
      detail: `${snapshot.offers} offer${snapshot.offers === 1 ? "" : "s"} · ${snapshot.interviewOrOfferRate}% interview or offer rate`,
      series: statusSeries,
    });
  }

  const sourceSeries = Object.entries(snapshot.jobSources)
    .filter(([, value]) => Number.isFinite(value))
    .sort(([, left], [, right]) => right - left)
    .slice(0, 6)
    .map(([label, value], index) => ({
      label,
      value,
      tone: (index === 0 ? "brand" : index === 1 ? "sky" : "amber") as "brand" | "sky" | "amber",
    }));
  if (sourceSeries.length > 0) {
    pages.push({
      id: "sources",
      eyebrow: "Search coverage",
      title: "Job sources this period",
      value: String(snapshot.jobsFound ?? sourceSeries.reduce((total, source) => total + source.value, 0)),
      detail: `${sourceSeries.length} active source${sourceSeries.length === 1 ? "" : "s"} represented in this snapshot`,
      series: sourceSeries,
    });
  }

  return pages;
};

const ScrubbableInsightChart = ({ series }: { series: InsightPage["series"] }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const maximum = Math.max(1, ...series.map((item) => item.value));
  const active = activeIndex === null ? null : series[activeIndex];
  const updateActive = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    setActiveIndex(Math.min(series.length - 1, Math.floor(progress * series.length)));
  };

  return (
    <div
      className="relative mt-4 touch-none rounded-lg border border-border/70 bg-background/60 px-3 pb-2.5 pt-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      onPointerDown={updateActive}
      onPointerMove={updateActive}
      onPointerLeave={() => setActiveIndex(null)}
      onPointerUp={() => setActiveIndex(null)}
      onFocus={() => setActiveIndex(series.length - 1)}
      onBlur={() => setActiveIndex(null)}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          setActiveIndex((index) => Math.max(0, (index ?? series.length - 1) - 1));
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          setActiveIndex((index) => Math.min(series.length - 1, (index ?? -1) + 1));
        }
      }}
      tabIndex={0}
      role="group"
      aria-label="Interactive analytics chart. Drag or move across the chart to inspect values."
    >
      <div className="pointer-events-none absolute left-3 top-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {active ? `${active.label}: ${active.value}` : "Drag to inspect"}
      </div>
      {/* Bars and labels share one flex track, so a column's bar always sits
          above its own label. The previous SVG stretched a fixed 160-unit
          viewBox to the container width with preserveAspectRatio="none", which
          scaled x and y unequally: corner radii and strokes sheared, a small
          value collapsed into a flat ellipse, and the bars drifted out of
          alignment with the labels underneath them. */}
      <div className="flex h-20 items-end gap-2 border-b border-dashed border-border/70">
        {series.map((item, index) => {
          const isActive = activeIndex === index;
          const heightPercent = Math.max(6, (item.value / maximum) * 100);
          return (
            <div key={item.label} className="flex h-full min-w-0 flex-1 items-end justify-center">
              <div
                // Cap the width so a two-series comparison renders as two bars
                // rather than two full-width slabs, where a small value reads as
                // a stray line instead of a short bar.
                className="w-full max-w-[54px] rounded-t-[4px] transition-opacity"
                style={{
                  height: `${heightPercent}%`,
                  backgroundColor: tones[item.tone].fill,
                  borderStyle: "solid",
                  borderColor: tones[item.tone].stroke,
                  // Longhand only: mixing `border` with `borderBottom` makes
                  // React warn about conflicting shorthand on rerender.
                  borderWidth: `${isActive ? 2 : 1}px ${isActive ? 2 : 1}px 0`,
                  opacity: activeIndex === null || isActive ? 1 : 0.5,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-2">
        {series.map((item, index) => (
          <span
            key={item.label}
            className={`min-w-0 flex-1 truncate text-center text-[10px] ${
              activeIndex === index ? "text-foreground" : "text-muted-foreground"
            }`}
            title={item.label}
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
};

export const AgentInsightCards = ({ snapshot }: { snapshot: AgentAnalyticsSnapshot }) => {
  const pages = useMemo(() => makePages(snapshot), [snapshot]);
  const [pageIndex, setPageIndex] = useState(0);
  const safePageIndex = Math.min(pageIndex, pages.length - 1);
  const page = pages[safePageIndex];

  if (!page) return null;

  return (
    <section className="my-4 max-w-xl overflow-hidden rounded-xl border border-border bg-card" aria-labelledby="agent-insights-title">
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand"><ChartNoAxesCombined className="size-4" aria-hidden="true" /></span>
          <div>
            <h3 id="agent-insights-title" className="text-sm font-semibold text-foreground">Agent insights</h3>
            <p className="text-[11px] text-muted-foreground">Verified tracker snapshot</p>
          </div>
        </div>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">{safePageIndex + 1} / {pages.length}</span>
      </div>

      <div className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">{page.eyebrow}</p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h4 className="text-base font-semibold text-foreground">{page.title}</h4>
          <span className="text-xl font-semibold tabular-nums text-foreground">{page.value}</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{page.detail}</p>
        <ScrubbableInsightChart series={page.series} />
      </div>

      <div className="flex items-center justify-between border-t border-border/70 px-4 py-2.5">
        <div className="flex gap-1" aria-label="Insight pages">
          {pages.map((item, index) => <span key={item.id} className={`h-1.5 rounded-full transition-all ${index === safePageIndex ? "w-5 bg-brand" : "w-1.5 bg-border"}`} />)}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setPageIndex((index) => Math.max(0, index - 1))} disabled={safePageIndex === 0} className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-brand/10 hover:text-brand disabled:cursor-not-allowed disabled:opacity-35" aria-label="Previous insight"><ChevronLeft className="size-4" /></button>
          <button type="button" onClick={() => setPageIndex((index) => Math.min(pages.length - 1, index + 1))} disabled={safePageIndex === pages.length - 1} className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-brand/10 hover:text-brand disabled:cursor-not-allowed disabled:opacity-35" aria-label="Next insight"><ChevronRight className="size-4" /></button>
        </div>
      </div>
    </section>
  );
};
