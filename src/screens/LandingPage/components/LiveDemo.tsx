import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Search, FileText, Send, Check } from 'lucide-react';

const logs = [
  { type: 'info', text: 'Initializing JobRaker AI Core v2.4...' },
  { type: 'success', text: 'Connected to global job board network.' },
  { type: 'action', text: 'Scanning for "Senior Software Engineer" roles...', icon: <Search className="w-3 h-3 text-[#1dff00]" /> },
  { type: 'info', text: 'Found 142 new matches in last 24h.' },
  { type: 'process', text: 'Analyzing job descriptions for keyword density...' },
  { type: 'success', text: 'Target identified: TechCorp Inc. (Match: 98%)' },
  { type: 'action', text: 'Tailoring resume for ATS compatibility...', icon: <FileText className="w-3 h-3 text-[#1dff00]" /> },
  { type: 'success', text: 'Resume optimized. Keywords injected.' },
  { type: 'action', text: 'Submitting application...', icon: <Send className="w-3 h-3 text-[#1dff00]" /> },
  { type: 'success', text: 'Application sent successfully!' },
  { type: 'info', text: 'Waiting for next cycle...' },
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
    <div className="w-full max-w-lg mx-auto font-mono text-xs sm:text-sm">
      <div className="rounded-lg overflow-hidden border border-[#1dff00]/30 bg-black/80 backdrop-blur-xl shadow-[0_0_30px_rgba(29,255,0,0.15)]">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#1dff00]/10 border-b border-[#1dff00]/20">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          </div>
          <div className="flex items-center text-[#1dff00]/60 space-x-1">
            <Activity className="w-3 h-3" />
            <span>AI_AGENT_ACTIVE</span>
          </div>
        </div>

        {/* Terminal Body */}
        <div
          ref={scrollRef}
          className="h-[300px] p-4 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-[#1dff00]/20 scrollbar-track-transparent"
        >
          <AnimatePresence initial={false}>
            {logs.slice(0, currentLogIndex + 1).map((log, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start space-x-2"
              >
                <span className="text-[#1dff00]/40 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                <div className="flex items-center space-x-2">
                  {log.type === 'success' && <Check className="w-3 h-3 text-[#1dff00]" />}
                  {log.type === 'process' && <div className="w-3 h-3 border-2 border-[#1dff00] border-t-transparent rounded-full animate-spin" />}
                  {log.icon}
                  <span className={`${
                    log.type === 'success' ? 'text-[#1dff00]' :
                    log.type === 'info' ? 'text-gray-400' :
                    'text-white'
                  }`}>
                    {log.text}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div className="flex items-center space-x-2 mt-2">
             <span className="text-[#1dff00] animate-pulse">_</span>
          </div>
        </div>

        {/* Status Bar */}
        <div className="px-4 py-2 bg-[#1dff00]/5 border-t border-[#1dff00]/20 flex justify-between text-[#1dff00]/60 text-[10px] uppercase tracking-wider">
          <span>CPU: 12%</span>
          <span>MEM: 432MB</span>
          <span>NET: CONNECTED</span>
        </div>
      </div>
    </div>
  );
};
