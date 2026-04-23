import { useMemo } from "react";
import { motion } from "framer-motion";
import { Flame, Target, TrendingUp } from "lucide-react";

interface StreakCardProps {
  currentStreak: number;
  weekProgress: number;
  completionRate: number;
  activeDays?: boolean[];
}

export const StreakCard = ({
  currentStreak,
  weekProgress,
  completionRate,
  activeDays = [false, false, false, false, false, false, false],
}: StreakCardProps): JSX.Element => {
  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Get current day of week (0 = Sunday, 1 = Monday, etc.)
  const currentDayIndex = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    // Convert to Monday = 0, Sunday = 6
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  }, []);

  const progressPercent = useMemo(() => {
    return Math.min(100, (weekProgress / 7) * 100);
  }, [weekProgress]);

  return (
    <div className='relative overflow-hidden min-h-[200px] sm:min-h-[220px] rounded-xl border border-foreground/10 bg-card backdrop-blur-text-brand [25px]'>
      <div className='absolute -top-24 -right-24 w-64 h-64 rounded-full bg-brand/5 blur-3xl' />
      <div className='absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-brand/3 blur-2xl' />

      {/* Content */}
      <div className='relative z-10 p-4 sm:p-5 h-full flex flex-col'>
        {/* Header Row */}
        <div className='flex items-center justify-between mb-3 sm:mb-4'>
          <div className='flex items-center gap-2 sm:gap-3'>
            <div className='w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-brand/20 to-brand/5 border border-brand/30 flex items-center justify-center shadow-inner'>
              <Flame className='w-4 h-4 sm:w-5 sm:h-5 text-brand' />
            </div>
            <div>
              <h3 className='text-sm sm:text-base font-semibold text-foreground tracking-tight'>
                Streak
              </h3>
              <p className='text-[9px] sm:text-[10px] text-foreground/50 uppercase tracking-wider font-medium'>
                Daily Activity
              </p>
            </div>
          </div>
          <div className='text-right'>
            <div className='text-xl sm:text-2xl font-bold text-brand'>
              {currentStreak}
            </div>
            <div className='text-[8px] sm:text-[9px] text-foreground/40 uppercase tracking-wide'>
              Days
            </div>
          </div>
        </div>

        {/* Week Progress Bar */}
        <div className='mb-3 sm:mb-4'>
          <div className='flex items-center justify-between mb-1.5 sm:mb-2'>
            <span className='text-[9px] sm:text-[10px] text-foreground/60 uppercase tracking-wider font-medium'>
              Week Progress
            </span>
            <span className='text-xs font-semibold text-brand'>
              {weekProgress}/7
            </span>
          </div>
          <div className='relative w-full h-2 rounded-full bg-foreground/[0.08] overflow-hidden'>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
              className='absolute top-0 left-0 h-full rounded-full bg-brand'
            />
          </div>
        </div>

        {/* Day Pills */}
        <div className='flex items-center justify-between gap-1 sm:gap-1.5 mb-3 sm:mb-4'>
          {daysOfWeek.map((day, index) => {
            const isActive = activeDays[index];
            const isToday = index === currentDayIndex;
            return (
              <motion.div
                key={`${day}-${index}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.1 * index }}
                className={`flex-1 h-8 sm:h-9 rounded-lg flex items-center justify-center text-[9px] sm:text-[10px] font-bold tracking-wide transition-all duration-300 relative ${
                  isActive
                    ? "bg-brand text-black border border-brand"
                    : "bg-foreground/[0.04] text-foreground/40 border border-foreground/[0.08]"
                }`}
              >
                {day}
                {isToday && (
                  <div className='absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand' />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Bottom Metrics Cards */}
        <div className='flex items-center gap-1.5 sm:gap-2 mt-auto'>
          {/* Streak Metric */}
          <div className='flex-1 bg-foreground/[0.04] border border-foreground/[0.08] rounded-lg p-2 sm:p-2.5'>
            <div className='flex items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1'>
              <Flame className='w-3 h-3 sm:w-3.5 sm:h-3.5 text-brand' />
              <span className='text-[8px] sm:text-[9px] text-foreground/50 uppercase tracking-wider font-medium'>
                Streak
              </span>
            </div>
            <div className='text-xs sm:text-sm font-bold text-foreground'>
              {currentStreak}d
            </div>
          </div>

          {/* Week Metric */}
          <div className='flex-1 bg-foreground/[0.04] border border-foreground/[0.08] rounded-lg p-2 sm:p-2.5  '>
            <div className='flex items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1'>
              <Target className='w-3 h-3 sm:w-3.5 sm:h-3.5 text-brand' />
              <span className='text-[8px] sm:text-[9px] text-foreground/50 uppercase tracking-wider font-medium'>
                Week
              </span>
            </div>
            <div className='text-xs sm:text-sm font-bold text-foreground'>
              {weekProgress}/7
            </div>
          </div>

          {/* Completion Metric */}
          <div className='flex-1 bg-foreground/[0.04] border border-foreground/[0.08] rounded-lg p-2 sm:p-2.5'>
            <div className='flex items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1'>
              <TrendingUp className='w-3 h-3 sm:w-3.5 sm:h-3.5 text-brand' />
              <span className='text-[8px] sm:text-[9px] text-foreground/50 uppercase tracking-wider font-medium'>
                Rate
              </span>
            </div>
            <div className='text-xs sm:text-sm font-bold text-foreground'>
              {Math.round(completionRate)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
