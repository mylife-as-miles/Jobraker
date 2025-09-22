import { cn } from "@reactive-resume/utils";

export const BaseListItem = ({ className = "", children }: { className?: string; children?: React.ReactNode }) => {
  return (
    <div className={cn(
  "flex items-center justify-between rounded-xl p-3",
      "bg-gradient-to-r from-[#111111] to-[#0a0a0a] border border-[#1dff00]/20",
      "hover:border-[#1dff00]/40 hover:bg-[#1dff00]/5 transition-colors",
      className)}>
      {children ?? (
        <div className="h-4 w-1/3 animate-pulse rounded bg-white/10" />
      )}
    </div>
  );
};
