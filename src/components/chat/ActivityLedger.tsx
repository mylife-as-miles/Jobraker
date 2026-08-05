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
  const visibleItems = isLive ? items.slice(-3).reverse() : items;

  return (
    <div className={`ledger ${isLive ? "ledger-live" : "ledger-static"} space-y-2 ${className}`}>
      {visibleItems.map((item, index) => (
        <div
          key={item.id || index}
          onClick={() => onItemClick?.(item.id)}
          className="ledger-row relative flex max-w-full items-center gap-2 rounded-lg border border-brand/20 bg-brand/[0.06] px-3 py-2 text-[13px] leading-5 text-muted-foreground transition-colors hover:border-brand/40 hover:bg-brand/[0.09]"
        >
          {isLive ? <span className="ledger-edge-dot" aria-hidden="true" /> : null}
          {item.icon}
          <span className="truncate flex-1 text-left">{item.label}</span>
        </div>
      ))}
    </div>
  );
};
