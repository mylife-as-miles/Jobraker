import React, { FC } from 'react';
import * as PhosphorIcons from '@phosphor-icons/react';
import { cn } from '../../lib/utils';

interface PageIconProps {
    icon: string;
    className?: string;
    size?: number;
}

export const PageIcon: FC<PageIconProps> = ({ icon, className, size = 16 }) => {
    if (!icon) return null;

    // Dynamically get icon from Phosphor
    // @ts-ignore
    const IconComponent = PhosphorIcons[icon] || PhosphorIcons.Circle;

    return <IconComponent size={size} className={cn("", className)} />;
};
