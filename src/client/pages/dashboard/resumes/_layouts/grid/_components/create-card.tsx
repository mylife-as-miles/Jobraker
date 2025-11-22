import { t } from "@lingui/macro";
import { Plus } from "@phosphor-icons/react";
import { BaseCard } from "./base-card";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

// Feature flag strategy:
// 1. Build-time: import.meta.env.VITE_ENABLE_CREATE_RESUME === 'true'
// 2. Runtime override: localStorage['feature:createResume'] === '1'
// 3. Admin bypass: Admins always have access
// Set via DevTools: localStorage.setItem('feature:createResume','1'); location.reload();
// Disable: localStorage.removeItem('feature:createResume'); location.reload();
const isFeatureEnabled = async () => {
  try {
    const runtime = localStorage.getItem('feature:createResume');
    if (runtime != null) return runtime === '1';
  } catch { /* ignore */ }
  
  // Check if user is admin
  try {
    const { isCurrentUserAdmin } = await import('@/lib/adminUtils');
    const isAdmin = await isCurrentUserAdmin();
    if (isAdmin) return true;
  } catch (error) {
    console.error('Error checking admin status:', error);
  }
  
  return import.meta.env.VITE_ENABLE_CREATE_RESUME === 'true';
};

export const CreateResumeCard = () => {
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    isFeatureEnabled().then((result) => {
      setEnabled(result);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <BaseCard
        className="opacity-50 cursor-wait"
      >
        <div className="flex flex-col items-center justify-center gap-4 text-center select-none h-full">
          <div className="relative flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-[#1dff00]/10 to-[#1dff00]/5 border-2 border-[#1dff00]/20">
            <div className="w-6 h-6 border-2 border-[#1dff00]/20 border-t-[#1dff00] rounded-full animate-spin" />
          </div>
          <p className="text-sm text-white/40">Loading...</p>
        </div>
      </BaseCard>
    );
  }

  if (!enabled) {
    return (
      <BaseCard
        className="group opacity-50 cursor-not-allowed relative overflow-hidden"
        onClick={() => { /* locked */ }}
        onDoubleClick={() => { /* locked */ }}
      >
        <div className="flex flex-col items-center justify-center gap-4 text-center select-none h-full">
          <div className="relative flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-[#1dff00]/10 to-[#1dff00]/5 border-2 border-[#1dff00]/20">
            <Plus width={24} height={24} className="text-[#1dff00] opacity-40" />
            <div className="absolute -bottom-2 px-2 py-0.5 text-[10px] font-bold text-[#1dff00]/50 tracking-wider bg-black/80 rounded border border-[#1dff00]/20">
              LOCKED
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white/40">{t`Create Resume`}</p>
            <p className="text-[11px] text-white/30" title="Use localStorage feature:createResume=1 to enable">
              {t`Temporarily disabled`}
            </p>
          </div>
        </div>
      </BaseCard>
    );
  }

  // Enabled behavior => original navigation
  return (
    <BaseCard
      onClick={() => navigate('/builder/new')}
      onDoubleClick={() => navigate('/builder/new')}
      className="group cursor-pointer overflow-hidden"
    >
      <div className="relative flex flex-col items-center justify-center gap-5 text-center h-full transition-all duration-500 group-hover:scale-[1.02]">
        {/* Animated icon container */}
        <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl border-2 border-[#1dff00]/50 bg-gradient-to-br from-[#1dff00]/15 to-[#1dff00]/5 shadow-[0_0_25px_rgba(29,255,0,0.2)] transition-all duration-500 group-hover:border-[#1dff00] group-hover:bg-gradient-to-br group-hover:from-[#1dff00]/25 group-hover:to-[#1dff00]/10 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-[0_0_40px_rgba(29,255,0,0.4)]">
          <Plus width={32} height={32} className="text-[#1dff00] drop-shadow-[0_0_10px_rgba(29,255,0,0.8)] transition-transform duration-500 group-hover:scale-110 group-hover:rotate-90" />
          
          {/* Pulsing ring */}
          <div className="absolute inset-0 rounded-2xl border-2 border-[#1dff00]/30 animate-ping opacity-0 group-hover:opacity-100" />
        </div>
        
        <div className="space-y-2">
          <p className="text-lg font-bold text-white group-hover:text-[#1dff00] transition-colors duration-300 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] group-hover:drop-shadow-[0_0_20px_rgba(29,255,0,0.8)]">
            {t`Create Resume`}
          </p>
          <p className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors duration-300 leading-relaxed px-2">
            Start from scratch with our builder
          </p>
        </div>

        {/* Multi-layered glow effects */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#1dff00]/0 via-[#1dff00]/10 to-[#1dff00]/0 opacity-0 transition-all duration-500 group-hover:opacity-100 blur-xl" />
        <div className="absolute inset-0 rounded-xl bg-gradient-to-tl from-[#1dff00]/0 via-[#1dff00]/5 to-[#1dff00]/0 opacity-0 transition-all duration-700 group-hover:opacity-100" />
        
        {/* Corner accent glows */}
        <div className="absolute top-0 left-0 w-24 h-24 bg-[#1dff00]/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-24 h-24 bg-[#1dff00]/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        
        {/* Animated border glow */}
        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
          <div className="absolute inset-0 rounded-xl border border-[#1dff00]/50 blur-sm animate-pulse" />
        </div>
      </div>
    </BaseCard>
  );
};
