import * as React from 'react';

export const HoverCard: React.FC<{children: React.ReactNode; openDelay?:number; closeDelay?:number}> = ({children}) => <>{children}</>;
export const HoverCardTrigger: React.FC<{children: React.ReactNode; asChild?: boolean}> = ({children}) => <>{children}</>;
export const HoverCardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({children, className='', ...rest}) => (
	<div
		className={
			"p-3 rounded-xl border border-white/15 bg-black/80 text-white text-sm shadow-[0_10px_30px_-10px_rgba(29,255,0,0.25)] backdrop-blur-md "+
			"data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 "+
			className
		}
		{...rest}
	>
		{children}
	</div>
);
