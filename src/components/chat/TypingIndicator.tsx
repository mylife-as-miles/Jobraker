import React from 'react';
import { motion } from 'framer-motion';

export const TypingIndicator: React.FC<{ className?: string; dots?: number; }> = ({ className = '', dots = 3 }) => {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {Array.from({ length: dots }).map((_, i) => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full bg-[#1dff00]"
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
};
