import { AnimatePresence, motion } from "framer-motion";
import { useResumes } from "@/hooks/useResumes";
import { useResumeSelection } from '@/client/stores/resumeSelection';
import { useEffect, useMemo, useCallback } from 'react';
import { Trash2, Star, StarOff, Download, CheckSquare2, Square } from 'lucide-react';

import { BaseCard } from "./_components/base-card";
import { CreateResumeCard } from "./_components/create-card";
import { ImportResumeCard } from "./_components/import-card";
import { SbResumeCard } from "./_components/sb-resume-card";

export const GridView = () => {
  const { resumes, loading, toggleFavorite, remove, download } = useResumes() as any;
  const items = Array.isArray(resumes) ? resumes : [];
  const { selected, clear, selectAll, addMany, selectOnly } = useResumeSelection();
  const allIds = useMemo(()=> items.map(r=> r.id), [items]);

  // Listen for range selection events from cards
  useEffect(() => {
    const handler = (e: any) => {
      const { anchor, target } = e.detail || {};
      if (!anchor || !target) return;
      const anchorIdx = allIds.indexOf(anchor);
      const targetIdx = allIds.indexOf(target);
      if (anchorIdx === -1 || targetIdx === -1) return;
      const [start, end] = anchorIdx < targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx];
      addMany(allIds.slice(start, end + 1));
    };
    window.addEventListener('resume-range-select', handler as any);
    return () => window.removeEventListener('resume-range-select', handler as any);
  }, [allIds, addMany]);

  const bulkSelectedRecords = useMemo(() => items.filter(r => selected.includes(r.id)), [items, selected]);

  const bulkDelete = useCallback(() => {
    bulkSelectedRecords.forEach(r => remove(r));
    clear();
  }, [bulkSelectedRecords, remove, clear]);

  const bulkFavorite = useCallback((value: boolean) => {
    bulkSelectedRecords.forEach(r => toggleFavorite(r.id, value));
  }, [bulkSelectedRecords, toggleFavorite]);

  const bulkDownload = useCallback(() => {
    bulkSelectedRecords.forEach(r => download(r));
  }, [bulkSelectedRecords, download]);

  return (
    <div className="relative">
      {selected.length > 0 && (
        <div className="sticky top-0 z-40 mb-4 -mt-2 -mx-1 px-4 py-3 flex items-center gap-3 rounded-lg bg-gradient-to-r from-[#0d0d0d] via-[#111] to-[#0d0d0d] border border-[#1dff00]/30 shadow-[0_0_20px_-6px_rgba(29,255,0,0.4)] animate-in slide-in-from-top-5">
          <span className="text-xs font-medium tracking-wide text-[#1dff00]">{selected.length} selected</span>
          <div className="h-4 w-px bg-[#1dff00]/30" />
          <button onClick={()=> bulkFavorite(true)} className="text-[11px] px-2 py-1 rounded-md border border-[#1dff00]/40 bg-[#1dff00]/10 hover:bg-[#1dff00]/20 text-[#1dff00] flex items-center gap-1">
            <Star className="w-3 h-3"/> Favorite
          </button>
          <button onClick={()=> bulkFavorite(false)} className="text-[11px] px-2 py-1 rounded-md border border-white/15 hover:border-[#1dff00]/40 text-white flex items-center gap-1">
            <StarOff className="w-3 h-3"/> Unfavorite
          </button>
          <button onClick={bulkDownload} className="text-[11px] px-2 py-1 rounded-md border border-white/15 hover:border-[#1dff00]/40 text-white flex items-center gap-1">
            <Download className="w-3 h-3"/> Download
          </button>
          <button onClick={bulkDelete} className="text-[11px] px-2 py-1 rounded-md border border-red-500/40 hover:bg-red-500/10 text-red-400 flex items-center gap-1">
            <Trash2 className="w-3 h-3"/> Delete
          </button>
          <div className="ml-auto flex items-center gap-2">
            {selected.length !== allIds.length ? (
              <button onClick={()=> selectAll(allIds)} className="text-[11px] px-2 py-1 rounded-md border border-white/15 hover:border-[#1dff00]/40 text-white flex items-center gap-1">
                <CheckSquare2 className="w-3 h-3"/> Select All
              </button>
            ) : (
              <button onClick={()=> clear()} className="text-[11px] px-2 py-1 rounded-md border border-white/15 hover:border-[#1dff00]/40 text-white flex items-center gap-1">
                <Square className="w-3 h-3"/> Clear
              </button>
            )}
            {selected.length === 1 && (
              <button onClick={()=> selectOnly(selected[0])} className="text-[11px] px-2 py-1 rounded-md border border-white/15 hover:border-[#1dff00]/40 text-white">Solo</button>
            )}
          </div>
        </div>
      )}
  <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }}>
        <CreateResumeCard />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0, transition: { delay: 0.1 } }}
      >
        <ImportResumeCard />
      </motion.div>

      {loading &&
        Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="duration-300 animate-in fade-in"
            style={{ animationFillMode: "backwards", animationDelay: `${i * 300}ms` }}
          >
            <BaseCard />
          </div>
        ))}

      {items.length > 0 && (
        <AnimatePresence>
          {items.map((resume, index) => (
            <motion.div
              key={resume.id}
              layout
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0, transition: { delay: (index + 2) * 0.1 } }}
              exit={{ opacity: 0, filter: "blur(8px)", transition: { duration: 0.5 } }}
            >
              <SbResumeCard resume={resume} />
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
    </div>
  );
};
