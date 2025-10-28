import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, useCallback } from 'react';
import { Trash2 } from 'lucide-react';

import { CreateCoverLetterCard } from "./_components/create-card";
import { CoverLetterCard } from "./_components/cover-letter-card";

type LibraryEntry = { id: string; name: string; updatedAt: string; data: any };
const LIB_KEY = "jr.coverLetters.library.v1";

export const GridView = () => {
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  // Load library from localStorage
  useEffect(() => {
    try {
      const libRaw = localStorage.getItem(LIB_KEY);
      if (libRaw) {
        const arr = JSON.parse(libRaw);
        if (Array.isArray(arr)) setLibrary(arr);
      }
    } catch {}
  }, []);

  // Reload library (callback for cards to trigger refresh)
  const reloadLibrary = useCallback(() => {
    try {
      const libRaw = localStorage.getItem(LIB_KEY);
      if (libRaw) {
        const arr = JSON.parse(libRaw);
        if (Array.isArray(arr)) setLibrary(arr);
      } else {
        setLibrary([]);
      }
    } catch {
      setLibrary([]);
    }
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const clearSelection = useCallback(() => setSelected([]), []);

  const bulkDelete = useCallback(() => {
    try {
      const remaining = library.filter(l => !selected.includes(l.id));
      localStorage.setItem(LIB_KEY, JSON.stringify(remaining));
      setLibrary(remaining);
      setSelected([]);
    } catch {}
  }, [library, selected]);

  return (
    <div className="relative">
      {selected.length > 0 && (
        <div className="sticky top-0 z-40 mb-4 -mt-2 -mx-1 px-4 py-3 flex items-center gap-3 rounded-lg bg-gradient-to-r from-[#0d0d0d] via-[#111] to-[#0d0d0d] border border-[#1dff00]/30 shadow-[0_0_20px_-6px_rgba(29,255,0,0.4)] animate-in slide-in-from-top-5">
          <span className="text-xs font-medium tracking-wide text-[#1dff00]">{selected.length} selected</span>
          <div className="h-4 w-px bg-[#1dff00]/30" />
          <button 
            onClick={bulkDelete} 
            className="text-[11px] px-2 py-1 rounded-md border border-red-500/40 hover:bg-red-500/10 text-red-400 flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3"/> Delete
          </button>
          <button 
            onClick={clearSelection} 
            className="ml-auto text-[11px] px-2 py-1 rounded-md border border-white/15 hover:border-[#1dff00]/40 text-white"
          >
            Clear
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }}>
          <CreateCoverLetterCard />
        </motion.div>

        {library.length > 0 && (
          <AnimatePresence>
            {library.map((letter, index) => (
              <motion.div
                key={letter.id}
                layout
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0, transition: { delay: (index + 1) * 0.1 } }}
                exit={{ opacity: 0, filter: "blur(8px)", transition: { duration: 0.5 } }}
              >
                <CoverLetterCard 
                  letter={letter} 
                  onDelete={reloadLibrary}
                  isSelected={selected.includes(letter.id)}
                  onToggleSelect={() => toggleSelect(letter.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};
