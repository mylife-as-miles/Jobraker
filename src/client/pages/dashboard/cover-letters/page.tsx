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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="relative">
            <span className="font-bold text-[#1dff00] text-base tracking-wide drop-shadow-[0_0_10px_rgba(29,255,0,0.5)]">Pro Tip:</span>
            <span className="text-[#1dff00]/90 ml-2.5 leading-relaxed">Create or select a cover letter below to open the editor. Your letters are saved locally and can be exported as PDF, DOCX, or TXT.</span>
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
              {t`Cover Letters`}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
              className="text-gray-400 text-base"
            >
              Craft compelling cover letters tailored to your dream job
            </motion.p>
          </div>
          
          {/* Additional quick actions could go here */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="flex items-center gap-3"
          >
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-br from-[#1dff00]/10 to-[#1dff00]/5 border border-[#1dff00]/30 backdrop-blur-xl">
              <svg className="w-4 h-4 text-[#1dff00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm font-medium text-[#1dff00]">Library</span>
            </div>
          </motion.div>
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
