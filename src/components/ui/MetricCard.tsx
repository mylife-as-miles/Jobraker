import { motion } from "framer-motion";
import { Card, CardContent } from "./card";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  delay?: number;
  className?: string;
  children?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  delay = 0,
  className = "",
  children
}) => {
  if (children) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay }}
        className={className}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
      whileHover={{ scale: 1.02, y: -2 }}
      className={className}
    >
      <Card className="bg-[#ffffff0d] border-[#ffffff1a] backdrop-blur-[20px] hover:bg-[#ffffff15] transition-all duration-300">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-lg">{title}</h3>
            {icon && (
              <div className="w-10 h-10 bg-[#1dff0020] rounded-lg flex items-center justify-center">
                {icon}
              </div>
            )}
          </div>
          
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, delay: delay + 0.2 }}
            className="text-3xl font-bold text-white mb-2"
          >
            {value}
          </motion.div>
          
          {subtitle && (
            <p className="text-[#ffffff80] text-sm">{subtitle}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};