import { t } from "@lingui/macro";
import { Plus } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import slugify from "@sindresorhus/slugify";
import { generateRandomName } from "@reactive-resume/utils";
import { useCreateResume } from "@/client/services/resume";
import { useState, useCallback } from "react";

export const CreateResumeListItem = () => {
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
      navigate(`/builder/${res.id}`, { state: { resume: res } });
    } catch {
      // optional: toast error
    } finally {
      setCreating(false);
    }
  }, [creating, loading, createResume, navigate]);

  return (
    <div
      className="flex items-center justify-start gap-3 rounded-xl border p-3 cursor-pointer bg-gradient-to-r from-[#111111] to-[#0a0a0a] border-[#1dff00]/20 hover:border-[#1dff00]/40 hover:bg-[#1dff00]/5 transition-colors"
      onClick={handleCreate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCreate(); } }}
      aria-label={creating ? 'Creating resume' : 'Create resume'}
    >
      <div className={`flex size-8 items-center justify-center rounded bg-[#1dff00]/10 ${creating ? 'animate-pulse' : ''}`}>
        <Plus width={16} height={16} className="text-[#1dff00]" />
      </div>
      <span className="text-sm opacity-90">{creating ? t`Creating…` : t`Create Resume`}</span>
    </div>
  );
};
