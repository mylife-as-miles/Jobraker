import * as React from 'react';

export const TooltipProvider: React.FC<{children: React.ReactNode}> = ({children}) => <>{children}</>;
export const Tooltip: React.FC<{children: React.ReactNode}> = ({children}) => <>{children}</>;
export const TooltipTrigger: React.FC<React.HTMLAttributes<HTMLElement>> = ({children, ...rest}) => <span {...rest}>{children}</span>;
export const TooltipContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({children, ...rest}) => <div role="tooltip" className="z-50 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 shadow" {...rest}>{children}</div>;
