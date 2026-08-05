import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'secondary' | 'default' | 'outline';
}

export const Badge: React.FC<BadgeProps> = ({ className, variant='secondary', ...rest }) => {
  const styles = {
    secondary: 'jobraker-gradient-border bg-neutral-800 text-foreground/80 border border-neutral-700',
    default: 'bg-brand text-black',
    outline: 'jobraker-gradient-border border border-neutral-700 text-foreground/80'
  }[variant];
  return <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', styles, className)} {...rest} />;
};
export default Badge;
