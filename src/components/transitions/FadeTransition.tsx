import { motion } from "framer-motion";
import { ReactNode } from "react";

interface FadeTransitionProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export const FadeTransition = ({ 
  children, 
  delay = 0, 
  duration = 0.3,
  className 
}: FadeTransitionProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ 
        duration,
        delay,
        ease: "easeInOut" 
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
