import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const CreateCoverLetterCard = () => {
  const navigate = useNavigate();

  const handleCreate = () => {
    // Clear current draft and navigate to editor
    const STORAGE_KEY = "jr.coverLetter.draft.v2";
    const LIB_DEFAULT_KEY = "jr.coverLetters.defaultId";
    
    // Clear the current draft
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LIB_DEFAULT_KEY);
    
    // Navigate to cover letter editor with edit mode
    navigate('/dashboard/cover-letter?edit=true');
  };

  return (
    <button
      onClick={handleCreate}
      className="group relative flex h-[300px] flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed border-[#1dff00]/30 bg-gradient-to-br from-[#0a0a0a]/60 via-[#0f0f0f]/60 to-[#0a0a0a]/60 backdrop-blur-xl p-8 transition-all duration-500 hover:border-[#1dff00]/70 hover:bg-gradient-to-br hover:from-[#1dff00]/15 hover:via-[#1dff00]/10 hover:to-[#1dff00]/5 hover:shadow-[0_0_50px_rgba(29,255,0,0.35)] hover:scale-[1.03] active:scale-[0.98]"
    >
      {/* Animated icon container */}
      <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-[#1dff00]/50 bg-gradient-to-br from-[#1dff00]/15 to-[#1dff00]/5 shadow-[0_0_25px_rgba(29,255,0,0.2)] transition-all duration-500 group-hover:border-[#1dff00] group-hover:bg-gradient-to-br group-hover:from-[#1dff00]/25 group-hover:to-[#1dff00]/10 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-[0_0_40px_rgba(29,255,0,0.4)]">
        <Plus className="h-10 w-10 text-[#1dff00] drop-shadow-[0_0_10px_rgba(29,255,0,0.8)] transition-transform duration-500 group-hover:scale-110 group-hover:rotate-90" />
        
        {/* Pulsing ring */}
        <div className="absolute inset-0 rounded-2xl border-2 border-[#1dff00]/30 animate-ping opacity-0 group-hover:opacity-100" />
      </div>
      
      <div className="text-center space-y-2">
        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-[#1dff00] transition-colors duration-300 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] group-hover:drop-shadow-[0_0_20px_rgba(29,255,0,0.8)]">
          Create Cover Letter
        </h3>
        <p className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors duration-300 leading-relaxed px-2">
          Start a new cover letter from scratch with AI-powered assistance
        </p>
      </div>

      {/* Multi-layered glow effects */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#1dff00]/0 via-[#1dff00]/10 to-[#1dff00]/0 opacity-0 transition-all duration-500 group-hover:opacity-100 blur-xl" />
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-tl from-[#1dff00]/0 via-[#1dff00]/5 to-[#1dff00]/0 opacity-0 transition-all duration-700 group-hover:opacity-100" />
      
      {/* Corner accent glows */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-[#1dff00]/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-[#1dff00]/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      {/* Animated border glow */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className="absolute inset-0 rounded-2xl border border-[#1dff00]/50 blur-sm animate-pulse" />
      </div>
    </button>
  );
};
