import { t } from "@lingui/macro";
import { ScrollArea } from "@reactive-resume/ui";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { GridView } from "./_layouts/grid";

export const CoverLettersPage = () => {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <Helmet>
        <title>
          {t`Cover Letters`} - JobRaker
        </title>
      </Helmet>

      <div className="space-y-6">
        <div className="rounded-lg border border-[#1dff00]/20 bg-[#1dff00]/5 px-4 py-3 text-[11px] text-[#1dff00]/80 flex flex-wrap items-center gap-2">
          <span className="font-medium text-[#1dff00]">Tip:</span>
          <span>Create or select a cover letter below to open the editor. Your letters are saved locally and can be exported as PDF, DOCX, or TXT.</span>
        </div>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <motion.h1
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl sm:text-3xl font-semibold tracking-tight text-white"
          >
            {t`Cover Letters`}
          </motion.h1>
        </div>

        <ScrollArea
          allowOverflow
          className="h-[calc(100vh-150px)] lg:h-[calc(100vh-110px)] overflow-visible border-t border-[#1dff00]/10"
        >
          <GridView />
        </ScrollArea>
      </div>
    </div>
  );
};
