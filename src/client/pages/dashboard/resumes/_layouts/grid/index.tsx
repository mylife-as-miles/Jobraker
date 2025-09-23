import { AnimatePresence, motion } from "framer-motion";
import { useResumes } from "@/hooks/useResumes";
import { useProfileSettings } from "@/hooks/useProfileSettings";

import { BaseCard } from "./_components/base-card";
import { CreateResumeCard } from "./_components/create-card";
import { ImportResumeCard } from "./_components/import-card";
import { SbResumeCard } from "./_components/sb-resume-card";
import { EmptyState } from "@/components/ui/empty-state";

export const GridView = () => {
  const { resumes, loading } = useResumes();
  // Pull profile so base_resume changes reflect immediately in UI
  useProfileSettings();
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
          <EmptyState
            title="No resumes yet"
            description="Create your first resume to get started, or import an existing one."
            illustrationSrc="/screenshots/builder.jpg"
            primaryAction={{ label: "Create resume", href: "/dashboard/resumes/new" }}
            secondaryAction={{ label: "Import" }}
          />
        </div>
      )}
    </div>
  );
};
