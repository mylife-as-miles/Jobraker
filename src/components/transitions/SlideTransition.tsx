import { motion } from "framer-motion";
import { ReactNode } from "react";

interface SlideTransitionProps {
  children: ReactNode;
  direction?: "left" | "right" | "up" | "down";
  delay?: number;
  duration?: number;
  className?: string;
}

export const SlideTransition = ({ 
  children, 
  direction = "up",
  delay = 0,
  duration = 0.4,
  className 
}: SlideTransitionProps) => {
  const directions = {
    left: { x: -50, y: 0 },
    right: { x: 50, y: 0 },
    up: { x: 0, y: 50 },
    down: { x: 0, y: -50 },
  };

  const initial = directions[direction];

  return (
    <motion.div
      initial={{ ...initial, opacity: 0 }}
      animate={{ x: 0, y: 0, opacity: 1 }}
      exit={{ ...initial, opacity: 0 }}
      transition={{ 
        duration,
        delay,
        ease: "easeOut" 
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
