import { motion } from "framer-motion";
import { ReactNode } from "react";

interface ScaleTransitionProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export const ScaleTransition = ({ 
  children, 
  delay = 0,
  duration = 0.3,
  className 
}: ScaleTransitionProps) => {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
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
