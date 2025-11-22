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
    <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Ambient Background Glows */}
      <div className="fixed top-20 right-0 h-96 w-96 bg-[#1dff00]/5 rounded-full blur-3xl opacity-30 pointer-events-none -z-10" />
      <div className="fixed bottom-20 left-0 h-96 w-96 bg-[#1dff00]/5 rounded-full blur-3xl opacity-20 pointer-events-none -z-10" />
      
      <Helmet>
        <title>
          {t`Resume Builder`} - JobRaker
        </title>
      </Helmet>

      <div className="space-y-6">
        {/* Enhanced Info Card */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative rounded-2xl border border-[#1dff00]/30 bg-gradient-to-br from-[#0a0a0a]/95 via-[#0f0f0f]/95 to-[#0a0a0a]/95 backdrop-blur-xl px-6 py-5 text-sm text-[#1dff00] flex items-start gap-4 shadow-[0_0_35px_rgba(29,255,0,0.15)] hover:shadow-[0_0_45px_rgba(29,255,0,0.2)] transition-all duration-300 overflow-hidden group"
        >
          {/* Animated gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#1dff00]/0 via-[#1dff00]/5 to-[#1dff00]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-[#1dff00]/20 to-[#1dff00]/10 border border-[#1dff00]/50 flex-shrink-0 shadow-[0_0_20px_rgba(29,255,0,0.2)] group-hover:scale-110 transition-transform duration-300">
            <svg className="w-5 h-5 text-[#1dff00] drop-shadow-[0_0_8px_rgba(29,255,0,0.8)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="relative">
            <span className="font-bold text-[#1dff00] text-base tracking-wide drop-shadow-[0_0_10px_rgba(29,255,0,0.5)]">Pro Tip:</span>
            <span className="text-[#1dff00]/90 ml-2.5 leading-relaxed">Select or import a resume below to open the full builder canvas. Check Settings → Resume Checker to run AI analysis on your resumes.</span>
          </div>
          
          {/* Corner accent glow */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-[#1dff00]/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        </motion.div>

        {/* Enhanced Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <motion.h1
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-white via-[#1dff00]/95 to-[#1dff00] bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(29,255,0,0.4)]"
            >
              {t`Resume Builder`}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
              className="text-gray-400 text-base"
            >
              Create professional resumes that stand out and get you hired
            </motion.p>
          </div>
          
          {/* Stats Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-br from-[#1dff00]/10 to-[#1dff00]/5 border border-[#1dff00]/30 backdrop-blur-xl"
          >
            <svg className="w-4 h-4 text-[#1dff00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-medium text-[#1dff00]">Library</span>
          </motion.div>
        </div>

        <div 
          onDragEnter={onDrag}
          onDragOver={onDrag}
          onDragLeave={onDrag}
          onDrop={onDrop}
          className={`relative transition-all duration-300 ${dragActive ? 'ring-2 ring-[#1dff00] ring-offset-2 ring-offset-black/40 rounded-2xl' : ''}`}
        >
        {importStatuses.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 space-y-3"
          >
            <div className="flex items-center justify-between px-1">
              <h2 className="text-base font-bold text-white flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1dff00]/10 border border-[#1dff00]/30">
                  <svg className="w-4 h-4 text-[#1dff00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                Recent Imports
              </h2>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-gray-400 select-none cursor-pointer hover:text-[#1dff00] transition-colors group">
                  <input 
                    type="checkbox" 
                    checked={showCompleted} 
                    onChange={(e)=>setShowCompleted(e.target.checked)} 
                    className="w-4 h-4 rounded border-[#1dff00]/30 bg-transparent checked:bg-[#1dff00] checked:border-[#1dff00] focus:ring-2 focus:ring-[#1dff00]/20 transition-all cursor-pointer" 
                  />
                  <span className="group-hover:text-[#1dff00] transition-colors">Show Completed</span>
                </label>
                <button 
                  onClick={clearImportStatuses} 
                  className="text-xs px-3 py-1.5 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 transition-all font-medium"
                >
                  Clear All
                </button>
              </div>
            </div>
            <ul className="max-h-56 overflow-auto scrollbar-thin scrollbar-thumb-[#1dff00]/30 scrollbar-track-transparent pr-2 text-xs divide-y divide-[#1dff00]/10 border border-[#1dff00]/20 rounded-2xl bg-gradient-to-br from-[#0a0a0a]/95 to-[#0f0f0f]/95 backdrop-blur-xl shadow-[0_0_30px_rgba(29,255,0,0.1)]">
              {(importStatuses as any[]).filter((st: any) => showCompleted || (st.state !== 'done')).slice(0,14).map((st: any) => {
                const pct = Math.round(st.progress);
                const barColor = st.state === 'error' ? 'bg-red-500/60' : st.state === 'done' ? 'bg-gradient-to-r from-[#1dff00] to-[#0a8246]' : 'bg-gradient-to-r from-[#1dff00]/60 to-[#1dff00]/40';
                const barShadow = st.state === 'done' ? 'shadow-[0_0_10px_rgba(29,255,0,0.4)]' : '';
                return (
                  <li key={st.id} className="px-4 py-3 space-y-2 hover:bg-[#1dff00]/5 transition-colors group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-white font-semibold leading-tight flex items-center gap-2">
                          {st.name}
                          {st.duplicate && (
                            <span className="px-2 py-0.5 text-[10px] rounded-lg bg-yellow-400/10 text-yellow-300 border border-yellow-500/30 font-bold uppercase tracking-wide">
                              Duplicate
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-2">
                          <svg className="w-3 h-3 text-[#1dff00]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {(st.size/1024).toFixed(1)} KB
                        </p>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${
                          st.state === 'done' 
                            ? 'bg-gradient-to-r from-[#1dff00]/20 to-[#0a8246]/20 border-[#1dff00]/50 text-[#1dff00] shadow-[0_0_15px_rgba(29,255,0,0.2)]'
                            : st.state === 'error'
                            ? 'bg-red-500/10 border-red-500/40 text-red-400'
                            : 'bg-[#1dff00]/10 border-[#1dff00]/30 text-[#1dff00]'
                        }`}>
                          {st.state === 'pending' && 'Queued'}
                          {st.state === 'uploading' && (pct < 100 ? `${pct}%` : 'Finishing')}
                          {st.state === 'done' && '✓ Done'}
                          {st.state === 'error' && '✗ Error'}
                        </span>
                        <button 
                          onClick={() => removeImportStatus(st.id)} 
                          className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/40 border border-transparent transition-all opacity-0 group-hover:opacity-100" 
                          aria-label="Remove import status"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-[#1dff00]/10 to-[#1dff00]/5 overflow-hidden border border-[#1dff00]/20">
                      <div 
                        className={`h-full ${barColor} ${barShadow} transition-all duration-300 rounded-full`} 
                        style={{ width: `${pct}%` }} 
                      />
                    </div>
                    {st.error && (
                      <p className="text-[11px] text-red-400 flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mt-2">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {st.error}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
        <ScrollArea
          allowOverflow
          className="h-[calc(100vh-150px)] lg:h-[calc(100vh-110px)] overflow-visible border-t border-[#1dff00]/20"
        >
          <GridView />
        </ScrollArea>
        {dragActive && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center rounded-2xl backdrop-blur-md bg-gradient-to-br from-black/90 via-black/85 to-black/90 border-2 border-dashed border-[#1dff00] shadow-[0_0_60px_rgba(29,255,0,0.4)]"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-[#1dff00]/30 rounded-full blur-3xl animate-pulse" />
                <div className="relative flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-[#1dff00]/20 to-[#1dff00]/10 border-2 border-[#1dff00] shadow-[0_0_40px_rgba(29,255,0,0.5)]">
                  <svg className="w-12 h-12 text-[#1dff00] drop-shadow-[0_0_10px_rgba(29,255,0,0.8)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-2xl font-bold text-[#1dff00] drop-shadow-[0_0_20px_rgba(29,255,0,0.6)]">
                  Drop to Import Resume
                </p>
                <p className="text-sm text-gray-400">
                  Supports PDF, DOC, DOCX, TXT, and JSON formats
                </p>
              </div>
            </div>
          </motion.div>
        )}
        </div>
      </div>
    </div>
  );
};
