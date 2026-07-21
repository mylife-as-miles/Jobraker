import { cn } from "@/lib/utils";

import { useArtboardStore } from "../store/artboard";

type PictureProps = {
  className?: string;
};

export const Picture = ({ className }: PictureProps) => {
  const picture = useArtboardStore((state) => state.resume.data.basics.picture);
  const fontSize = useArtboardStore(
    (state) => state.resume.data.metadata.typography.font.size || 16,
  );

  const hasValidUrl = (() => {
    if (!picture?.url) return false;
    try {
      const url = new URL(picture.url, window.location.origin);
      return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "data:";
    } catch {
      return false;
    }
  })();

  if (!picture || !hasValidUrl || picture.effects.hidden) return null;

  return (
    <img
      src={picture.url}
      alt="Profile"
      className={cn(
        "relative z-20 object-cover",
        picture.effects.border && "border-primary",
        picture.effects.grayscale && "grayscale",
        className,
      )}
      style={{
        maxWidth: `${picture.size}px`,
        aspectRatio: `${picture.aspectRatio}`,
        borderRadius: `${picture.borderRadius}px`,
        borderWidth: `${picture.effects.border ? fontSize / 3 : 0}px`,
      }}
    />
  );
};
