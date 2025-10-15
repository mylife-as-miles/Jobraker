import * as React from 'react';

export const Collapsible: React.FC<{open?: boolean; onOpenChange?: (o:boolean)=>void; children: React.ReactNode}> = ({children}) => <>{children}</>;
export const CollapsibleTrigger: React.FC<React.HTMLAttributes<HTMLButtonElement>> = ({children, ...rest}) => <button type="button" {...rest}>{children}</button>;
export const CollapsibleContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({children, ...rest}) => <div {...rest}>{children}</div>;
