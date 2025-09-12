"use client";
import React, { createContext, useContext, useMemo } from "react";

type Column = { id: string; name: string; color?: string };
type Item = { id: string; column: string; [key: string]: any };

type KanbanContextValue = {
  columns: Column[];
  data: Item[];
  onDataChange?: (items: Item[]) => void;
};

const KanbanContext = createContext<KanbanContextValue | null>(null);

export function KanbanProvider({
  columns,
  data,
  onDataChange,
  children,
}: {
  columns: Column[];
  data: Item[];
  onDataChange?: (items: Item[]) => void;
  children: (column: Column) => React.ReactNode;
}) {
  const value = useMemo(() => ({ columns, data, onDataChange }), [columns, data, onDataChange]);
  return (
    <KanbanContext.Provider value={value}>
      <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {columns.map((c) => (
          <React.Fragment key={c.id}>{children(c)}</React.Fragment>
        ))}
      </div>
    </KanbanContext.Provider>
  );
}

function useKanban() {
  const ctx = useContext(KanbanContext);
  if (!ctx) throw new Error("Kanban components must be used within KanbanProvider");
  return ctx;
}

export function KanbanBoard({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div data-column-id={id} className="rounded-xl border border-[#ffffff12] bg-black/30 p-3 md:p-4">
      {children}
    </div>
  );
}

export function KanbanHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 md:mb-4 flex items-center justify-between">{children}</div>;
}

export function KanbanCards<T extends Item>({ id, children }: { id: string; children: (item: T) => React.ReactNode }) {
  const { data } = useKanban();
  const items = useMemo(() => data.filter((i) => i.column === id) as T[], [data, id]);
  return <div className="space-y-2.5">{items.map((it) => children(it))}</div>;
}

export function KanbanCard({ children }: { id?: string; name?: string; column?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#ffffff15] bg-[#0b0b0b]/70 p-3 hover:border-[#1dff00]/40 transition-colors">
      {children}
    </div>
  );
}
