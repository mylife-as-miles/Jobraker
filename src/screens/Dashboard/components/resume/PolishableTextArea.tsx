import React, { useRef } from "react";
import { Sparkles } from "lucide-react";
import { Textarea } from "../../../../components/ui/textarea";
import { cn } from "../../../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface PolishableTextAreaProps extends React.ComponentProps<
  typeof Textarea
> {
  onPolish: (rect: DOMRect, value: string) => void;
  isPolishing?: boolean;
}

export const PolishableTextArea = ({
  className,
  onPolish,
  isPolishing,
  value,
  ...props
}: PolishableTextAreaProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handlePolishClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (containerRef.current && typeof value === "string") {
      const rect = containerRef.current.getBoundingClientRect();
      onPolish(rect, value);
    }
  };

  return (
    <div ref={containerRef} className='relative group'>
      <Textarea
        value={value}
        className={cn(
          "pr-10 transition-all duration-300",
          isPolishing &&
            "border-brand ring-1 ring-brand shadow-[0_0_15px_rgba(29,255,0,0.1)]",
          className,
        )}
        {...props}
      />

      <AnimatePresence>
        {/* Always show button on hover or if polishing, but maybe subtle when not hovering */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className={cn(
            "absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200",
            isPolishing && "opacity-100",
          )}
        >
          <button
            ref={buttonRef}
            onClick={handlePolishClick}
            className={cn(
              "p-1.5 rounded-lg transition-all duration-300",
              isPolishing
                ? "bg-brand text-black shadow-[0_0_10px_rgba(29,255,0,0.5)]"
                : "bg-gray-100 dark:bg-muted text-gray-400 hover:text-brand hover:bg-brand/10",
            )}
            title='AI Polish'
          >
            <Sparkles
              className={cn("w-3.5 h-3.5", isPolishing && "animate-pulse")}
            />
          </button>

          {/* Pulsing ring when polishing */}
          {isPolishing && (
            <span className='absolute -inset-1 rounded-lg bg-brand/30 animate-ping -z-10' />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Connecting line anchor point (hidden, just for rect calculation references if needed) */}
      <div className='absolute right-0 top-6 w-1 h-1' />
    </div>
  );
};
