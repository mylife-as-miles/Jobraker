import { t } from "@lingui/macro";
import { ScrollArea } from "@reactive-resume/ui";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { GridView } from "./_layouts/grid";

export const CoverLettersPage = () => {
  return (
    <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Ambient Background Glows */}
      <div className="fixed top-20 right-0 h-96 w-96 bg-[#1dff00]/5 rounded-full blur-3xl opacity-30 pointer-events-none -z-10" />
      <div className="fixed bottom-20 left-0 h-96 w-96 bg-[#1dff00]/5 rounded-full blur-3xl opacity-20 pointer-events-none -z-10" />
      
      <Helmet>
        <title>
          {t`Cover Letters`} - JobRaker
        </title>
      </Helmet>

      <div className="space-y-6">
        <div className="rounded-xl border border-[#1dff00]/30 bg-gradient-to-br from-[#1dff00]/10 to-[#1dff00]/5 px-5 py-4 text-xs text-[#1dff00] flex items-start gap-3 shadow-[0_0_25px_rgba(29,255,0,0.1)]">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1dff00]/20 border border-[#1dff00]/40 flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-[#1dff00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <span className="font-semibold text-[#1dff00] text-sm">Tip:</span>
            <span className="text-[#1dff00]/90 ml-2">Create or select a cover letter below to open the editor. Your letters are saved locally and can be exported as PDF, DOCX, or TXT.</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <motion.h1
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-white/95 to-[#1dff00] bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(29,255,0,0.3)]"
          >
            {t`Cover Letters`}
          </motion.h1>
        </div>

        <ScrollArea
          allowOverflow
          className="h-[calc(100vh-200px)] lg:h-[calc(100vh-160px)] overflow-visible border-t border-[#1dff00]/20"
        >
          <GridView />
        </ScrollArea>
      </div>
    </div>
  );
};
