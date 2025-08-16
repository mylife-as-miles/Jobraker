import { forwardRef, useEffect, useRef, useState } from "react";

type BrandIconProps = {
  slug: string;
};

const useDebounceValue = <T,>(value: T, delay = 600): [T, (v: T) => void] => {
  const [debounced, setDebounced] = useState<T>(value);
  const timeoutRef = useRef<number | undefined>(undefined);
  const setValue = (v: T) => {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setDebounced(v), delay);
  };
  return [debounced, setValue];
};

export const BrandIcon = forwardRef<HTMLImageElement, BrandIconProps>(({ slug }, ref) => {
  const [debouncedSlug, setValue] = useDebounceValue(slug, 600);

  useEffect(() => {
    setValue(slug);
  }, [slug]);

  if (!slug) return null;

  if (debouncedSlug === "linkedin") {
    return (
      <img
        ref={ref}
        alt="LinkedIn"
        className="size-5"
        src={`${window.location.origin}/support-logos/linkedin.svg`}
      />
    );
  }

  return (
    <img
      ref={ref}
      alt={debouncedSlug}
      className="size-5"
      src={`https://cdn.simpleicons.org/${debouncedSlug}`}
    />
  );
});

BrandIcon.displayName = "BrandIcon";
