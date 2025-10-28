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
      className="group relative flex h-[300px] flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-[#1dff00]/30 bg-gradient-to-br from-[#1dff00]/5 via-transparent to-[#1dff00]/5 p-6 transition-all hover:border-[#1dff00]/60 hover:from-[#1dff00]/10 hover:to-[#1dff00]/10 hover:shadow-[0_0_30px_-5px_rgba(29,255,0,0.3)]"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#1dff00]/40 bg-[#1dff00]/10 transition-all group-hover:border-[#1dff00] group-hover:bg-[#1dff00]/20 group-hover:scale-110">
        <Plus className="h-8 w-8 text-[#1dff00]" />
      </div>
      
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white mb-1">
          Create Cover Letter
        </h3>
        <p className="text-sm text-gray-400">
          Start a new cover letter from scratch
        </p>
      </div>

      {/* Glow effect on hover */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[#1dff00]/0 via-[#1dff00]/5 to-[#1dff00]/0 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
};
