"use client";

import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { Card } from "../../ui/card";
import type { TimelineEvent } from "../../../hooks/insightsComputations";

interface ApplicationTimelineCardProps {
  timeline: TimelineEvent[];
  period: string;
  loading: boolean;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ApplicationTimelineCard({
  timeline,
  period,
  loading,
}: ApplicationTimelineCardProps) {
  const hasData = timeline.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.2 }}
      className='h-full'
    >
      <Card className='relative h-full overflow-hidden border border-border/40 bg-card/40 backdrop-blur-xl shadow-2xl transition-all duration-300'>
        {/* Decorative gradient background */}
        <div className='absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[#a78bfa]/5 blur-3xl' />
        <div className='absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-[#a78bfa]/5 blur-3xl' />

        <div className='relative z-10 flex h-full flex-col p-5 sm:p-6'>
          {/* Header */}
          <div className='mb-6 space-y-3'>
            <div className='inline-flex items-center gap-2 rounded-full border border-[#a78bfa]/25 bg-[#a78bfa]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#a78bfa]'>
              <Clock className='h-3.5 w-3.5' />
              Application timeline
            </div>
            <h2 className='text-2xl font-bold text-foreground tracking-tight'>
              Recent milestones
            </h2>
            <p className='text-sm text-muted-foreground/80'>
              Latest application events in {String(period).toUpperCase()}
            </p>
          </div>

          {/* Timeline / Empty / Loading */}
          <div className='relative min-h-[250px] flex-1'>
            {hasData ? (
              <div className='max-h-[400px] overflow-y-auto pr-2 scrollbar-thin'>
                <div className='relative pl-8'>
                  {/* Vertical line */}
                  <div className='absolute left-[11px] top-2 bottom-2 w-px bg-border/40' />

                  {timeline.map((event) => (
                    <div key={event.id} className='relative mb-5 last:mb-0'>
                      {/* Timeline dot */}
                      <div
                        className={`absolute -left-8 top-1.5 h-[22px] w-[22px] rounded-full border-2 flex items-center justify-center ${
                          event.isStatusChange
                            ? "border-brand bg-brand/20"
                            : "border-blue-400 bg-blue-400/20"
                        }`}
                      >
                        <div
                          className={`h-2.5 w-2.5 rounded-full ${
                            event.isStatusChange ? "bg-brand" : "bg-blue-400"
                          }`}
                        />
                      </div>

                      {/* Event content */}
                      <div className='rounded-xl border border-border/30 bg-background/30 p-3.5 backdrop-blur-sm transition-colors hover:border-border/50'>
                        <div className='flex items-start justify-between gap-2'>
                          <div className='min-w-0 flex-1'>
                            <p className='truncate text-sm font-semibold text-foreground'>
                              {event.jobTitle}
                            </p>
                            {event.company && (
                              <p className='truncate text-xs text-muted-foreground/70 mt-0.5'>
                                {event.company}
                              </p>
                            )}
                          </div>
                          {event.matchScore !== null && (
                            <div className='shrink-0 rounded-full border border-border/40 bg-background/40 px-2 py-0.5 text-[10px] font-bold text-foreground/80'>
                              {event.matchScore}%
                            </div>
                          )}
                        </div>

                        <div className='mt-2 flex flex-wrap items-center gap-2'>
                          {/* Status badge */}
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              event.isStatusChange
                                ? "border border-brand/25 bg-brand/10 text-brand"
                                : "border border-blue-400/25 bg-blue-400/10 text-blue-400"
                            }`}
                          >
                            {event.isStatusChange && (
                              <span className='text-[8px]'>↑</span>
                            )}
                            {event.status}
                          </span>

                          {event.isStatusChange && (
                            <span className='text-[10px] font-medium text-brand/60'>
                              Status changed
                            </span>
                          )}

                          {/* Date */}
                          <span className='ml-auto text-[10px] text-muted-foreground/50'>
                            {formatDate(event.date)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className='flex h-full min-h-[250px] items-center justify-center rounded-2xl border border-dashed border-border/40 bg-background/20 text-sm text-muted-foreground/60 backdrop-blur-sm'>
                No application events for this period.
              </div>
            )}

            {/* Loading overlay */}
            {loading && (
              <div className='absolute inset-0 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-xl transition-all duration-500'>
                <div className='flex items-center gap-3 rounded-full border border-border/40 bg-card/80 px-5 py-2.5 text-xs font-medium text-foreground/80 shadow-2xl backdrop-blur-md'>
                  <div className='h-4 w-4 animate-spin rounded-full border-2 border-[#a78bfa]/20 border-t-[#a78bfa]' />
                  Loading timeline...
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
