import * as React from 'react';

export const HoverCard: React.FC<{children: React.ReactNode; openDelay?:number; closeDelay?:number}> = ({children}) => <>{children}</>;
export const HoverCardTrigger: React.FC<{children: React.ReactNode; asChild?: boolean}> = ({children}) => <>{children}</>;
export const HoverCardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({children, className='', ...rest}) => <div className={"p-2 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 text-sm shadow-lg "+className} {...rest}>{children}</div>;
