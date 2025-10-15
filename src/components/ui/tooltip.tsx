import * as React from 'react';

export const TooltipProvider: React.FC<{children: React.ReactNode}> = ({children}) => <>{children}</>;
export const Tooltip: React.FC<{children: React.ReactNode}> = ({children}) => <>{children}</>;
export const TooltipTrigger: React.FC<React.HTMLAttributes<HTMLElement>> = ({children, ...rest}) => <span {...rest}>{children}</span>;
export const TooltipContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({children, className = '', ...rest}) => (
	<div
		role="tooltip"
		className={
			"z-50 rounded-xl border border-white/15 bg-black/80 px-2.5 py-1.5 text-xs text-white shadow-[0_10px_30px_-10px_rgba(29,255,0,0.25)] backdrop-blur-md " +
			"data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 " +
			className
		}
		{...rest}
	>
		{children}
	</div>
);
