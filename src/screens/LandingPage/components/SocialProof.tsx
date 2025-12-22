import React from 'react';
import { motion } from 'framer-motion';

const companies = [
  "Google", "Meta", "Amazon", "Netflix", "Microsoft", "Apple", "Spotify", "Uber"
];

export const SocialProof = () => {
  return (
    <div className="w-full py-12 bg-black overflow-hidden relative border-y border-[#1dff00]/10">
      <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black z-10 pointer-events-none" />

      <div className="text-center mb-8">
        <p className="text-gray-500 font-mono text-sm tracking-widest uppercase">
          Trusted by engineers at top companies
        </p>
      </div>

      <div className="flex relative overflow-hidden">
        <motion.div
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 20, ease: "linear", repeat: Infinity }}
          className="flex whitespace-nowrap space-x-12 sm:space-x-24"
        >
          {[...companies, ...companies].map((company, i) => (
            <div key={i} className="flex items-center space-x-2 opacity-50 hover:opacity-100 transition-opacity">
               <span className="text-xl md:text-2xl font-bold font-mono text-white/80">{company}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};
