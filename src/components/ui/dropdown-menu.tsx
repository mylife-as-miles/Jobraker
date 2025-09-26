import * as React from 'react';

export const DropdownMenu: React.FC<{children: React.ReactNode}> = ({children}) => <>{children}</>;
export const DropdownMenuTrigger: React.FC<React.HTMLAttributes<HTMLElement>> = ({children, ...rest}) => <span {...rest}>{children}</span>;
export const DropdownMenuContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({children, ...rest}) => <div className="min-w-40 rounded-md border border-neutral-700 bg-neutral-900 p-1 shadow-xl" {...rest}>{children}</div>;
export const DropdownMenuItem: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({children, ...rest}) => <div className="cursor-pointer select-none rounded px-2 py-1.5 text-sm text-neutral-200 hover:bg-neutral-700/40" {...rest}>{children}</div>;
export const DropdownMenuSeparator: React.FC = () => <div className="my-1 h-px bg-neutral-700" />;
