import React from 'react';
import { motion } from 'framer-motion';
import { LiveDemo } from './LiveDemo';

export const DashboardPreview = () => {
  return (
    // Adjusted negative margin to fit better with the new taller/spaced HeroSection
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 mt-[-80px] sm:mt-[-120px] md:mt-[-150px] lg:mt-[-200px] relative z-20">
      <motion.div
        initial={{ y: 100, opacity: 0, rotateX: 20 }}
        whileInView={{ y: 0, opacity: 1, rotateX: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative perspective-1000"
      >
        {/* Glow behind the dashboard */}
        <div className="absolute inset-0 bg-[#1dff00] blur-[100px] opacity-10 rounded-full transform scale-75 z-0" />

        {/* Dashboard Container */}
        <div className="relative bg-[#0a0a0a] rounded-xl border border-[#1dff00]/20 shadow-[0_0_50px_rgba(29,255,0,0.15)] overflow-hidden backdrop-blur-sm z-10">

          {/* Mock Browser Bar */}
          <div className="h-10 bg-black/50 border-b border-[#1dff00]/10 flex items-center px-4 space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
            <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
            <div className="ml-4 flex-1 bg-black/30 h-6 rounded border border-[#1dff00]/10 flex items-center px-3 text-[10px] text-gray-600 font-mono">
              app.jobraker.io/dashboard
            </div>
          </div>

          {/* Main Interface Content - Reusing LiveDemo for the 'terminal' feel inside the dashboard */}
          <div className="p-1">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
                {/* Sidebar Mock */}
                <div className="hidden md:block col-span-1 bg-black/20 border-r border-[#1dff00]/10 p-4 space-y-4">
                   <div className="h-8 w-24 bg-[#1dff00]/10 rounded mb-6" />
                   <div className="h-4 w-full bg-white/5 rounded" />
                   <div className="h-4 w-3/4 bg-white/5 rounded" />
                   <div className="h-4 w-5/6 bg-white/5 rounded" />
                   <div className="mt-8 h-32 w-full border border-[#1dff00]/20 rounded bg-black/40 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1dff00]/10 to-transparent" />
                   </div>
                </div>

                {/* Main Area */}
                <div className="col-span-2 p-4 md:p-8 bg-black/40 min-h-[400px] flex flex-col items-center justify-center">
                   <div className="mb-6 text-center">
                      <h3 className="text-[#1dff00] font-mono text-xl mb-2">ACTIVE AGENT SESSION</h3>
                      <p className="text-gray-500 text-xs font-mono">ID: 8f92-a1b2-c3d4</p>
                   </div>
                   <LiveDemo />
                </div>
             </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
