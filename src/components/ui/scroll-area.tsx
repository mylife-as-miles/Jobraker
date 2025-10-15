import * as React from 'react';
import { cn } from '@/lib/utils';

export const ScrollArea: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({className, ...rest}) => (
  <div className={cn('relative overflow-y-auto', className)} {...rest} />
);
