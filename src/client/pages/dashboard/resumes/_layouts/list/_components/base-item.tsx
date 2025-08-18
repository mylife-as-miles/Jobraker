import { cn } from "@reactive-resume/utils";

export const BaseListItem = ({ className = "", children }: { className?: string; children?: React.ReactNode }) => {
  return (
    <div className={cn("flex items-center justify-between rounded-md border p-3", className)}>
      {children ?? (
        <div className="h-4 w-1/3 animate-pulse rounded bg-foreground/10" />
      )}
    </div>
  );
};
