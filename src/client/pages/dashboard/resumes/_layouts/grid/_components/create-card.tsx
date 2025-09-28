import { t } from "@lingui/macro";
import { Plus } from "@phosphor-icons/react";
import { BaseCard } from "./base-card";
import { useNavigate } from "react-router-dom";
import slugify from "@sindresorhus/slugify";
import { generateRandomName } from "@reactive-resume/utils";
import { useCreateResume } from "@/client/services/resume";
import { useState, useCallback } from "react";

export const CreateResumeCard = () => {
  const navigate = useNavigate();
  const { createResume, loading } = useCreateResume();
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (creating || loading) return;
    try {
      setCreating(true);
      const title = generateRandomName();
      const slug = slugify(title);
      const res = await createResume({ title, slug, visibility: "private" as const });
      navigate(`/builder/${res.id}`, { replace: false, state: { resume: res } });
    } catch (e) {
      // Silent fail for now; could add toast if desired
    } finally {
      setCreating(false);
    }
  }, [creating, loading, createResume, navigate]);

  return (
    <BaseCard
      onClick={handleCreate}
      onDoubleClick={handleCreate}
      className="group"
    >
      <div className="flex flex-col items-center justify-center gap-2 text-center">
        <div className={`flex size-10 items-center justify-center rounded-full bg-[#1dff00]/10 group-hover:bg-[#1dff00]/20 transition-colors ${creating ? 'animate-pulse' : ''}`}>
          <Plus width={18} height={18} className="text-[#1dff00]" />
        </div>
        <p className="text-sm text-white/90">
          {creating ? t`Creating…` : t`Create Resume`}
        </p>
      </div>
    </BaseCard>
  );
};
