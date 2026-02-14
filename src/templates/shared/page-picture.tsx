import React, { FC } from 'react';
import { useArtboardStore } from '../../store/artboard';
import { cn } from '../../lib/utils';

interface PagePictureProps {
    className?: string;
}

export const PagePicture: FC<PagePictureProps> = ({ className }) => {
    const picture = useArtboardStore((state) => state.resume.picture);

    // Fallback if picture object doesn't exist in our store yet (based on schema)
    // We'll update the store schema in a moment if needed.
    // For now assuming artboard doesn't have picture, so returning null or placeholder

    // Check if store has picture data (it was in the JSON schema but not explicitly in initial artboard state)
    // If not, we might need to add it to store. ResumePage maps it, but store initial state didn't have it.

    if (!picture || picture.hidden || !picture.url) return null;

    return (
        <img
            src={picture.url}
            alt="Profile"
            className={cn("object-cover", className)}
            style={{
                width: picture.size,
                height: picture.size,
                borderRadius: picture.borderRadius,
                border: `${picture.borderWidth}px solid ${picture.borderColor}`,
                boxShadow: `0 0 0 ${picture.shadowWidth}px ${picture.shadowColor}`
                // Note: box-shadow syntax might need adjustment for "shadowWidth" as spread/blur logic
            }}
        />
    );
};
