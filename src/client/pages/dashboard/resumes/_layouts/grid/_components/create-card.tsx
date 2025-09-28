import { t } from "@lingui/macro";
import { Plus } from "@phosphor-icons/react";
import { BaseCard } from "./base-card";
// Temporarily disabled – navigation removed

export const CreateResumeCard = () => {
  return (
    <BaseCard
      className="group opacity-40 cursor-not-allowed relative"
      onClick={() => { /* locked */ }}
      onDoubleClick={() => { /* locked */ }}
    >
      <div className="flex flex-col items-center justify-center gap-2 text-center select-none">
        <div className="flex size-10 items-center justify-center rounded-full bg-[#1dff00]/5 border border-[#1dff00]/20 relative">
          <Plus width={18} height={18} className="text-[#1dff00] opacity-60" />
          <span className="absolute -bottom-1 text-[10px] font-medium text-[#1dff00]/70 tracking-wide">LOCKED</span>
        </div>
        <p className="text-sm text-white/60">{t`Create Resume Unavailable`}</p>
        <p className="text-[10px] text-white/30">{t`Temporarily disabled`}</p>
      </div>
    </BaseCard>
  );
};
