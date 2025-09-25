import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { useChatSessions } from '../../stores/chatSessions';

interface Props { open: boolean; onClose: () => void; }

export const ChatSearchPalette = ({ open, onClose }: Props) => {
  const { activeSessionId, search } = useChatSessions();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ message: any; score: number }[]>([]);

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]); return; }
  }, [open]);

  useEffect(() => {
    if (!activeSessionId || !query.trim()) { setResults([]); return; }
    const r = search(activeSessionId, query.trim());
    setResults(r);
  }, [query, activeSessionId, search]);

  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onClose(); }
    if (e.key === 'Escape') { onClose(); }
  }, [onClose]);

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[200] flex items-start justify-center pt-24 backdrop-blur-sm bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y:0, opacity:1 }} exit={{ y: 20, opacity: 0 }} transition={{ type:'spring', stiffness: 240, damping: 24 }} className="w-full max-w-2xl rounded-2xl border border-[#1dff00]/30 bg-[#060806] shadow-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1dff00]/20 bg-[#0b0f0b]">
              <Search className="w-4 h-4 text-[#1dff00]" />
              <input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search current session (Ctrl+K)" className="flex-1 bg-transparent outline-none text-sm text-neutral-200 placeholder:text-neutral-500" />
              <button onClick={onClose} className="p-1.5 rounded-md hover:bg-[#1dff00]/10 text-neutral-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar py-2">
              {results.length === 0 && query && (
                <div className="px-5 py-6 text-center text-xs text-neutral-500">No matches</div>
              )}
              {(!query) && (
                <div className="px-5 py-6 text-center text-xs text-neutral-500">Type to search messages…</div>
              )}
              <ul className="space-y-1 px-3">
                {results.map(r => (
                  <li key={r.message.id} className="group rounded-lg border border-transparent hover:border-[#1dff00]/30 bg-[#0e120e]/40 hover:bg-[#131d13]/70 transition">
                    <div className="px-3 py-2 text-[11px] text-neutral-300 leading-relaxed">
                      <span className="text-[#1dff00]/80 font-mono mr-2">score:{r.score}</span>
                      {r.message.content.slice(0, 280)}{r.message.content.length>280?'…':''}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
