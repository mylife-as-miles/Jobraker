import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { motion } from "framer-motion";
import { Building2, AlertCircle, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { useNotifications } from "../../../hooks/useNotifications";

// Using realtime notifications; no local interface needed here

export const OverviewPage = (): JSX.Element => {
  const [selectedPeriod, setSelectedPeriod] = useState("1 Month");
  const { items: notifItems, loading: notifLoading } = useNotifications(6);
  const mappedNotifs = useMemo(() => {
    return notifItems.map(n => ({
      id: n.id,
      type: n.type as any,
      title: n.title,
      message: n.message || '',
      time: new Date(n.created_at).toLocaleString(),
      icon: (
        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center"
             style={{ backgroundColor: n.type === 'company' ? '#000' : n.type === 'application' ? '#4285f4' : n.type === 'interview' ? '#0077b5' : '#ff6b6b' }}>
          {n.type === 'company' ? (
            <span className="text-[#1dff00] font-bold text-xs sm:text-sm">{(n.company || 'C').charAt(0).toUpperCase()}</span>
          ) : n.type === 'application' ? (
            <span className="text-[#1dff00] font-bold text-xs sm:text-sm">{(n.company || 'A').charAt(0).toUpperCase()}</span>
          ) : n.type === 'interview' ? (
            <Building2 className="w-3 h-3 sm:w-4 sm:h-4 text-[#1dff00]" />
          ) : (
            <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 text-[#1dff00]" />
          )}
        </div>
      )
    }));
  }, [notifItems]);

  // Realtime clock and dynamic calendar state
  const [now, setNow] = useState<Date>(new Date());
  // Month being viewed in the calendar (defaults to current month)
  const [viewDate, setViewDate] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const monthLabel = useMemo(() =>
    viewDate.toLocaleString(undefined, { month: 'long', year: 'numeric' }),
  [viewDate]);

  const timeLabel = useMemo(() =>
    now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  [now]);

  // Build a 6x7 calendar grid (42 cells)
  const monthGrid = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startDay = firstOfMonth.getDay(); // 0=Sun..6=Sat
    const cells: { date: Date; inCurrentMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const dayNum = i - startDay + 1; // can be <=0 or > daysInMonth
      const cellDate = new Date(year, month, dayNum);
      cells.push({
        date: cellDate,
        inCurrentMonth: cellDate.getMonth() === month,
      });
    }
    return cells;
  }, [viewDate]);

  const isToday = (d: Date) =>
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  return (
    <div className="min-h-screen bg-black">
      <div className="w-full max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 xl:p-8">
        {/* Responsive overview layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Left Column - Applications and Match Score */}
          <div className="xl:col-span-2 space-y-4 sm:space-y-6">
            {/* Applications Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              whileHover={{ scale: 1.02 }}
              className="transition-transform duration-300"
            >
              <Card className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/20 backdrop-blur-[25px] p-4 sm:p-6 rounded-2xl shadow-xl hover:shadow-2xl hover:border-[#1dff00]/50 hover:shadow-[#1dff00]/20 transition-all duration-500">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-2">
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">Applications</h2>
                  <div className="text-left sm:text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                      className="text-[#1dff00] hover:bg-[#1dff00]/10 hover:scale-110 p-1 sm:p-2 transition-all duration-300"
                    >
                      <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                    <h2 className="text-sm sm:text-lg lg:text-xl font-bold text-white">{monthLabel}</h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                      className="text-[#1dff00] hover:bg-[#1dff00]/10 hover:scale-110 p-1 sm:p-2 transition-all duration-300"
                    >
                      <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                          : "text-[#888888] hover:text-[#1dff00] hover:bg-[#1dff00]/10"

                  {/* Live current time */}
                  <div className="text-center text-[10px] sm:text-xs text-[#888888] mb-3">
                    Current time: <span className="text-[#1dff00] font-medium">{timeLabel}</span>
                  </div>
                      }`}
                    >
                      {period}
                    </Button>
                  ))}
                </div>

                {/* Stats */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-8 space-y-4 sm:space-y-0 mb-4 sm:mb-6">
                  <motion.div 
                    className="text-center sm:text-left"
                  <div className="grid grid-cols-7 gap-1">
                    {monthGrid.map(({ date, inCurrentMonth }, idx) => (
                      <motion.div
                        key={`${date.toISOString()}-${idx}`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.97 }}
                        className={`relative text-center text-xs py-1 sm:py-2 rounded-lg transition-all duration-200 cursor-pointer ${
                          isToday(date) && inCurrentMonth
                            ? 'bg-[#1dff00] text-black font-bold shadow-lg'
                            : inCurrentMonth
                            ? 'text-[#888888] hover:bg-[#1dff00]/10 hover:text-[#1dff00]'
                            : 'text-[#333333] hover:bg-[#1dff00]/10'
                        }`}
                      >
                        {date.getDate()}
                      </motion.div>
                    ))}
                  </div>
            </motion.div>

            {/* Match Score Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              whileHover={{ scale: 1.02 }}
              className="transition-transform duration-300"
            >
              <Card className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/20 backdrop-blur-[25px] p-4 sm:p-6 rounded-2xl shadow-xl hover:shadow-2xl hover:border-[#1dff00]/50 hover:shadow-[#1dff00]/20 transition-all duration-500">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">Match Score Average</h2>
                </div>

                <div className="mb-4 sm:mb-6">
                  <motion.div 
                    className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black text-[#1dff00] mb-2 drop-shadow-lg"
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    56%
                  </motion.div>
                  <p className="text-xs sm:text-sm lg:text-base text-[#888888] leading-relaxed">Ratio of jobs found to jobs successfully applied</p>
                </div>

                {/* Bar Chart */}
                <div className="flex items-end justify-between h-24 sm:h-28 lg:h-32 xl:h-36 space-x-2 sm:space-x-4">
                  <motion.div 
                    className="flex flex-col items-center space-y-1 sm:space-y-2 flex-1"
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <div className="w-full max-w-[40px] sm:max-w-[48px] lg:max-w-[56px] bg-gradient-to-t from-[#3B82F6] to-[#60A5FA] rounded-t-lg hover:shadow-lg transition-shadow duration-300" style={{ height: '60px' }}></div>
                    <div className="text-xs sm:text-sm font-bold text-[#1dff00]">104</div>
                    <div className="text-xs text-[#666666] text-center leading-tight">Jobs found</div>
                  </motion.div>
                  <motion.div 
                    className="flex flex-col items-center space-y-1 sm:space-y-2 flex-1"
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <div className="w-full max-w-[40px] sm:max-w-[48px] lg:max-w-[56px] bg-gradient-to-t from-[#1dff00] to-[#4ade80] rounded-t-lg hover:shadow-lg transition-shadow duration-300" style={{ height: '35px' }}></div>
                    <div className="text-xs sm:text-sm font-bold text-[#1dff00]">58</div>
                    <div className="text-xs text-[#666666] text-center leading-tight">Applications</div>
                  </motion.div>
                  <motion.div 
                    className="flex flex-col items-center space-y-1 sm:space-y-2 flex-1"
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <div className="w-full max-w-[40px] sm:max-w-[48px] lg:max-w-[56px] bg-gradient-to-t from-[#F59E0B] to-[#FCD34D] rounded-t-lg hover:shadow-lg transition-shadow duration-300" style={{ height: '10px' }}></div>
                    <div className="text-xs sm:text-sm font-bold text-[#1dff00]">15</div>
                    <div className="text-xs text-[#666666] text-center leading-tight">Interviews</div>
                  </motion.div>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Right Column - Notifications and Calendar */}
          <div className="space-y-4 sm:space-y-6">
            {/* Notifications */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              whileHover={{ scale: 1.02 }}
              className="transition-transform duration-300"
            >
              <Card className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/20 backdrop-blur-[25px] p-4 sm:p-6 rounded-2xl shadow-xl hover:shadow-2xl hover:border-[#1dff00]/50 hover:shadow-[#1dff00]/20 transition-all duration-500">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">Notification</h2>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-white hover:text-white/80 hover:bg-white/10 hover:scale-105 transition-all duration-300 text-xs sm:text-sm"
                  >
                    See more
                  </Button>
                </div>

                <div className="space-y-3 sm:space-y-4">
                  {mappedNotifs.length === 0 && !notifLoading && (
                    <div className="flex items-center justify-center p-8 border border-dashed border-[#1dff00]/30 rounded-xl bg-[#0b0b0b]">
                      <div className="text-center">
                        <div className="mx-auto w-12 h-12 rounded-full bg-[#1dff00]/10 flex items-center justify-center mb-3">
                          <Inbox className="w-6 h-6 text-[#1dff00]" />
                        </div>
                        <p className="text-white font-medium">You’re all caught up</p>
                        <p className="text-xs text-[#888]">No notifications yet. Activity will show up here.</p>
                      </div>
                    </div>
                  )}
                  {mappedNotifs.map((notification, index) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 0.1 * index }}
                      whileHover={{ scale: 1.02, x: 4 }}
                      className="flex items-start space-x-2 sm:space-x-3 p-2 sm:p-3 bg-gradient-to-r from-[#111111] to-[#0a0a0a] rounded-lg border border-[#1dff00]/10 hover:bg-gradient-to-r hover:from-[#1dff00]/10 hover:to-[#0a8246]/10 hover:border-[#1dff00]/30 transition-all duration-300 cursor-pointer"
                    >
                      {notification.icon}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm text-[#1dff00] font-medium leading-relaxed">{notification.title}</p>
                        <p className="text-xs text-[#666666] mt-1">{notification.time}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Calendar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              whileHover={{ scale: 1.02 }}
              className="transition-transform duration-300"
            >
              <Card className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/20 backdrop-blur-[25px] p-4 sm:p-6 rounded-2xl shadow-xl hover:shadow-2xl hover:border-[#1dff00]/50 hover:shadow-[#1dff00]/20 transition-all duration-500">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-[#1dff00] hover:bg-[#1dff00]/10 hover:scale-110 p-1 sm:p-2 transition-all duration-300"
                  >
                    <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                  <h2 className="text-sm sm:text-lg lg:text-xl font-bold text-white">August, 2025</h2>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-[#1dff00] hover:bg-[#1dff00]/10 hover:scale-110 p-1 sm:p-2 transition-all duration-300"
                  >
                    <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                </div>

                {/* Calendar Header */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => (
                    <div key={day} className="text-center text-xs text-[#666666] font-medium py-1 sm:py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Previous month days */}
                  {[27, 28, 29, 30, 31].map((day) => (
                    <div key={`prev-${day}`} className="text-center text-xs text-[#333333] py-1 sm:py-2 hover:bg-[#1dff00]/10 rounded transition-colors duration-200">
                      {day}
                    </div>
                  ))}
                  
                  {/* Current month days */}
                  {calendarDays.map((day) => (
                    <motion.div
                      key={day}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      className={`text-center text-xs py-1 sm:py-2 rounded-lg transition-all duration-200 cursor-pointer ${
                        day === today
                          ? 'bg-[#1dff00] text-black font-bold shadow-lg'
                          : day === 20 || day === 21
                          ? 'text-[#1dff00] font-medium relative hover:bg-[#1dff00]/10'
                          : 'text-[#888888] hover:bg-[#1dff00]/10 hover:text-[#1dff00]'
                      }`}
                    >
                      {day}
                      {(day === 20 || day === 21) && (
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-[#1dff00] rounded-full"></div>
                      )}
                    </motion.div>
                  ))}
                  
                  {/* Next month days */}
                  {[1, 2].map((day) => (
                    <div key={`next-${day}`} className="text-center text-xs text-[#333333] py-1 sm:py-2 hover:bg-[#1dff00]/10 rounded transition-colors duration-200">
                      {day}
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};