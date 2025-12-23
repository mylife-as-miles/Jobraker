import React from 'react';
import { motion } from 'framer-motion';

export const VoiceInteractionVisual = () => {
  return (
    <div className="w-full h-full min-h-[200px] flex items-center justify-center relative overflow-hidden bg-[#0B0C0E]">
      {/* Background Mesh */}
      <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(#1dff00 1px, transparent 1px)',
          backgroundSize: '20px 20px'
      }} />

      {/* Central Pulsing Core */}
      <div className="relative z-10">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-16 h-16 rounded-full bg-[#1dff00]/20 blur-md absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        />
        <div className="w-12 h-12 rounded-full border-2 border-[#1dff00] flex items-center justify-center relative bg-black z-20 shadow-[0_0_15px_rgba(29,255,0,0.3)]">
           <div className="w-4 h-4 rounded-full bg-[#1dff00]" />
        </div>
      </div>

      {/* Audio Waveform Bars - Left */}
      <div className="flex items-center space-x-1 absolute left-1/2 -translate-x-16 mr-4 h-16">
         {[...Array(5)].map((_, i) => (
            <motion.div
               key={`left-${i}`}
               animate={{ height: ["20%", "80%", "30%"] }}
               transition={{
                   duration: 0.5 + Math.random() * 0.5,
                   repeat: Infinity,
                   repeatType: "reverse",
                   delay: i * 0.1
               }}
               className="w-1 bg-[#1dff00]/50 rounded-full"
            />
         ))}
      </div>

      {/* Audio Waveform Bars - Right */}
      <div className="flex items-center space-x-1 absolute left-1/2 translate-x-10 ml-4 h-16">
         {[...Array(5)].map((_, i) => (
            <motion.div
               key={`right-${i}`}
               animate={{ height: ["30%", "90%", "20%"] }}
               transition={{
                   duration: 0.6 + Math.random() * 0.5,
                   repeat: Infinity,
                   repeatType: "reverse",
                   delay: i * 0.1
               }}
               className="w-1 bg-[#1dff00]/50 rounded-full"
            />
         ))}
      </div>

      {/* Status Text */}
      <motion.div
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         className="absolute bottom-4 text-[10px] font-mono text-[#1dff00] uppercase tracking-widest"
      >
         Listening...
      </motion.div>
    </div>
  );
};
