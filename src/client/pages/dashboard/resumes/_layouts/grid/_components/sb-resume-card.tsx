import { t } from "@lingui/macro";
import { Lock } from "@phosphor-icons/react";
import dayjs from "dayjs";
import { AnimatePresence, motion } from "framer-motion";

import { BaseCard } from "./base-card";
import type { ResumeRecord } from "@/hooks/useResumes";
import { useResumes } from "@/hooks/useResumes";

type Props = { resume: ResumeRecord };

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

      <img
        src={`/templates/jpg/${template}.jpg`}
        alt={template}
        className="rounded-xl opacity-90 contrast-110"
        onError={(e) => {
          // Fallback if the template image is missing
          (e.currentTarget as HTMLImageElement).src = "/templates/jpg/Modern.jpg";
        }}
      />
    </BaseCard>
  );
};
