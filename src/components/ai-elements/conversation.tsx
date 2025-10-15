"use client";

// Simplified conversation implementation to avoid type issues with external lib
import * as React from "react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ConversationProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

type ConversationCtx = { containerRef: React.RefObject<HTMLDivElement>; isAtBottom: boolean };
const ConversationContext = React.createContext<ConversationCtx | null>(null);

export const Conversation: React.FC<ConversationProps> = ({ className, children, ...rest }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = React.useState(true);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handle = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
      setIsAtBottom(atBottom);
    };
    el.addEventListener('scroll', handle);
    handle();
    return () => el.removeEventListener('scroll', handle);
  }, []);

  return (
    <ConversationContext.Provider value={{ containerRef, isAtBottom }}>
      <div ref={containerRef} className={cn("relative flex-1 overflow-y-auto", className)} role="log" {...rest}>
        {children}
      </div>
    </ConversationContext.Provider>
  );
};

export interface ConversationContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const ConversationContent: React.FC<ConversationContentProps> = ({ className, children, ...rest }) => (
  <div className={cn("p-4", className)} {...rest}>{children}</div>
);

export type ConversationEmptyStateProps = ComponentProps<"div"> & {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
};

export const ConversationEmptyState = ({
  className,
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => (
  <div
    className={cn(
      "flex size-full flex-col items-center justify-center gap-3 p-8 text-center",
      className
    )}
    {...props}
  >
    {children ?? (
      <>
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <div className="space-y-1">
          <h3 className="font-medium text-sm">{title}</h3>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </div>
      </>
    )}
  </div>
);

// Scroll button removed (manual implementation exists in ChatPage)
export interface ConversationScrollButtonProps extends React.HTMLAttributes<HTMLButtonElement> {
  label?: string;
}

export const ConversationScrollButton: React.FC<ConversationScrollButtonProps> = ({ className, label = 'Scroll to bottom', ...rest }) => {
  const ctx = React.useContext(ConversationContext);
  if (!ctx) return null;
  const { containerRef, isAtBottom } = ctx;
  if (isAtBottom) return null;
  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      aria-label={label}
      onClick={() => {
        const el = containerRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }}
      className={cn("absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow bg-neutral-900/70 backdrop-blur border border-neutral-700 hover:bg-neutral-800", className)}
      {...rest}
    >
      ↓
    </Button>
  );
};
