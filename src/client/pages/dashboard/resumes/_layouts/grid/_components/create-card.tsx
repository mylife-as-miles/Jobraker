import { t } from "@lingui/macro";
import { Plus } from "@phosphor-icons/react";
import { BaseCard } from "./base-card";
import { useNavigate } from "react-router-dom";

// Feature flag strategy:
// 1. Build-time: import.meta.env.VITE_ENABLE_CREATE_RESUME === 'true'
// 2. Runtime override: localStorage['feature:createResume'] === '1'
// Set via DevTools: localStorage.setItem('feature:createResume','1'); location.reload();
// Disable: localStorage.removeItem('feature:createResume'); location.reload();
const isFeatureEnabled = () => {
  try {
    const runtime = localStorage.getItem('feature:createResume');
    if (runtime != null) return runtime === '1';
  } catch { /* ignore */ }
  return import.meta.env.VITE_ENABLE_CREATE_RESUME === 'true';
};

export const CreateResumeCard = () => {
  const navigate = useNavigate();
  const enabled = isFeatureEnabled();

  if (!enabled) {
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
          <p className="text-[10px] text-white/30" title="Use localStorage feature:createResume=1 to enable">{t`Temporarily disabled`}</p>
        </div>
      </BaseCard>
    );
  }

  // Enabled behavior => original navigation
  return (
    <BaseCard
      onClick={() => navigate('/builder/new')}
      onDoubleClick={() => navigate('/builder/new')}
      className="group"
    >
      <div className="flex flex-col items-center justify-center gap-2 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-[#1dff00]/10 group-hover:bg-[#1dff00]/20 transition-colors">
          <Plus width={18} height={18} className="text-[#1dff00]" />
        </div>
        <p className="text-sm text-white/90">{t`Create Resume`}</p>
      </div>
    </BaseCard>
  );
};
