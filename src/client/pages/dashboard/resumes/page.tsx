import { t } from "@lingui/macro";
import { List, SquaresFour } from "@phosphor-icons/react";
import { ScrollArea, Tabs, TabsList, TabsTrigger } from "@reactive-resume/ui";
import { motion } from "framer-motion";
import { useState } from "react";
import { Helmet } from "react-helmet-async";

import { GridView } from "./_layouts/grid";
import { ListView } from "./_layouts/list";

type Layout = "grid" | "list";

export const ResumesPage = () => {
  const [layout, setLayout] = useState<Layout>("grid");

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <Helmet>
        <title>
          {t`Resumes`} - JobRaker
        </title>
      </Helmet>

      <Tabs
        value={layout}
        className="space-y-6"
        onValueChange={(value) => setLayout(value as Layout)}
      >
        <div className="flex items-center justify-between">
          <motion.h1
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl sm:text-3xl font-semibold tracking-tight text-white"
          >
            {t`Resumes`}
          </motion.h1>

          <TabsList className="bg-[#0a0a0a]/80 border border-[#1dff00]/20 rounded-xl p-1 backdrop-blur-[20px] flex items-center shadow-[0_0_24px_-12px_rgba(29,255,0,0.4)]">
            <TabsTrigger
              value="grid"
              onClick={() => setLayout("grid")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 h-8 text-xs sm:text-sm transition-all duration-200
                ${layout === "grid" ? "bg-[#1dff00] text-black shadow" : "text-white/80 hover:text-white hover:bg-white/10"}`}
            >
              <SquaresFour className="h-4 w-4" />
              <span className="hidden sm:block">{t`Grid`}</span>
            </TabsTrigger>
            <TabsTrigger
              value="list"
              onClick={() => setLayout("list")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 h-8 text-xs sm:text-sm transition-all duration-200
                ${layout === "list" ? "bg-[#1dff00] text-black shadow" : "text-white/80 hover:text-white hover:bg-white/10"}`}
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:block">{t`List`}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea
          allowOverflow
          className="h-[calc(100vh-150px)] lg:h-[calc(100vh-110px)] overflow-visible border-t border-[#1dff00]/10"
        >
          {layout === "grid" ? <GridView /> : <ListView />}
        </ScrollArea>
      </Tabs>
    </div>
  );
};
