import { t } from "@lingui/macro";
import { ScrollArea } from "@reactive-resume/ui";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";

import { GridView } from "./_layouts/grid";

export const ResumesPage = () => {

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <Helmet>
        <title>
          {t`Resumes`} - JobRaker
        </title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <motion.h1
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl sm:text-3xl font-semibold tracking-tight text-white"
          >
            {t`Resumes`}
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
