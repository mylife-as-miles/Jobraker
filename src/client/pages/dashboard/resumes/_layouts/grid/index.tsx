import { AnimatePresence, motion } from "framer-motion";
import { useResumes } from "@/hooks/useResumes";

import { BaseCard } from "./_components/base-card";
import { CreateResumeCard } from "./_components/create-card";
import { ImportResumeCard } from "./_components/import-card";
import { SbResumeCard } from "./_components/sb-resume-card";

export const GridView = () => {
  const { resumes, loading } = useResumes();
  const items = Array.isArray(resumes) ? resumes : [];

  return (
  <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }}>
        <CreateResumeCard />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0, transition: { delay: 0.1 } }}
      >
        <ImportResumeCard />
      </motion.div>

      {loading &&
        Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="duration-300 animate-in fade-in"
            style={{ animationFillMode: "backwards", animationDelay: `${i * 300}ms` }}
          >
            <BaseCard />
          </div>
        ))}

      {items.length > 0 && (
        <AnimatePresence>
          {items.map((resume, index) => (
            <motion.div
              key={resume.id}
              layout
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0, transition: { delay: (index + 2) * 0.1 } }}
              exit={{ opacity: 0, filter: "blur(8px)", transition: { duration: 0.5 } }}
            >
              <SbResumeCard resume={resume} />
            </motion.div>
          ))}
        </AnimatePresence>
      )}

      {!loading && items.length === 0 && (
        <div className="sm:col-span-3 xl:col-span-4 2xl:col-span-5">
          <div className="flex flex-col items-center justify-center rounded-xl border border-[#1dff00]/20 bg-black/30 p-10 text-center backdrop-blur-sm">
            <img src="/screenshots/builder.jpg" alt="Resume builder" className="mb-4 h-28 w-auto rounded-md opacity-80" />
            <h3 className="text-lg font-semibold text-white">No resumes yet</h3>
            <p className="mt-1 max-w-md text-sm text-white/70">Create your first resume to get started, or import an existing one.</p>
            <div className="mt-4 flex gap-3">
              <a href="/dashboard/resumes/new" className="inline-flex h-10 items-center rounded-xl bg-[#1dff00] px-4 text-black shadow transition hover:opacity-90">Create resume</a>
              <a href="#" className="inline-flex h-10 items-center rounded-xl border border-[#1dff00]/40 px-4 text-[#1dff00] hover:bg-[#1dff00]/10">Import</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
