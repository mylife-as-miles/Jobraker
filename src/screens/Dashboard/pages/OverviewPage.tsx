import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { motion } from "framer-motion";
import { Building2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";

interface Notification {
  id: string;
  type: "interview" | "application" | "system" | "company";
  title: string;
  message: string;
  time: string;
  icon: React.ReactNode;
  company?: string;
}

export const OverviewPage = (): JSX.Element => {
  const [selectedPeriod, setSelectedPeriod] = useState("1 Month");

  const mockNotifications: Notification[] = [
    {
      id: "1",
      type: "interview",
      title: "You have an interview on August 16.",
      message: "Just now",
      time: "Just now",
      icon: <div className="w-6 h-6 sm:w-8 sm:h-8 bg-[#0077b5] rounded-full flex items-center justify-center"><Building2 className="w-3 h-3 sm:w-4 sm:h-4 text-white" /></div>
    },
    {
      id: "2",
      type: "application",
      title: "Your application to Google is now in the interview stage.",
      message: "2mins ago",
      time: "2mins ago",
      icon: <div className="w-6 h-6 sm:w-8 sm:h-8 bg-[#4285f4] rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm">G</div>,
      company: "Google"
    },
    {
      id: "3",
      type: "system",
      title: "You have run out of applications; automatic application paused.",
      message: "Yesterday",
      time: "Yesterday",
      icon: <div className="w-6 h-6 sm:w-8 sm:h-8 bg-[#ff6b6b] rounded-full flex items-center justify-center"><AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" /></div>
    },
    {
      id: "4",
      type: "company",
      title: "JobRaker just applied to a position at Apple Inc.",
      message: "Just now",
      time: "Just now",
      icon: <div className="w-6 h-6 sm:w-8 sm:h-8 bg-[#000000] rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm">A</div>,
      company: "Apple"
    }
  ];

  // Calendar data for August 2025
  const calendarDays = Array.from({ length: 31 }, (_, i) => i + 1);
  const today = 1; // August 1st highlighted in the design

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="flex-1 flex flex-col min-w-0 max-w-full mx-auto w-full sm:w-[95vw] md:w-[80vw] lg:w-[60vw] xl:w-[40vw] p-3 sm:p-6">
        {/* Responsive overview layout */}
        <div className="flex flex-col gap-4">
          {/* Left Column - Applications and Match Score */}
          <div className="xl:col-span-2 space-y-4 sm:space-y-6">
            {/* Applications Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-4 sm:p-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-white">Applications</h2>
                  <div className="text-left sm:text-right">
                    <span className="text-xl sm:text-2xl font-bold text-white">0/3</span>
                  </div>
                </div>

                {/* Period Selector */}
                <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
                  {["Today", "1 Week", "1 Month"].map((period) => (
                    <Button
                      key={period}
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPeriod(period)}
                      className={`text-xs sm:text-sm ${
                        selectedPeriod === period
                          ? "bg-[#1dff00] text-black hover:bg-[#1dff00]/90"
                          : "text-[#ffffff80] hover:text-white hover:bg-[#ffffff1a]"
                      } transition-all duration-200`}
                    >
                      {period}
                    </Button>
                  ))}
                </div>

                {/* Stats */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-8 space-y-4 sm:space-y-0 mb-4 sm:mb-6">
                  <div className="text-center sm:text-left">
                    <div className="text-2xl sm:text-3xl font-bold text-white mb-1">58</div>
                    <div className="text-xs sm:text-sm text-white/70">Applications</div>
                  </div>
                  <div className="text-center sm:text-left">
                    <div className="text-2xl sm:text-3xl font-bold text-white mb-1">15</div>
                    <div className="text-xs sm:text-sm text-white/70">Interviews</div>
                  </div>
                </div>

                {/* Chart Area */}
                <div className="h-16 sm:h-20 lg:h-24 relative">
                  <svg className="w-full h-full" viewBox="0 0 400 100">
                    <defs>
                      <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#1dff00" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#0a8246" stopOpacity="0.8" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 0 60 Q 100 40 200 50 T 400 30"
                      stroke="url(#lineGradient)"
                      strokeWidth="3"
                      fill="none"
                      className="drop-shadow-lg"
                    />
                    <circle cx="400" cy="30" r="4" fill="#1dff00" className="drop-shadow-lg" />
                  </svg>
                </div>
              </Card>
            </motion.div>

            {/* Match Score Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-4 sm:p-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-xl font-bold text-white">Match Score Average</h2>
                </div>

                <div className="mb-4 sm:mb-6">
                  <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#1dff00] mb-2 drop-shadow-lg">56%</div>
                  <p className="text-xs sm:text-sm text-white/70 leading-relaxed">Ratio of jobs found to jobs successfully applied</p>
                </div>

                {/* Bar Chart */}
                <div className="flex items-end justify-between h-24 sm:h-28 lg:h-32 space-x-2 sm:space-x-4">
                  <div className="flex flex-col items-center space-y-1 sm:space-y-2 flex-1">
                    <div className="w-full max-w-[40px] sm:max-w-[48px] bg-gradient-to-t from-[#3B82F6] to-[#60A5FA] rounded-t-lg" style={{ height: '60px' }}></div>
                    <div className="text-xs font-bold text-white">104</div>
                    <div className="text-xs text-white/60 text-center leading-tight">Jobs found</div>
                  </div>
                  <div className="flex flex-col items-center space-y-1 sm:space-y-2 flex-1">
                    <div className="w-full max-w-[40px] sm:max-w-[48px] bg-gradient-to-t from-[#1dff00] to-[#4ade80] rounded-t-lg" style={{ height: '35px' }}></div>
                    <div className="text-xs font-bold text-white">58</div>
                    <div className="text-xs text-white/60 text-center leading-tight">Applications</div>
                  </div>
                  <div className="flex flex-col items-center space-y-1 sm:space-y-2 flex-1">
                    <div className="w-full max-w-[40px] sm:max-w-[48px] bg-gradient-to-t from-[#F59E0B] to-[#FCD34D] rounded-t-lg" style={{ height: '10px' }}></div>
                    <div className="text-xs font-bold text-white">15</div>
                    <div className="text-xs text-white/60 text-center leading-tight">Interviews</div>
                  </div>
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
            >
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-4 sm:p-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-xl font-bold text-white">Notification</h2>
                  <Button variant="ghost" size="sm" className="text-[#1dff00] hover:text-[#1dff00]/80 text-xs sm:text-sm">
                    See more
                  </Button>
                </div>

                <div className="space-y-3 sm:space-y-4">
                  {mockNotifications.map((notification, index) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 0.1 * index }}
                      className="flex items-start space-x-2 sm:space-x-3 p-2 sm:p-3 bg-gradient-to-r from-[#ffffff08] to-[#ffffff05] rounded-lg border border-[#ffffff15] hover:bg-gradient-to-r hover:from-[#ffffff12] hover:to-[#ffffff08] transition-all duration-300"
                    >
                      {notification.icon}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm text-white font-medium leading-relaxed">{notification.title}</p>
                        <p className="text-xs text-white/60 mt-1">{notification.time}</p>
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
            >
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-4 sm:p-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <Button variant="ghost" size="sm" className="text-white hover:bg-[#ffffff1a] p-1 sm:p-2">
                    <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                  <h2 className="text-sm sm:text-lg font-bold text-white">August, 2025</h2>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-[#ffffff1a] p-1 sm:p-2">
                    <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                </div>

                {/* Calendar Header */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => (
                    <div key={day} className="text-center text-xs text-white/60 font-medium py-1 sm:py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Previous month days */}
                  {[27, 28, 29, 30, 31].map((day) => (
                    <div key={`prev-${day}`} className="text-center text-xs text-white/30 py-1 sm:py-2">
                      {day}
                    </div>
                  ))}
                  
                  {/* Current month days */}
                  {calendarDays.map((day) => (
                    <div
                      key={day}
                      className={`text-center text-xs py-1 sm:py-2 rounded-lg transition-all duration-200 ${
                        day === today
                          ? 'bg-[#1dff00] text-black font-bold'
                          : day === 20 || day === 21
                          ? 'text-[#1dff00] font-medium relative'
                          : 'text-white hover:bg-[#ffffff1a]'
                      }`}
                    >
                      {day}
                      {(day === 20 || day === 21) && (
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-[#1dff00] rounded-full"></div>
                      )}
                    </div>
                  ))}
                  
                  {/* Next month days */}
                  {[1, 2].map((day) => (
                    <div key={`next-${day}`} className="text-center text-xs text-white/30 py-1 sm:py-2">
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