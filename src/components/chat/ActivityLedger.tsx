import React from "react";

export interface ActivityLedgerItem {
  id: string;
  label: string;
  status?: "running" | "done" | "error";
  kind?: string;
  icon?: React.ReactNode;
}

export interface ActivityLedgerProps {
  items: ActivityLedgerItem[];
  isLive?: boolean;
  className?: string;
  onItemClick?: (id: string) => void;
}

export const ActivityLedger: React.FC<ActivityLedgerProps> = ({
  items,
  isLive = false,
  className = "",
  onItemClick,
}) => {
  return (
    <div className={`ledger ${isLive ? "ledger-live" : ""} space-y-2 ${className}`}>
      {items.map((item, index) => (
        <div
          key={item.id || index}
          onClick={() => onItemClick?.(item.id)}
          style={{
            animationDelay: isLive ? undefined : `${-0.9 * (index % 5)}s`,
          }}
          className="flex max-w-full items-center gap-2 rounded-lg border border-brand/20 bg-brand/[0.06] px-3 py-2 text-[13px] leading-5 text-muted-foreground transition-all hover:bg-brand/[0.09] hover:border-brand/40"
        >
          {item.icon}
          <span className="truncate flex-1 text-left">{item.label}</span>
        </div>
      ))}
    </div>
  );
};
