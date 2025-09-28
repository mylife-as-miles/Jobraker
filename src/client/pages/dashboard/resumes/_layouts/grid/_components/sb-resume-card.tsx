import { t } from "@lingui/macro";
import { Lock } from "@phosphor-icons/react";
import dayjs from "dayjs";
import { AnimatePresence, motion } from "framer-motion";

import { BaseCard } from "./base-card";
import type { ResumeRecord } from "@/hooks/useResumes";
import { useResumes } from "@/hooks/useResumes";
import React, { useEffect, useRef, useState } from "react";

type Props = { resume: ResumeRecord };

// Lightweight PDF first-page preview component (lazy loads pdfjs only when needed)
const PdfFirstPage: React.FC<{ resume: ResumeRecord }> = ({ resume }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getSignedUrl } = useResumes();

  useEffect(() => {
    let cancelled = false;
    if (resume.file_ext !== 'pdf' || !resume.file_path) { setLoading(false); return; }
    (async () => {
      try {
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
        const viewport = page.getViewport({ scale: 0.35 }); // scale down for card
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Preview failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [resume.file_ext, resume.file_path, getSignedUrl]);

  if (error) return null; // Let parent fallback show
  if (loading) return (
    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-[#1dff00]/60 animate-pulse select-none">
      Loading…
    </div>
  );
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover rounded-sm" />;
};

export const SbResumeCard = ({ resume }: Props) => {
  const { view } = useResumes();
  const template = resume.template || "Modern";
  const lastUpdated = dayjs().to(new Date(resume.updated_at));

  const onOpen = async () => {
    // For now open the stored file (signed URL or local object URL if set)
    await view(resume);
  };

  return (
    <BaseCard className="cursor-pointer space-y-0" onDoubleClick={onOpen}>
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

      <div
        className={
          "absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end space-y-0.5 p-4 pt-12 bg-gradient-to-t from-black/80 to-transparent"
        }
      >
        <h4 className="line-clamp-2 font-medium">{resume.name}</h4>
        <p className="line-clamp-1 text-xs opacity-75">{t`Last updated ${lastUpdated}`}</p>
      </div>

      <div className="relative w-full h-full">
        {/* PDF preview if available */}
        {resume.file_ext === 'pdf' && resume.file_path && (
          <PdfFirstPage resume={resume} />
        )}
        {/* Fallback image (shows underneath the canvas or if PDF not available) */}
        <img
          src={`/templates/jpg/${template}.jpg`}
          alt={template}
          className={`rounded-sm opacity-90 contrast-110 ${resume.file_ext === 'pdf' ? 'invisible aria-hidden' : ''}`}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/templates/jpg/Modern.jpg";
          }}
        />
      </div>
    </BaseCard>
  );
};
