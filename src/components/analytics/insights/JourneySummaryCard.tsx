"use client";

import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { Card } from "../../ui/card";

interface JourneySummaryCardProps {
  narrative: string;
  period: string;
  loading: boolean;
}

export function JourneySummaryCard({
  narrative,
  period,
  loading,
}: JourneySummaryCardProps) {
  const hasData = narrative.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.25 }}
      className="h-full"
    >
      <Card className="relative h-full overflow-hidden border border-border/40 bg-card/40 backdrop-blur-xl shadow-2xl transition-all duration-300">
        {/* Decorative gradient background */}
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[#2dd4bf]/5 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-[#2dd4bf]/5 blur-3xl" />

        <div className="relative z-10 flex h-full flex-col p-5 sm:p-6">
          {/* Header */}
          <div className="mb-6 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#2dd4bf]/25 bg-[#2dd4bf]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#2dd4bf]">
              <BookOpen className="h-3.5 w-3.5" />
              Journey summary
            </div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">
              Your journey at a glance
            </h2>
            <p className="text-sm text-muted-foreground/80">
              Overview for {String(period).toUpperCase()}
            </p>
          </div>

          {/* Narrative / Empty / Loading */}
          <div className="relative min-h-[120px] flex-1">
            {hasData ? (
              <div className="rounded-2xl border border-border/30 bg-background/30 p-5 backdrop-blur-sm">
                <div className="relative">
                  <span className="absolute -top-2 -left-1 text-3xl font-serif text-[#2dd4bf]/30">
                    &ldquo;
                  </span>
                  <p className="pl-4 text-base leading-relaxed text-foreground/85 italic">
                    {narrative}
                  </p>
                  <span className="absolute -bottom-4 right-0 text-3xl font-serif text-[#2dd4bf]/30">
                    &rdquo;
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[120px] items-center justify-center rounded-2xl border border-dashed border-border/40 bg-background/20 text-sm text-muted-foreground/60 backdrop-blur-sm">
                No application data available to generate a summary.
              </div>
            )}

            {/* Loading overlay */}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-xl transition-all duration-500">
                <div className="flex items-center gap-3 rounded-full border border-border/40 bg-card/80 px-5 py-2.5 text-xs font-medium text-foreground/80 shadow-2xl backdrop-blur-md">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#2dd4bf]/20 border-t-[#2dd4bf]" />
                  Composing your journey summary...
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
