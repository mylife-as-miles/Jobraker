import { t } from "@lingui/macro";
import { Lock } from "@phosphor-icons/react";
import { Eye, Download, Copy, Star, StarOff, Trash2, Pencil, CheckSquare2, Square } from "lucide-react";
import dayjs from "dayjs";
import { AnimatePresence, motion } from "framer-motion";

import { BaseCard } from "./base-card";
import { useToast } from "@/client/hooks/use-toast";
import type { ResumeRecord } from "@/hooks/useResumes";
import { useResumes } from "@/hooks/useResumes";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useResumeSelection } from '@/client/stores/resumeSelection';

type Props = { resume: ResumeRecord };

// In-memory cache for rendered PDF first-page previews (data URLs)
const pdfPreviewCache = new Map<string, string>();

// Lightweight PDF first-page preview component (lazy loads pdfjs only when needed)
const PdfFirstPage: React.FC<{ resume: ResumeRecord; active: boolean }> = ({ resume, active }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const { getSignedUrl } = useResumes();

  useEffect(() => {
    let cancelled = false;
  if (!active) return; // Wait until card observed in viewport
  if (resume.file_ext !== 'pdf' || !resume.file_path) { setLoading(false); return; }
    // Serve from cache if available
    if (pdfPreviewCache.has(resume.id)) {
      setDataUrl(pdfPreviewCache.get(resume.id)!);
      setLoading(false);
      return;
    }
    (async () => {
      try {
  performance.mark(`resume:${resume.id}:preview:start`);
  const url = await getSignedUrl(resume.file_path!);
        if (!url) throw new Error('No signed URL');
        // Dynamic import to avoid bloating initial bundle
        const pdfjs = await import('pdfjs-dist');
        // Some bundlers need explicit worker; attempt safe set
        try {
          // @ts-ignore
          if (pdfjs.GlobalWorkerOptions && !(pdfjs as any)._workerConfigured) {
            // Try to use the auto worker build if available
            // @ts-ignore
            pdfjs.GlobalWorkerOptions.workerSrc = (pdfjs as any).WorkerMessageHandler ? undefined : undefined;
            (pdfjs as any)._workerConfigured = true;
          }
        } catch {}
        // @ts-ignore
        const doc = await pdfjs.getDocument({ url, verbosity: 0 }).promise;
        const page = await doc.getPage(1);
        if (cancelled) return;
        // Determine scale relative to desired card width (~260px) for sharper image
        const targetWidth = 260;
        const unscaled = page.getViewport({ scale: 1 });
        const scale = Math.min(1, targetWidth / unscaled.width);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        // Low-quality placeholder render
        try {
          const lqScale = 0.08 * scale;
          const lqViewport = page.getViewport({ scale: lqScale });
          const off = document.createElement('canvas');
          off.width = lqViewport.width; off.height = lqViewport.height;
          await page.render({ canvasContext: off.getContext('2d')!, viewport: lqViewport, }).promise;
          // Draw scaled-up blurred placeholder
          canvas.width = viewport.width; canvas.height = viewport.height;
          ctx.filter = 'blur(3px) saturate(1.2)';
          ctx.drawImage(off, 0, 0, viewport.width, viewport.height);
          ctx.filter = 'none';
        } catch {}
        // High-quality render over it
        await page.render({ canvasContext: ctx, viewport }).promise;
        try {
          const urlData = canvas.toDataURL('image/png');
          pdfPreviewCache.set(resume.id, urlData);
          if (!cancelled) setDataUrl(urlData);
          performance.mark(`resume:${resume.id}:preview:end`);
          performance.measure(`resume:${resume.id}:preview:duration`, `resume:${resume.id}:preview:start`, `resume:${resume.id}:preview:end`);
        } catch {}
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Preview failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [active, resume.file_ext, resume.file_path, getSignedUrl]);

  if (error) return null; // Let parent fallback show
  return (
    <>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-[#1dff00]/60 animate-pulse select-none">
          Loading…
        </div>
      )}
      {/* When cached, show <img>; otherwise canvas until captured */}
      {dataUrl ? (
        <img
          src={dataUrl}
            alt="PDF Preview"
            className="absolute inset-0 w-full h-full object-cover rounded-sm will-change-transform opacity-0 animate-in fade-in zoom-in-50 duration-500"
        />
      ) : (
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover rounded-sm opacity-0 animate-in fade-in duration-300" />
      )}
    </>
  );
};

export const SbResumeCard = ({ resume }: Props) => {
  const { view, download, duplicate, toggleFavorite, remove, rename, undoRemove } = useResumes() as any;
  const { toast } = useToast();
  const template = resume.template || "Modern";
  const lastUpdated = dayjs().to(new Date(resume.updated_at));
  const [inView, setInView] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(resume.name);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { selected, toggle, selectOnly, lastSelected } = useResumeSelection();
  const isSelected = selected.includes(resume.id);

  // Shift + click range selection support (delegated in Grid container but basic here)
  const onSelectClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey && lastSelected && lastSelected !== resume.id) {
      // We'll dispatch a custom event the grid can listen to in future for range calculation
      const ev = new CustomEvent('resume-range-select', { detail: { anchor: lastSelected, target: resume.id } });
      window.dispatchEvent(ev);
      toggle(resume.id); // still toggle current
      return;
    }
    if (e.metaKey || e.ctrlKey) {
      toggle(resume.id);
      return;
    }
    // Plain click: if already sole selected keep; else select only
    if (!isSelected || selected.length > 1) selectOnly(resume.id); else toggle(resume.id); // allow deselect
  }, [toggle, selectOnly, isSelected, selected.length, resume.id, lastSelected]);

  // Keyboard select (focus not yet managed; placeholder for future a11y)
  const onKeyDownCard = (e: React.KeyboardEvent) => {
    if ((e.key === ' ' || e.key === 'Enter') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      toggle(resume.id);
    }
  };

  // Observe element for lazy-loading preview
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      });
    }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onOpen = async () => {
    // For now open the stored file (signed URL or local object URL if set)
    await view(resume);
  };

  const commitRename = async () => {
    const next = draftName.trim();
    if (!next || next === resume.name) { setRenaming(false); setDraftName(resume.name); return; }
    await rename(resume.id, next);
    setRenaming(false);
  };


  // Preview trigger removed with three-dot menu; keep buildPreview for future integration.

  return (
    <BaseCard
      ref={cardRef as any}
      className={`cursor-pointer space-y-0 group relative ${isSelected ? 'ring-2 ring-[#1dff00] ring-offset-2 ring-offset-black/40' : ''}`}
      onDoubleClick={onOpen}
  onKeyDown={onKeyDownCard}
      aria-pressed={isSelected}
      aria-label={`Resume ${resume.name}${isSelected ? ' selected' : ''}`}
    >
      <AnimatePresence>
        {/* Placeholder: lock state not present on ResumeRecord; remove overlay */}
        {false && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <Lock width={42} height={42} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selection checkbox (always visible when selected; appears on hover otherwise) */}
      <button
        type="button"
        onClick={onSelectClick}
        className={`absolute top-2 left-2 z-30 p-1 rounded-md border transition shadow ${isSelected ? 'bg-[#1dff00] border-[#1dff00] text-black' : 'bg-black/60 border-white/10 text-white opacity-0 group-hover:opacity-100'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1dff00]/70`}
        aria-label={isSelected ? 'Deselect resume' : 'Select resume'}
      >
        {isSelected ? <CheckSquare2 className="w-4 h-4" /> : <Square className="w-4 h-4" />}
      </button>
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end space-y-1 p-3 pt-12 bg-gradient-to-t from-black/80 to-transparent">
        {renaming ? (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
              if (e.key === 'Escape') { e.preventDefault(); setRenaming(false); setDraftName(resume.name); }
            }}
            className="text-sm font-medium bg-black/40 border border-white/20 rounded px-1.5 py-1 outline-none focus:border-[#1dff00]"
          />
        ) : (
          <h4 className="line-clamp-2 font-medium flex items-center gap-1">
            {resume.name}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setRenaming(true); setDraftName(resume.name); }}
              className="opacity-0 group-hover:opacity-70 hover:opacity-100 transition text-xs text-white/70"
              aria-label="Rename resume"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </h4>
        )}
        <p className="line-clamp-1 text-[10px] opacity-70">{t`Last updated ${lastUpdated}`}</p>
      </div>

  {/* Hover action toolbar (shift to below checkbox) */}
  <div className="absolute top-12 left-2 z-20 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
        <button
          onClick={(e)=>{ e.stopPropagation(); onOpen(); }}
          className="p-1.5 rounded-md bg-black/60 border border-white/10 hover:border-[#1dff00]/60 hover:bg-black/80 text-white transition flex items-center justify-center"
          title="Open"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e)=>{ e.stopPropagation(); download(resume); }}
          className="p-1.5 rounded-md bg-black/60 border border-white/10 hover:border-[#1dff00]/60 hover:bg-black/80 text-white transition flex items-center justify-center"
          title="Download"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e)=>{ e.stopPropagation(); duplicate(resume); }}
          className="p-1.5 rounded-md bg-black/60 border border-white/10 hover:border-[#1dff00]/60 hover:bg-black/80 text-white transition flex items-center justify-center"
          title="Duplicate"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e)=>{ e.stopPropagation(); toggleFavorite(resume.id, !resume.is_favorite); }}
          className={`p-1.5 rounded-md bg-black/60 border ${resume.is_favorite ? 'border-[#1dff00] text-[#1dff00]' : 'border-white/10 text-white'} hover:border-[#1dff00]/60 hover:text-[#1dff00] hover:bg-black/80 transition flex items-center justify-center`}
          title={resume.is_favorite ? 'Unfavorite' : 'Favorite'}
        >
          {resume.is_favorite ? <Star className="w-3.5 h-3.5" /> : <StarOff className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={(e)=>{ 
            e.stopPropagation(); 
            const id = resume.id;
            const name = resume.name;
            remove(resume);
            toast({
              title: 'Resume deleted',
              description: name,
              action: (
                <button
                  onClick={(ev)=>{ ev.stopPropagation(); undoRemove(id); }}
                  className="px-2 py-1 text-[10px] rounded bg-[#1dff00]/20 border border-[#1dff00]/40 text-[#1dff00] hover:bg-[#1dff00]/30 transition"
                >Undo</button>
              )
            });
          }}
          className="p-1.5 rounded-md bg-black/60 border border-white/10 hover:border-red-500/70 hover:text-red-400 hover:bg-black/80 text-white transition flex items-center justify-center"
          title="Delete"
          aria-label="Delete resume"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* (Removed three-dot menu) */}

      <div className="relative w-full h-full">
        {/* PDF preview if available */}
        {resume.file_ext === 'pdf' && resume.file_path && (
          <PdfFirstPage resume={resume} active={inView} />
        )}
        {/* Fallback image (shows underneath the canvas or if PDF not available) */}
        <img
          src={`/templates/jpg/${encodeURIComponent((template || 'Modern').trim() || 'Modern')}.jpg`}
          alt={template}
          className={`