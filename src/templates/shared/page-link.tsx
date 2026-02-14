import { FC, ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface PageLinkProps {
    value: string; // Changed from url to value to match usage
    label?: string;
    className?: string; // Allow overriding styles
    icon?: ReactNode;
    type?: 'email' | 'phone' | 'url' | string; // Type for formatting
}

export const PageLink: FC<PageLinkProps> = ({ value, label, className, icon, type }) => {
    if (!value) return null;

    let href = value;
    if (type === 'email' && !value.startsWith('mailto:')) {
        href = `mailto:${value}`;
    } else if (type === 'phone' && !value.startsWith('tel:')) {
        href = `tel:${value}`;
    } else if (type === 'url' && !value.startsWith('http')) {
        href = `https://${value}`;
    }

    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn("hover:underline flex items-center gap-1", className)}
            data-type={type}
        >
            {icon}
            <span>{label || value}</span>
        </a>
    );
};
