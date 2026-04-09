import { FC } from 'react';
import { useArtboardStore } from '../../store/artboard';
import { cn } from '../../lib/utils';

interface PagePictureProps {
    className?: string;
}

export const PagePicture: FC<PagePictureProps> = ({ className }) => {
    const picture = useArtboardStore((state) => state.resume.data.basics.picture);
    const name = useArtboardStore((state) => state.resume.data.basics.name);

    if (!picture || !picture.url || picture.effects?.hidden) return null;

    return (
        <img
            src={picture.url}
            alt={name ? `${name} profile photo` : 'Profile photo'}
            className={cn(
                'object-cover',
                picture.effects?.border && 'ring-2 ring-white/80 ring-offset-2 ring-offset-transparent',
                className,
            )}
            style={{
                filter: picture.effects?.grayscale ? 'grayscale(100%)' : 'none',
            }}
        />
    );
};