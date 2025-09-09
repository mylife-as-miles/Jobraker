import { t } from "@lingui/macro";
import { ScrollArea } from "@reactive-resume/ui";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";

import { GridView } from "./_layouts/grid";
import { useRef, useState, useCallback } from 'react';
import { useResumes } from '@/hooks/useResumes';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

export const ResumesPage = () => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { importMultiple, importStatuses } = useResumes();
  const [dragActive, setDragActive] = useState(false);

  const handlePick = () => fileRef.current?.click();
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    await importMultiple(files);
    e.target.value = '';
  };

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
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <motion.h1
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl sm:text-3xl font-semibold tracking-tight text-white"
          >
            {t`Resume Builder`}
          </motion.h1>
          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,.json" hidden onChange={handleFile} />
            <Button onClick={handlePick} variant="outline" className="border-[#1dff00]/40 text-[#1dff00] hover:bg-[#1dff00]/10">
              <Upload className="w-4 h-4 mr-2" /> {dragActive ? 'Drop files...' : 'Import Resumes'}
            </Button>
          </div>
        </div>

        <div 
          onDragEnter={onDrag}
          onDragOver={onDrag}
          onDragLeave={onDrag}
          onDrop={onDrop}
          className={`relative ${dragActive ? 'ring-2 ring-[#1dff00] ring-offset-2 ring-offset-black rounded-lg transition' : ''}`}
        >
        {importStatuses.length > 0 && (
          <div className="mb-4 space-y-2">
            <h2 className="text-sm font-medium text-[#1dff00]/80">Recent Imports</h2>
            <ul className="max-h-40 overflow-auto thin-scrollbar pr-1 text-xs divide-y divide-[#1dff00]/10 border border-[#1dff00]/10 rounded-md bg-black/30 backdrop-blur-sm">
              {importStatuses.slice(0,12).map(st => (
                <li key={st.id} className="flex items-start justify-between gap-3 px-3 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[#1dff00] font-medium">{st.name}</p>
                    <p className="text-[10px] text-[#1dff00]/60">
                      {(st.size/1024).toFixed(1)} KB
                      {st.error && <span className="ml-2 text-red-400">{st.error}</span>}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#1dff00]/10 border border-[#1dff00]/30 text-[#1dff00]">
                    {st.state === 'pending' && 'Queued'}
                    {st.state === 'uploading' && 'Uploading'}
                    {st.state === 'done' && 'Done'}
                    {st.state === 'error' && 'Error'}
                  </span>
                </li>
              ))}
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
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[#1dff00] font-medium text-sm backdrop-blur-[2px] bg-black/40 rounded-lg">
            Drop to import
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
