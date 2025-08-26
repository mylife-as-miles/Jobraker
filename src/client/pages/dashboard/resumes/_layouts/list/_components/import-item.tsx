import { t } from "@lingui/macro";
import { DownloadSimple } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";

export const ImportResumeListItem = () => {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-start gap-3 rounded-md border p-3 cursor-pointer bg-gradient-to-r from-[#111111] to-[#0a0a0a] border-[#1dff00]/20 hover:border-[#1dff00]/40 hover:bg-[#1dff00]/5 transition-colors"
      onClick={() => navigate("/dashboard/resumes/import")}>
      <div className="flex size-8 items-center justify-center rounded bg-[#1dff00]/10">
        <DownloadSimple size={16} className="text-[#1dff00]" />
      </div>
      <span className="text-sm opacity-90">{t`Import Resume`}</span>
    </div>
  );
};
