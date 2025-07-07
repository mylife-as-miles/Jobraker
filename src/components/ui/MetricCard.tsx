import React from 'react';
import { Card, CardContent } from './card';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
  variant?: 'default' | 'glass' | 'glow' | 'minimal';
  size?: 'sm' | 'md' | 'lg';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  className,
  variant = 'default',
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  };

  const valueSizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl'
  };

  const getTrendColor = (trend?: string) => {
    switch (trend) {
      case 'up':
        return 'text-green-400';
      case 'down':
        return 'text-red-400';
      default:
        return 'text-[#ffffff]/60';
    }
  };

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'up':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7H7" />
          </svg>
        );
      case 'down':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 7l-9.2 9.2M7 7v10h10" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{ scale: 1.02 }}
      className="transition-transform duration-300"
    >
      <Card variant={variant} className={cn("hover:shadow-lg transition-all duration-300", className)}>
        <CardContent className={sizeClasses[size]}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {icon && (
                  <div className="w-8 h-8 rounded-lg bg-[#1dff00]/20 flex items-center justify-center text-[#1dff00]">
                    {icon}
                  </div>
                )}
                <h3 className="text-sm font-medium text-[#ffffff]/80">{title}</h3>
              </div>
              
              <div className="space-y-1">
                <motion.div
                  key={value}
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className={cn(
                    "font-bold text-[#1dff00] tracking-tight",
                    valueSizeClasses[size]
                  )}
                >
                  {value}
                </motion.div>
                
                {subtitle && (
                  <p className="text-xs text-[#ffffff]/60">{subtitle}</p>
                )}
              </div>
            </div>
            
            {trend && trendValue && (
              <div className={cn(
                "flex items-center gap-1 text-xs font-medium",
                getTrendColor(trend)
              )}>
                {getTrendIcon(trend)}
                <span>{trendValue}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};