import { useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface SlashCommandDefinition {
  cmd: string;
  title: string;
  description: string;
  example?: string;
}

interface Props {
  open: boolean;
  query: string;
  onSelect: (command: SlashCommandDefinition) => void;
  anchorRef: React.RefObject<HTMLElement>;
}

const COMMANDS: SlashCommandDefinition[] = [
  { cmd: 'help', title: 'Help Menu', description: 'Show available slash commands.' },
  { cmd: 'resume', title: 'Resume Optimize', description: 'Ask for resume improvements or targeted tailoring.' },
  { cmd: 'jobs', title: 'Jobs Summary', description: 'Summarize recent tracked job listings.' },
  { cmd: 'applications', title: 'Applications Insights', description: 'Analyze application funnel & status distribution.' },
  { cmd: 'interview', title: 'Interview Prep', description: 'Generate mock interview Q&A for your target role.' },
];

export function SlashCommandMenu({ open, query, onSelect, anchorRef }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const list = useMemo(() => {
    const q = query.toLowerCase();
    return COMMANDS.filter(c => !q || c.cmd.startsWith(q)).slice(0, 8);
  }, [query]);

  // Keyboard navigation inside menu
  useEffect(() => {
    if (!open) return;
    let index = 0;
    const handler = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); index = Math.min(list.length - 1, index + 1); focusItem(index); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); index = Math.max(0, index - 1); focusItem(index); }
      else if (e.key === 'Enter') {
        const item = list[index];
        if (item) { e.preventDefault(); onSelect(item); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, list, onSelect]);

  const focusItem = (i: number) => {
    const el = containerRef.current?.querySelectorAll('[data-slash-item]')[i] as HTMLElement | undefined;
    el?.focus();
  };

  // Positioning (simple: attach under anchor)
  const style: React.CSSProperties = {}; // Could compute precise popover later

  return (
    <AnimatePresence>
      {open && list.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          className="absolute z-50 bottom-full mb-2 left-0 max-w-md w-full"
          style={style}
          ref={containerRef}
        >
          <div className="rounded-xl overflow-hidden border border-[#1dff00]/30 bg-[#081008]/95 backdrop-blur-xl shadow-xl">
            <ul className="divide-y divide-[#1dff00]/10">
              {list.map(item => (
                <li key={item.cmd}>
                  <button
                    data-slash-item
                    onClick={()=>onSelect(item)}
                    className="w-full text-left px-3 py-2 focus:outline-none focus:bg-[#143014] hover:bg-[#112611] transition flex flex-col gap-0.5"
                  >
                    <span className="text-[12px] font-semibold text-[#b9ffb5]"><span className="text-[#1dff00]">/{item.cmd}</span> — {item.title}</span>
                    <span className="text-[10px] text-neutral-400 leading-snug">{item.description}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="px-3 py-1.5 text-[10px] text-neutral-500 flex justify-between">
              <span>↑↓ navigate • Enter select</span>
              <span>{list.length} match{list.length!==1?'es':''}</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const SLASH_COMMANDS = COMMANDS;