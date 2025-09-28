import { t } from "@lingui/macro";
import { Plus } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";

export const CreateResumeListItem = () => {
  const navigate = useNavigate();
  return (
    <div
      className="relative flex items-center justify-start gap-3 rounded-xl border p-3 cursor-pointer bg-gradient-to-r from-[#111111] to-[#0a0a0a] border-[#1dff00]/20 hover:border-[#1dff00]/40 hover:bg-[#1dff00]/5 transition-colors"
      onClick={() => navigate('/builder/new')}
      onDoubleClick={() => navigate('/builder/new')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/builder/new'); } }}
      aria-label={t`Create resume`}
    >
      <div className="flex size-8 items-center justify-center rounded bg-[#1dff00]/10">
        <Plus width={16} height={16} className="text-[#1dff00]" />
      </div>
      <span className="text-sm opacity-90">{t`Create Resume`}</span>
    </div>
  );
};
