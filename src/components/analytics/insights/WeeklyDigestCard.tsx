"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, CalendarDays } from "lucide-react";
import { Card } from "../../ui/card";
import type { WeeklyDigest } from "../../../hooks/insightsComputations";

interface WeeklyDigestCardProps {
  weeklyDigest: WeeklyDigest | null;
  loading: boolean;
}

interface MetricTileProps {
  label: string;
  value: number;
  delta: number;
  /** When true the delta is shown as an absolute value (e.g. "+3") instead of a percentage */
  absolute?: boolean;
}

function MetricTile({
  label,
  value,
  delta,
  absolute = false,
}: MetricTileProps) {
  const isPositive = delta > 0;
  const isNeutral = delta === 0;

  const formattedDelta = absolute
    ? `${isPositive ? "+" : ""}${delta}`
    : `${isPositive ? "+" : ""}${delta}%`;

  return (
    <div className='flex flex-col gap-1.5 rounded-xl border border-border/30 bg-background/30 p-4 backdrop-blur-sm'>
      <span className='text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60'>
        {label}
      </span>
      <div className='flex items-end justify-between gap-2'>
        <span className='text-3xl font-extrabold tracking-tighter text-foreground'>
          {value}
        </span>
        {!isNeutral && (
          <span
            className={
              isPositive
                ? "inline-flex items-center gap-0.5 rounded-full bg-brand/10 px-1.5 py-0.5 text-xs font-bold text-brand"
                : "inline-flex items-center gap-0.5 rounded-full bg-rose-500/10 px-1.5 py-0.5 text-xs font-bold text-rose-400"
            }
          >
            {isPositive ? (
              <ArrowUpRight className='h-3 w-3' />
            ) : (
              <ArrowDownRight className='h-3 w-3' />
            )}
            {formattedDelta}
          </span>
        )}
      </div>
    </div>
  );
}

export function WeeklyDigestCard({
  weeklyDigest,
  loading,
}: WeeklyDigestCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.1 }}
      className='h-full'
    >
      <Card className='relative h-full overflow-hidden border border-border/40 bg-card/40 backdrop-blur-xl shadow-2xl transition-all duration-300'>
        {/* Decorative gradient background */}
        <div className='absolute -top-24 -right-24 w-64 h-64 rounded-full bg-brand/5 blur-3xl' />
        <div className='absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-brand/5 blur-3xl' />

        <div className='relative z-10 flex h-full flex-col p-5 sm:p-6'>
          {/* Header */}
          <div className='mb-6 space-y-3'>
            <div className='inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-brand'>
              <CalendarDays className='h-3.5 w-3.5' />
              Weekly digest
            </div>
            <h2 className='text-2xl font-bold text-foreground tracking-tight'>
              Weekly activity summary
            </h2>
            {weeklyDigest && (
              <p className='text-sm text-muted-foreground/80'>
                {weeklyDigest.weekLabel}
              </p>
            )}
          </div>

          {/* Metrics grid / Empty / Loading */}
          <div className='relative min-h-[180px] flex-1'>
            {weeklyDigest ? (
              <div className='grid grid-cols-2 gap-3'>
                <MetricTile
                  label='Applications'
                  value={weeklyDigest.applications}
                  delta={weeklyDigest.deltas.applications}
                />
                <MetricTile
                  label='Jobs discovered'
                  value={weeklyDigest.jobsDiscovered}
                  delta={weeklyDigest.deltas.jobsDiscovered}
                />
                <MetricTile
                  label='Interviews'
                  value={weeklyDigest.interviews}
                  delta={weeklyDigest.deltas.interviews}
                />
                <MetricTile
                  label='Avg match score'
                  value={weeklyDigest.avgMatchScore}
                  delta={weeklyDigest.deltas.avgMatchScore}
                  absolute
                />
              </div>
            ) : (
              <div className='flex h-full min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-border/40 bg-background/20 text-sm text-muted-foreground/60 backdrop-blur-sm'>
                No complete calendar week data available yet.
              </div>
            )}

            {/* Loading overlay */}
            {loading && (
              <div className='absolute inset-0 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-xl transition-all duration-500'>
                <div className='flex items-center gap-3 rounded-full border border-border/40 bg-card/80 px-5 py-2.5 text-xs font-medium text-foreground/80 shadow-2xl backdrop-blur-md'>
                  <div className='h-4 w-4 animate-spin rounded-full border-2 border-brand/20 border-t-brand' />
                  Loading weekly digest...
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
