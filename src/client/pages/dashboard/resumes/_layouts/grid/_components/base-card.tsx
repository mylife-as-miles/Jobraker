import { Card } from "@reactive-resume/ui";
import { cn } from "@reactive-resume/utils";
import { forwardRef } from "react";
import Tilt from "react-parallax-tilt";

import { defaultTiltProps } from "@/client/constants/parallax-tilt";

type Props = {
  className?: string;
  onClick?: () => void;
  onDoubleClick?: () => void;
  children?: React.ReactNode;
};

export const BaseCard = forwardRef<HTMLDivElement, Props>(
  ({ children, className, onClick, onDoubleClick }, ref) => (
    <div ref={ref}>
      <Tilt {...defaultTiltProps}>
        <Card
          role="button"
          tabIndex={0}
          aria-label="Resume card"
          className={cn(
            // Surface
            "relative flex aspect-[1/1.4142] items-center justify-center p-0",
            // Theme and borders
            "bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/20 backdrop-blur-[18px]",
            // Interactions
            "cursor-pointer transition-all duration-300 will-change-transform",
            "hover:border-[#1dff00]/50 hover:shadow-[0_0_24px_-8px_rgba(29,255,0,0.6)]",
            "active:scale-95",
            className,
          )}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClick?.();
            }
          }}
        >
          {children}
        </Card>
      </Tilt>
    </div>
  ),
);
