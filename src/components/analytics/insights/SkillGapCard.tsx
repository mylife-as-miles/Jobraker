"use client";

import { motion } from "framer-motion";
import { CheckCircle, FileUp, Target } from "lucide-react";
import { Card } from "../../ui/card";
import type { SkillGapItem } from "../../../hooks/insightsComputations";

interface SkillGapCardProps {
  skillGaps: SkillGapItem[];
  hasResume: boolean;
  loading: boolean;
}

export function SkillGapCard({
  skillGaps,
  hasResume,
  loading,
}: SkillGapCardProps) {
  const maxFrequency =
    skillGaps.length > 0 ? Math.max(...skillGaps.map((g) => g.frequency)) : 1;

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
              <Target className='h-3.5 w-3.5' />
              Skill gaps
            </div>
            <h2 className='text-2xl font-bold text-foreground tracking-tight'>
              Skills to develop
            </h2>
            <p className='text-sm text-muted-foreground/80'>
              Top skills from job listings missing on your resume
            </p>
          </div>

          {/* Content / Empty states / Loading */}
          <div className='relative min-h-[180px] flex-1'>
            {!hasResume ? (
              /* No resume uploaded — prompt user */
              <div className='flex h-full min-h-[180px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/40 bg-background/20 backdrop-blur-sm'>
                <div className='flex h-10 w-10 items-center justify-center rounded-full bg-brand/10'>
                  <FileUp className='h-5 w-5 text-brand' />
                </div>
                <p className='text-sm font-medium text-muted-foreground/80'>
                  Upload a resume to unlock skill gap analysis
                </p>
                <p className='text-xs text-muted-foreground/50'>
                  We'll compare your skills against job listings
                </p>
              </div>
            ) : skillGaps.length === 0 ? (
              /* Resume exists but no gaps — strong alignment */
              <div className='flex h-full min-h-[180px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/40 bg-background/20 backdrop-blur-sm'>
                <div className='flex h-10 w-10 items-center justify-center rounded-full bg-brand/10'>
                  <CheckCircle className='h-5 w-5 text-brand' />
                </div>
                <p className='text-sm font-medium text-muted-foreground/80'>
                  Strong skill alignment
                </p>
                <p className='text-xs text-muted-foreground/50'>
                  Your resume skills match the job listings well
                </p>
              </div>
            ) : (
              /* Skill gap list */
              <div className='flex flex-col gap-2.5'>
                {skillGaps.slice(0, 10).map((gap) => {
                  const barWidth = Math.max(
                    (gap.frequency / maxFrequency) * 100,
                    8,
                  );
                  return (
                    <div key={gap.skill} className='flex items-center gap-3'>
                      <span className='w-28 shrink-0 truncate text-sm font-medium text-foreground capitalize'>
                        {gap.skill}
                      </span>
                      <div className='relative flex-1 h-5 rounded-full bg-background/30 overflow-hidden'>
                        <div
                          className='absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand/70 to-brand'
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className='w-8 shrink-0 text-right text-xs font-bold text-muted-foreground/70 tabular-nums'>
                        {gap.frequency}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Loading overlay */}
            {loading && (
              <div className='absolute inset-0 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-xl transition-all duration-500'>
                <div className='flex items-center gap-3 rounded-full border border-border/40 bg-card/80 px-5 py-2.5 text-xs font-medium text-foreground/80 shadow-2xl backdrop-blur-md'>
                  <div className='h-4 w-4 animate-spin rounded-full border-2 border-brand/20 border-t-brand' />
                  Analyzing skill gaps...
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
