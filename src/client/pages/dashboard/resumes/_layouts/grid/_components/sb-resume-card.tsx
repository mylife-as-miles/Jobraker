import { t } from "@lingui/macro";
import { Lock } from "@phosphor-icons/react";
import { Star, Check } from "lucide-react";
import dayjs from "dayjs";
import { AnimatePresence, motion } from "framer-motion";

import { BaseCard } from "./base-card";
import type { ResumeRecord } from "@/hooks/useResumes";
import { useResumes } from "@/hooks/useResumes";
import { useProfileSettings } from "@/hooks/useProfileSettings";
import { Button } from "@/components/ui/button";

type Props = { resume: ResumeRecord };

export const SbResumeCard = ({ resume }: Props) => {
  const { view } = useResumes();
  const { profile, updateProfile } = useProfileSettings();
  const template = resume.template || "Modern";
  const lastUpdated = dayjs().to(new Date(resume.updated_at));

  const onOpen = async () => {
    // For now open the stored file (signed URL or local object URL if set)
    await view(resume);
  };

  const isBase = profile?.base_resume_id === resume.id;
  const markAsBase = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await updateProfile({ base_resume_id: resume.id });
    } catch {
      // handled in hook
    }
  };

  return (
    <BaseCard className="cursor-pointer space-y-0 relative" onDoubleClick={onOpen}>
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

      {/* Base resume badge/button */}
      <div className="absolute top-2 right-2 z-20">
        {isBase ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-[#1dff00]/15 text-[#1dff00] border border-[#1dff00]/30">
            <Check className="w-3 h-3" /> {t`Base resume`}
          </span>
        ) : (
          <Button size="sm" variant="outline" className="h-6 px-2 py-0 text-[10px] border-[#1dff00]/40 text-[#1dff00] hover:bg-[#1dff00]/10"
            onClick={markAsBase}
            title={t`Use this resume for job search & auto-apply`}
          >
            <Star className="w-3 h-3 mr-1" /> {t`Set as base`}
          </Button>
        )}
      </div>

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
