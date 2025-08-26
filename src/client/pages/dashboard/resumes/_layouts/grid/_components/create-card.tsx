import { t } from "@lingui/macro";
import { Plus } from "@phosphor-icons/react";
import { BaseCard } from "./base-card";
import { useNavigate } from "react-router-dom";

export const CreateResumeCard = () => {
  const navigate = useNavigate();
  return (
    <BaseCard onClick={() => navigate("/dashboard/resumes/new")} onDoubleClick={() => navigate("/dashboard/resumes/new")}
      className="group">
      <div className="flex flex-col items-center justify-center gap-2 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-[#1dff00]/10 group-hover:bg-[#1dff00]/20 transition-colors">
          <Plus width={18} height={18} className="text-[#1dff00]" />
        </div>
        <p className="text-sm text-white/90">{t`Create Resume`}</p>
      </div>
    </BaseCard>
  );
};
