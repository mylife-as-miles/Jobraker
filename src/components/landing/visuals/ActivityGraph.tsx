import React from 'react';
import { motion } from 'framer-motion';

export const ActivityGraph = () => {
  return (
    <div className="w-full h-full flex items-end justify-between px-2 gap-2 pb-4">
      {[40, 70, 50, 90, 60, 80, 100].map((height, i) => (
        <motion.div
          key={i}
          className="w-full bg-gradient-to-t from-[#1dff00]/20 to-[#1dff00]"
          style={{ borderRadius: '4px 4px 0 0' }}
          initial={{ height: '0%' }}
          whileInView={{ height: `${height}%` }}
          viewport={{ once: true }} // Should probably loop for the visual effect?
          transition={{
            duration: 1,
            delay: i * 0.1,
            ease: "easeOut"
          }}
        />
      ))}
    </div>
  );
};
