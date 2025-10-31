import { useMemo } from "react";
import { motion } from "framer-motion";
import { Flame, Target, TrendingUp } from "lucide-react";

interface StreakCardProps {
  currentStreak: number;
  longestStreak: number;
  weekProgress: number;
  completionRate: number;
  activeDays?: boolean[];
}

export const StreakCard = ({
  currentStreak,
  longestStreak,
  weekProgress,
  completionRate,
  activeDays = [false, false, false, false, false, false, false],
}: StreakCardProps): JSX.Element => {
  const daysOfWeek = ["M", "T", "W", "T", "F", "S", "S"];

  const progressPercent = useMemo(() => {
    return Math.min(100, (weekProgress / 7) * 100);
  }, [weekProgress]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      whileHover={{ scale: 1.02 }}
      className="relative overflow-hidden h-[220px] rounded-xl border border-white/[0.06] bg-gradient-to-br from-black via-[#0a0a0a] to-black backdrop-blur-[25px] shadow-xl hover:shadow-2xl hover:border-[#1dff00]/50 hover:shadow-[#1dff00]/20 transition-all duration-500"
    >
      <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[#1dff00]/5 blur-3xl" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-[#1dff00]/3 blur-2xl" />

      <div className="relative z-10 p-5 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1dff00]/20 to-[#1dff00]/5 border border-[#1dff00]/30 flex items-center justify-center shadow-inner">
              <Flame className="w-5 h-5 text-[#1dff00]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight">Streak</h3>
              <p className="text-[10px] text-white/50 uppercase tracking-wider font-medium">Daily Activity</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-[#1dff00]">{currentStreak}</div>
            <div className="text-[9px] text-white/40 uppercase tracking-wide">Days</div>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-white/60 uppercase tracking-wider font-medium">Week Progress</span>
            <span className="text-xs font-semibold text-[#1dff00]">{weekProgress}/7</span>
          </div>
          <div className="relative w-full h-2 rounded-full bg-white/[0.08] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
              className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-[#1dff00] to-[#0ea855] shadow-lg shadow-[#1dff00]/50"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-1.5 mb-4">
          {daysOfWeek.map((day, index) => {
            const isActive = activeDays[index];
            return (
              <motion.div
                key={`${day}-${index}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.1 * index }}
                className={`flex-1 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold uppercase tracking-wide transition-all duration-300 ${
                  isActive
                    ? "bg-[#1dff00] text-black shadow-lg shadow-[#1dff00]/40 border border-[#1dff00]"
                    : "bg-white/[0.04] text-white/40 border border-white/[0.08]"
                }`}
              >
                {day}
              </motion.div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 mt-auto">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg p-2.5 hover:border-[#1dff00]/40 hover:bg-[#1dff00]/5 transition-all duration-300"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Flame className="w-3.5 h-3.5 text-[#1dff00]" />
              <span className="text-[9px] text-white/50 uppercase tracking-wider font-medium">Streak</span>
            </div>
            <div className="text-sm font-bold text-white">{currentStreak}d</div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg p-2.5 hover:border-[#1dff00]/40 hover:bg-[#1dff00]/5 transition-all duration-300"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="w-3.5 h-3.5 text-[#1dff00]" />
              <span className="text-[9px] text-white/50 uppercase tracking-wider font-medium">Week</span>
            </div>
            <div className="text-sm font-bold text-white">{weekProgress}/7</div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg p-2.5 hover:border-[#1dff00]/40 hover:bg-[#1dff00]/5 transition-all duration-300"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-[#1dff00]" />
              <span className="text-[9px] text-white/50 uppercase tracking-wider font-medium">Rate</span>
            </div>
            <div className="text-sm font-bold text-white">{Math.round(completionRate)}%</div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};
