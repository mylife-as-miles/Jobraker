"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react";
import { Card } from "../ui/card";

type Period = "7d" | "30d" | "90d" | "ytd" | "12m";

function compactRoleLabel(input: unknown) {
  const raw = typeof input === "string" ? input : "";
  const normalized = raw
    .replace(/\s+/g, " ")
    .replace(/^job ad nigeria:\s*/i, "")
    .trim();

  const primary =
    normalized
      .split(/(?:\s+[|•]\s+|\s+\|\s+|\n+)/)
      .map((part) => part.trim())
      .find(Boolean) || normalized;

  if (primary.length <= 54) return primary;

  const trimmed = primary.slice(0, 51);
  const lastSpace = trimmed.lastIndexOf(" ");
  return `${(lastSpace > 24 ? trimmed.slice(0, lastSpace) : trimmed).trimEnd()}...`;
}

export function MatchScoreAnalytics({
  period,
  data,
}: {
  period: Period;
  data: any;
}) {
  const chartData = useMemo(() => {
    return Array.isArray(data?.matchBarData)
      ? data.matchBarData.slice(0, 6)
      : [];
  }, [data?.matchBarData]);

  const delta = data?.comparisons?.avgMatchDelta ?? 0;
  const average = data?.metrics?.avgMatchScore ?? 0;
  const loading = Boolean(data?.loading);
  const hasData = chartData.length > 0;
  const hasRoleDetails = chartData.some((item: any) =>
    Boolean(item?.summary || item?.company),
  );
  const maxValue = Math.max(
    ...chartData.map((item: any) => Number(item.value) || 0),
    0,
  );
  const highlight = hasRoleDetails ? chartData[0] : null;
  const rows = useMemo(() => {
    return chartData.map((item: any, index: number) => {
      const value = Math.max(0, Number(item?.value) || 0);
      const ratio = hasRoleDetails
        ? value / 100
        : maxValue > 0
          ? value / maxValue
          : 0;
      const width = Math.max(ratio * 100, value > 0 ? 10 : 0);
      const fullLabel =
        typeof item?.name === "string" && item.name.trim()
          ? item.name.trim()
          : `Role ${index + 1}`;

      return {
        id: `${item?.name ?? "match"}-${index}`,
        company: item?.company,
        color: item?.color || "#10b981",
        fullLabel,
        label: compactRoleLabel(fullLabel),
        rank: index + 1,
        value,
        width: Math.min(width, 100),
      };
    });
  }, [chartData, hasRoleDetails, maxValue]);

  return (
    <div className='h-full'>
      <Card className='relative h-full overflow-hidden border bg-card/40 backdrop-blur-xl border-foreground/10'>
        {/* Decorative Gradient Background */}
        <div className='absolute -top-24 -right-24 w-64 h-64 rounded-full bg-brand/5 blur-3xl' />
        <div className='absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-brand/5 blur-3xl' />

        <div className='relative z-10 flex h-full flex-col p-5 sm:p-6'>
          <div className='mb-6 flex items-start justify-between gap-3'>
            <div className='space-y-3'>
              <div className='inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-brand'>
                <Sparkles className='h-3.5 w-3.5' />
                Match quality
              </div>
              <h2 className='text-2xl font-bold text-foreground tracking-tight'>
                Top match performance
              </h2>
              <p className='text-sm text-muted-foreground/80'>
                Average compatibility in {String(period).toUpperCase()}
              </p>
            </div>

            <div className='rounded-2xl border border-border/40 bg-background/40 backdrop-blur-md px-5 py-4 text-right shadow-inner ring-1 ring-white/5'>
              <div className='text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60'>
                Average
              </div>
              <div className='mt-1 flex items-center justify-end gap-2 text-4xl font-extrabold text-foreground tracking-tighter'>
                <span className='bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent'>
                  {Math.round(average)}%
                </span>
                {delta !== 0 ? (
                  <div
                    className={
                      delta > 0
                        ? "flex items-center gap-0.5 text-xs text-brand font-bold bg-brand/10 px-1.5 py-0.5 rounded-full"
                        : "flex items-center gap-0.5 text-xs text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded-full"
                    }
                  >
                    {delta > 0 ? (
                      <ArrowUpRight className='h-3 w-3' />
                    ) : (
                      <ArrowDownRight className='h-3 w-3' />
                    )}
                    {delta > 0 ? "+" : ""}
                    {delta}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className='relative'>
            {hasData ? (
              <div className='space-y-3.5'>
                {rows.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24, delay: item.rank * 0.04 }}
                    className='rounded-2xl border border-border/30 bg-background/30 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'
                  >
                    <div className='flex items-start justify-between gap-3'>
                      <div className='min-w-0 flex-1'>
                        <div className='flex items-start gap-3'>
                          <div className='mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand/20 bg-brand/10 text-[11px] font-bold text-brand'>
                            {String(item.rank).padStart(2, "0")}
                          </div>
                          <div className='min-w-0'>
                            <div
                              className='pr-2 text-sm font-semibold leading-snug text-foreground'
                              title={item.fullLabel}
                              style={{
                                display: "-webkit-box",
                                WebkitBoxOrient: "vertical",
                                WebkitLineClamp: 2,
                                overflow: "hidden",
                              }}
                            >
                              {item.label}
                            </div>
                            {item.company ? (
                              <div
                                className='mt-1 truncate pr-2 text-xs font-medium text-muted-foreground/70'
                                title={item.company}
                              >
                                {item.company}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div
                        className='shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide shadow-sm'
                        style={{
                          borderColor: `${item.color}55`,
                          backgroundColor: `${item.color}18`,
                          color: item.color,
                        }}
                      >
                        {hasRoleDetails
                          ? `${Math.round(item.value)}%`
                          : Math.round(item.value)}
                      </div>
                    </div>

                    <div className='mt-3 pl-10'>
                      <div className='h-2.5 overflow-hidden rounded-full bg-white/[0.04] ring-1 ring-white/[0.05]'>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${item.width}%` }}
                          transition={{
                            duration: 0.4,
                            delay: item.rank * 0.05,
                            ease: [0.23, 1, 0.32, 1],
                          }}
                          className='h-full rounded-full'
                          style={{
                            background: `linear-gradient(90deg, ${item.color}99 0%, ${item.color} 100%)`,
                            boxShadow: `0 0 20px ${item.color}33`,
                          }}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className='flex min-h-[250px] items-center justify-center rounded-2xl border border-dashed border-border/40 bg-background/20 text-sm text-muted-foreground/60 backdrop-blur-sm'>
                No match score data is available yet.
              </div>
            )}

            {loading ? (
              <div className='absolute inset-0 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-xl transition-all duration-500'>
                <div className='flex items-center gap-3 rounded-full border border-border/40 bg-card/80 px-5 py-2.5 text-xs font-medium text-foreground/80 shadow-2xl backdrop-blur-md'>
                  <div className='h-4 w-4 animate-spin rounded-full border-2 border-brand/20 border-t-brand/200' />
                  Analyzing matches...
                </div>
              </div>
            ) : null}
          </div>

          {highlight?.summary ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className='mt-6 rounded-2xl border border-border/30 bg-brand/5 p-4 text-sm text-foreground/80 ring-1 ring-brand/10'
            >
              <div className='flex items-center gap-2 mb-2'>
                <span
                  className='font-bold text-foreground'
                  title={highlight.name}
                >
                  {compactRoleLabel(highlight.name)}
                </span>
                {highlight.company ? (
                  <>
                    <div className='h-1 w-1 rounded-full bg-muted-foreground/40' />
                    <span className='text-muted-foreground/70 font-medium'>
                      {highlight.company}
                    </span>
                  </>
                ) : null}
              </div>
              <p className='leading-relaxed text-muted-foreground/90 italic'>
                "{highlight.summary}"
              </p>
            </motion.div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
