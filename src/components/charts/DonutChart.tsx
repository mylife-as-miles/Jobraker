import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

interface DonutChartProps {
  data: Array<{ name: string; value: number; color: string }>;
  size?: number;
}

export const AnimatedDonutChart: React.FC<DonutChartProps> = ({ data, size = 160 }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, rotate: -90 }}
      animate={{ opacity: 1, rotate: 0 }}
      transition={{ duration: 0.8, delay: 0.4 }}
      className="relative"
      style={{ width: size, height: size }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={size * 0.25}
            outerRadius={size * 0.4}
            paddingAngle={2}
            dataKey="value"
            onMouseEnter={onPieEnter}
            onMouseLeave={onPieLeave}
            animationBegin={0}
            animationDuration={1000}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color}
                stroke={activeIndex === index ? '#fff' : 'none'}
                strokeWidth={activeIndex === index ? 2 : 0}
                style={{
                  filter: activeIndex === index ? 'brightness(1.1)' : 'none',
                  transform: activeIndex === index ? 'scale(1.05)' : 'scale(1)',
                  transformOrigin: 'center',
                  transition: 'all 0.2s ease-in-out'
                }}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </motion.div>
  );
};