"use client";
import React, { createContext, useContext, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Column = { id: string; name: string; color?: string };
type Item = { id: string; column: string; [key: string]: any };

type KanbanContextValue = {
  columns: Column[];
  data: Item[];
  onDataChange?: (items: Item[]) => void;
  onItemMove?: (id: string, toColumn: string) => void;
};

const KanbanContext = createContext<KanbanContextValue | null>(null);

export function KanbanProvider({
  columns,
  data,
  onDataChange,
  onItemMove,
  children,
}: {
  columns: Column[];
  data: Item[];
  onDataChange?: (items: Item[]) => void;
  onItemMove?: (id: string, toColumn: string) => void;
  children: (column: Column) => React.ReactNode;
}) {
  const value = useMemo(() => ({ columns, data, onDataChange, onItemMove }), [columns, data, onDataChange, onItemMove]);
  return (
    <KanbanContext.Provider value={value}>
      {/* Modern responsive grid with enhanced spacing */}
      <div className="relative">
        {/* Ambient background effects */}
        <div className="pointer-events-none absolute -top-20 left-1/4 h-64 w-64 rounded-full bg-[#1dff00]/10 blur-3xl opacity-30" />
        <div className="pointer-events-none absolute -bottom-20 right-1/4 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl opacity-30" />
        
        <div className="flex gap-4 md:gap-5 lg:gap-6 overflow-x-auto pb-3 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory md:snap-none md:overflow-visible flex-nowrap md:flex-wrap md:flex-auto md:grid md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {columns.map((c) => (
            <React.Fragment key={c.id}>{children(c)}</React.Fragment>
          ))}
        </div>
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
    <div
      data-column-id={id}
      className="relative rounded-xl border border-white/10 bg-gradient-to-br from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] backdrop-blur-xl p-4 md:p-5 min-w-[85vw] sm:min-w-[420px] md:min-w-0 snap-start shadow-lg hover:shadow-xl hover:border-white/15 transition-all duration-300"
      role="list"
      aria-roledescription="Kanban column"
    >
      {/* Subtle inner glow */}
      <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-white/[0.015] to-transparent" />
      
      {children}
    </div>
  );
}

export function KanbanHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mb-4 md:mb-5 flex items-center justify-between pb-3 border-b border-white/8">
      {children}
    </div>
  );
}

export function KanbanCards<T extends Item>({ id, children }: { id: string; children: (item: T) => React.ReactNode }) {
  const { data, onItemMove } = useKanban();
  const items = useMemo(() => data.filter((i) => i.column === id) as T[], [data, id]);
  const [isDragOver, setIsDragOver] = React.useState(false);
  
  return (
    <div
      className={`space-y-3 min-h-[120px] rounded-lg transition-all duration-300 ${isDragOver ? 'bg-white/5 ring-2 ring-white/20 ring-inset border-2 border-dashed border-white/20' : ''}`}
      onDragOver={(e) => {
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const movedId = e.dataTransfer?.getData('text/plain');
        if (movedId && onItemMove) onItemMove(movedId, id);
      }}
    >
      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="h-10 w-10 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center mb-3">
            <div className="h-5 w-5 rounded bg-white/10" />
          </div>
          <p className="text-xs font-medium text-white/45">No items yet</p>
          <p className="text-[10px] text-white/30 mt-1">Drag cards here</p>
        </div>
      )}
      <AnimatePresence initial={false}>
        {items.map((it) => (
          <motion.div 
            key={it.id} 
            layout 
            initial={{ opacity: 0, y: 12, scale: 0.95 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            {children(it)}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function KanbanCard({ id, children }: { id?: string; name?: string; column?: string; children: React.ReactNode }) {
  const [isDragging, setIsDragging] = React.useState(false);
  
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (!id) return;
    setIsDragging(true);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDragEnd = () => {
    setIsDragging(false);
  };
  
  return (
    <motion.div
      layout
      className={`group relative rounded-lg border bg-gradient-to-br from-[#0f0f0f] to-[#0a0a0a] p-4 transition-all duration-200 cursor-grab active:cursor-grabbing ${
        isDragging 
          ? 'border-[#1dff00]/50 shadow-[0_0_30px_rgba(29,255,0,0.3)] scale-105 opacity-50' 
          : 'border-white/8 hover:border-white/15 bg-[#0f0f0f] shadow-sm hover:shadow-md'
      }`}
      draggable
      onDragStart={handleDragStart as any}
      onDragEnd={handleDragEnd as any}
      whileHover={{ scale: isDragging ? 1.05 : 1.01, y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-white/[0.015] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      
      <div className="relative">
        {children}
      </div>
    </motion.div>
  );
}
