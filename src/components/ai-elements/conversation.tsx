"use client";

// Simplified conversation implementation to avoid type issues with external lib
import { cn } from "@/lib/utils";
import * as React from "react";
import type { ComponentProps } from "react";

export interface ConversationProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Conversation: React.FC<ConversationProps> = ({ className, children, ...rest }) => {
  return (
    <div className={cn("relative flex-1 overflow-y-auto", className)} role="log" {...rest}>
      {children}
    </div>
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
