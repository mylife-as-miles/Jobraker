import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> { value?: number }
export const Progress: React.FC<ProgressProps> = ({value=0, className, ...rest}) => (
  <div className={cn('w-full h-2 rounded bg-neutral-800 overflow-hidden', className)} {...rest}>
    <div className='h-full bg-brand transition-all duration-300' style={{width: `${Math.min(100, Math.max(0, value))}%`}} />
  </div>
);
