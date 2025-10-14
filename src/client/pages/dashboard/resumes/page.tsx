import { t } from "@lingui/macro";
import { ScrollArea } from "@reactive-resume/ui";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";

import { GridView } from "./_layouts/grid";
import { useState, useCallback } from 'react';
import { useResumes } from '@/hooks/useResumes';

export const ResumesPage = () => {
  const { importMultiple, importStatuses, clearImportStatuses, removeImportStatus } = useResumes();
  const [showCompleted, setShowCompleted] = useState(true);
  const [dragActive, setDragActive] = useState(false);

  const onDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  }, []);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      await importMultiple(e.dataTransfer.files);
    }
  }, [importMultiple]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <Helmet>
        <title>
          {t`Resume Builder`} - JobRaker
        </title>
      </Helmet>

      <div className="space-y-6">
        <div className="rounded-lg border border-[#1dff00]/20 bg-[#1dff00]/5 px-4 py-3 text-[11px] text-[#1dff00]/80 flex flex-wrap items-center gap-2">
          <span className="font-medium text-[#1dff00]">Tip:</span>
          <span>Select or import a resume below to open the full builder canvas. Check Settings → Resume Checker to run AI analysis on your resumes.</span>
        </div>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <motion.h1
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl sm:text-3xl font-semibold tracking-tight text-white"
          >
            {t`Resume Builder`}
          </motion.h1>
        </div>

        <div 
          onDragEnter={onDrag}
          onDragOver={onDrag}
          onDragLeave={onDrag}
          onDrop={onDrop}
          className={`relative ${dragActive ? 'ring-2 ring-[#1dff00] ring-offset-2 ring-offset-black rounded-xl transition' : ''}`}
        >
        {importStatuses.length > 0 && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-[#1dff00]/80">Recent Imports</h2>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 text-[10px] text-[#1dff00]/60 select-none cursor-pointer">
                  <input type="checkbox" checked={showCompleted} onChange={(e)=>setShowCompleted(e.target.checked)} className="accent-[#1dff00]" />
                  <span>Show Completed</span>
                </label>
                <button onClick={clearImportStatuses} className="text-[10px] text-[#1dff00]/60 hover:text-[#1dff00] transition">Clear</button>
              </div>
            </div>
            <ul className="max-h-44 overflow-auto thin-scrollbar pr-1 text-[11px] divide-y divide-[#1dff00]/10 border border-[#1dff00]/10 rounded-xl bg-black/40 backdrop-blur-sm">
              {(importStatuses as any[]).filter((st: any) => showCompleted || (st.state !== 'done')).slice(0,14).map((st: any) => {
                const pct = Math.round(st.progress);
                const barColor = st.state === 'error' ? 'bg-red-500/60' : st.state === 'done' ? 'bg-[#1dff00]' : 'bg-[#1dff00]/60';
                return (
                  <li key={st.id} className="px-3 py-2 space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[#1dff00] font-medium leading-tight flex items-center gap-2">
                          {st.name}
                          {st.duplicate && <span className="px-1 py-0.5 text-[9px] rounded bg-yellow-400/10 text-yellow-300 border border-yellow-500/30">duplicate</span>}
                        </p>
                        <p className="text-[10px] text-[#1dff00]/50">{(st.size/1024).toFixed(1)} KB</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#1dff00]/10 border border-[#1dff00]/30 text-[#1dff00]">
                          {st.state === 'pending' && 'Queued'}
                          {st.state === 'uploading' && (pct < 100 ? `${pct}%` : 'Finishing')}
                          {st.state === 'done' && 'Done'}
                          {st.state === 'error' && 'Error'}
                        </span>
                        <button onClick={() => removeImportStatus(st.id)} className="text-[#1dff00]/40 hover:text-[#1dff00] text-xs" aria-label="Remove import status">×</button>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded bg-[#1dff00]/10 overflow-hidden">
                      <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    {st.error && <p className="text-[10px] text-red-400">{st.error}</p>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <ScrollArea
          allowOverflow
          className="h-[calc(100vh-150px)] lg:h-[calc(100vh-110px)] overflow-visible border-t border-[#1dff00]/10"
        >
          <GridView />
        </ScrollArea>
        {dragActive && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[#1dff00] font-medium text-sm backdrop-blur-[2px] bg-black/40 rounded-xl">
            Drop to import
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
