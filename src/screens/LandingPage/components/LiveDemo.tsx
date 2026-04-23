import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Search, FileText, Send, Check } from "lucide-react";

const logs = [
  { type: "info", text: "Starting JobRaker agent workflow..." },
  { type: "success", text: "Profile, resume, and preferences loaded." },
  {
    type: "action",
    text: "Scanning for high-fit software roles...",
    icon: <Search className='w-3 h-3 text-brand' />,
  },
  { type: "info", text: "New matches queued for review." },
  {
    type: "process",
    text: "Comparing job descriptions against your profile...",
  },
  { type: "success", text: "Priority role selected for the next application." },
  {
    type: "action",
    text: "Tailoring resume language for this role...",
    icon: <FileText className='w-3 h-3 text-brand' />,
  },
  { type: "success", text: "Resume draft ready for review." },
  {
    type: "action",
    text: "Preparing governed application package...",
    icon: <Send className='w-3 h-3 text-brand' />,
  },
  { type: "success", text: "Application package moved to pipeline." },
  { type: "info", text: "Continuing search cycle..." },
];

export const LiveDemo = () => {
  const [currentLogIndex, setCurrentLogIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLogIndex((prev) => (prev + 1) % logs.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentLogIndex]);

  return (
    <div className='w-full max-w-lg mx-auto font-mono text-xs sm:text-sm'>
      <div className='rounded-lg overflow-hidden border border-brand/30 bg-background/80 backdrop-blur-xl shadow-[0_0_30px_rgba(29,255,0,0.15)]'>
        {/* Terminal Header */}
        <div className='flex items-center justify-between px-4 py-2 bg-brand/10 border-b border-brand/20'>
          <div className='flex items-center space-x-2'>
            <div className='w-3 h-3 rounded-full bg-brand/80'></div>
            <div className='w-3 h-3 rounded-full bg-brand/80'></div>
            <div className='w-3 h-3 rounded-full bg-brand/80'></div>
          </div>
          <div className='flex items-center text-brand/60 space-x-1'>
            <Activity className='w-3 h-3' />
            <span>AI_AGENT_ACTIVE</span>
          </div>
        </div>

        {/* Terminal Body */}
        <div
          ref={scrollRef}
          className='h-[300px] p-4 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-brand/20 scrollbar-track-transparent'
        >
          <AnimatePresence initial={false}>
            {logs.slice(0, currentLogIndex + 1).map((log, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className='flex items-start space-x-2'
              >
                <span className='text-brand/40 shrink-0'>
                  [{new Date().toLocaleTimeString()}]
                </span>
                <div className='flex items-center space-x-2'>
                  {log.type === "success" && (
                    <Check className='w-3 h-3 text-brand' />
                  )}
                  {log.type === "process" && (
                    <div className='w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin' />
                  )}
                  {log.icon}
                  <span
                    className={`${
                      log.type === "success"
                        ? "text-brand"
                        : log.type === "info"
                          ? "text-gray-400"
                          : "text-foreground"
                    }`}
                  >
                    {log.text}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div className='flex items-center space-x-2 mt-2'>
            <span className='text-brand animate-pulse'>_</span>
          </div>
        </div>

        {/* Status Bar */}
        <div className='px-4 py-2 bg-brand/5 border-t border-brand/20 flex justify-between text-brand/60 text-[10px] uppercase tracking-wider'>
          <span>CPU: 12%</span>
          <span>MEM: 432MB</span>
          <span>NET: CONNECTED</span>
        </div>
      </div>
    </div>
  );
};
