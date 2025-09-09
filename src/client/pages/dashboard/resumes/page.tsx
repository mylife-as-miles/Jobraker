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
  const { importMultiple } = useResumes();
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
