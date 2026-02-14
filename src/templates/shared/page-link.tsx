import React, { FC } from 'react';
import { cn } from '../../lib/utils';

interface PageLinkProps {
    url: string;
    label?: string;
    className?: string; // Allow overriding styles
    icon?: React.ReactNode;
}

export const PageLink: FC<PageLinkProps> = ({ url, label, className, icon }) => {
    if (!url) return null;

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn("hover:underline flex items-center gap-1", className)}
        >
            {icon}
            <span>{label || url}</span>
        </a>
    );
};
