import React from 'react';
import { motion } from 'framer-motion';

export const ScanningVisual = () => {
  return (
    <div className="w-full h-full flex items-center justify-center p-8 relative overflow-hidden">
      {/* Document */}
      <div className="w-32 h-44 bg-white/10 border border-white/20 rounded-md p-3 relative">
         <div className="w-12 h-12 bg-gray-700/50 rounded-full mb-3" />
         <div className="w-full h-2 bg-gray-700/50 rounded mb-2" />
         <div className="w-2/3 h-2 bg-gray-700/50 rounded mb-4" />

         <div className="w-full h-1 bg-gray-700/30 rounded mb-1" />
         <div className="w-full h-1 bg-gray-700/30 rounded mb-1" />
         <div className="w-full h-1 bg-gray-700/30 rounded mb-1" />

         {/* Scanning Beam */}
         <motion.div
           className="absolute left-0 right-0 h-1 bg-[#1dff00] shadow-[0_0_15px_#1dff00] z-10"
           initial={{ top: 0, opacity: 0 }}
           animate={{
             top: ['0%', '100%'],
             opacity: [0, 1, 1, 0]
           }}
           transition={{
             duration: 2,
             repeat: Infinity,
             ease: "linear"
           }}
         />
      </div>
    </div>
  );
};
