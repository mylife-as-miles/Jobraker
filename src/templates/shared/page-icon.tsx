import { FC } from 'react';
import * as PhosphorIcons from '@phosphor-icons/react';
import { cn } from '../../lib/utils';

interface PageIconProps {
    name: string;
    className?: string;
    size?: number;
}

export const PageIcon: FC<PageIconProps> = ({ name, className, size = 16 }) => {
    if (!name) return null;

    // Dynamically get icon from Phosphor
    // @ts-ignore
    const IconComponent = PhosphorIcons[name] || PhosphorIcons.Circle;

    return <IconComponent size={size} className={cn("", className)} />;
};
