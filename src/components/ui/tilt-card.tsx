import {
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
} from "react";
import { cn } from "@/lib/utils";

type TiltCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  cardClassName?: string;
  maxTilt?: number;
};

/** A pointer-responsive presentation layer for occasional, high-value cards. */
export function TiltCard({
  children,
  className,
  cardClassName,
  maxTilt = 5,
  onPointerMove,
  onPointerEnter,
  onPointerLeave,
  onPointerCancel,
  ...props
}: TiltCardProps) {
  const reset = useCallback((element: HTMLDivElement) => {
    element.classList.remove("is-tilting", "is-hover");
    element.style.setProperty("--tilt-rx", "0deg");
    element.style.setProperty("--tilt-ry", "0deg");
    element.style.setProperty("--tilt-gx", "50%");
    element.style.setProperty("--tilt-gy", "50%");
  }, []);

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const element = event.currentTarget;
      const bounds = element.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
      const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));

      element.classList.add("is-tilting", "is-hover");
      element.style.setProperty("--tilt-rx", `${(0.5 - y) * maxTilt * 2}deg`);
      element.style.setProperty("--tilt-ry", `${(x - 0.5) * maxTilt * 2}deg`);
      element.style.setProperty("--tilt-gx", `${x * 100}%`);
      element.style.setProperty("--tilt-gy", `${y * 100}%`);
      onPointerMove?.(event);
    },
    [maxTilt, onPointerMove],
  );

  return (
    <div
      className={cn("t-tilt", className)}
      onPointerMove={handlePointerMove}
      onPointerEnter={(event) => {
        event.currentTarget.classList.add("is-hover");
        onPointerEnter?.(event);
      }}
      onPointerLeave={(event) => {
        reset(event.currentTarget);
        onPointerLeave?.(event);
      }}
      onPointerCancel={(event) => {
        reset(event.currentTarget);
        onPointerCancel?.(event);
      }}
      {...props}
    >
      <div className={cn("t-tilt-card rounded-2xl", cardClassName)}>
        {children}
        <div aria-hidden="true" className="t-tilt-glare" />
      </div>
    </div>
  );
}
