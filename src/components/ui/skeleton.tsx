import * as React from "react";

// Simple utility (fallback if cn not existing)
function cx(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Skeleton – animated placeholder for loading states.
 * Accepts any div props plus optional rounded/full props via className.
 */
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  pulse?: boolean;
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, pulse = true, ...props }, ref) => {
    const [allowed, setAllowed] = React.useState(true);
    React.useEffect(() => {
      try {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => setAllowed(!mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
      } catch { setAllowed(true); }
    }, []);
    return (
      <div
        ref={ref}
        className={cx(
          "bg-white/5 border border-white/10 rounded-md relative overflow-hidden",
          pulse && allowed && "animate-pulse",
          className
        )}
        {...props}
      >
        {allowed && (
          <div className="pointer-events-none absolute inset-0 opacity-0 [animation:fade-in_0.4s_ease forwards]">
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite]" />
          </div>
        )}
      </div>
    );
  }
);
Skeleton.displayName = "Skeleton";

export function SkeletonLines({ lines = 3, className = "space-y-2" }: { lines?: number; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
    </div>
  );
}

/* Tailwind keyframes (ensure these exist or inline using arbitrary):
@keyframes shimmer { 100% { transform: translateX(100%); } }
*/
