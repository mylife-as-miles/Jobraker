import { FC } from 'react';
import { useArtboardStore } from '../../store/artboard';
import { cn } from '../../lib/utils';

interface PagePictureProps {
    className?: string;
}

export const PagePicture: FC<PagePictureProps> = ({ className }) => {
    const picture = useArtboardStore((state) => state.resume.data.basics.picture);

    if (!picture || !picture.url || picture.effects?.hidden) return null;

    return (
        <img
            src={picture.url}
            alt="Profile"
            className={cn("object-cover", className)}
            style={{
                width: picture.size,
                height: picture.size,
                borderRadius: picture.borderRadius,
                // Simple border support for now based on boolean
                border: picture.effects?.border ? '4px solid white' : 'none',
                filter: picture.effects?.grayscale ? 'grayscale(100%)' : 'none'
            }}
        />
    );
};
