import { FileText, Calendar, Building2, Briefcase, Trash2, Eye, Pencil, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

type LibraryEntry = { id: string; name: string; updatedAt: string; data: any };

interface CoverLetterCardProps {
  letter: LibraryEntry;
  onDelete: () => void;
  isSelected: boolean;
  onToggleSelect: () => void;
}

const LIB_KEY = "jr.coverLetters.library.v1";
const LIB_DEFAULT_KEY = "jr.coverLetters.defaultId";
const STORAGE_KEY = "jr.coverLetter.draft.v2";

export const CoverLetterCard = ({ letter, onDelete, isSelected, onToggleSelect }: CoverLetterCardProps) => {
  const navigate = useNavigate();
  const [showPreview, setShowPreview] = useState(false);

  const handleOpen = () => {
    // Load this letter and navigate to editor
    localStorage.setItem(STORAGE_KEY, JSON.stringify(letter.data));
    localStorage.setItem(LIB_DEFAULT_KEY, letter.id);
    navigate('/dashboard/cover-letter?edit=true');
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${letter.name}"?`)) return;
    
    try {
      const libRaw = localStorage.getItem(LIB_KEY);
      if (libRaw) {
        const arr = JSON.parse(libRaw);
        const filtered = arr.filter((l: LibraryEntry) => l.id !== letter.id);
        localStorage.setItem(LIB_KEY, JSON.stringify(filtered));
        
        // Clear default if this was it
        const defaultId = localStorage.getItem(LIB_DEFAULT_KEY);
        if (defaultId === letter.id) {
          localStorage.removeItem(LIB_DEFAULT_KEY);
        }
        
        onDelete();
      }
    } catch {}
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Unknown date';
    }
  };

  const data = letter.data || {};
  const company = data.company || 'Company';
  const role = data.role || 'Position';
  const paragraphCount = Array.isArray(data.paragraphs) ? data.paragraphs.length : 0;
  const hasContent = data.content || paragraphCount > 0;

  return (
    <>
      <div
        className={`group relative flex h-[300px] flex-col rounded-2xl border backdrop-blur-xl transition-all duration-300 overflow-hidden ${
          isSelected
            ? 'border-[#1dff00] bg-gradient-to-br from-[#1dff00]/15 via-[#1dff00]/10 to-[#1dff00]/5 shadow-[0_0_30px_rgba(29,255,0,0.3)] scale-[1.02]'
            : 'border-[#1dff00]/20 bg-gradient-to-br from-[#0a0a0a]/95 via-[#0f0f0f]/95 to-[#0a0a0a]/95 hover:border-[#1dff00]/50 hover:shadow-[0_0_40px_rgba(29,255,0,0.2)] hover:scale-[1.02]'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-[#1dff00]/20 bg-gradient-to-r from-black/30 to-transparent backdrop-blur-sm">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 p-2.5 rounded-xl bg-gradient-to-br from-[#1dff00]/15 to-[#1dff00]/5 border border-[#1dff00]/40 shadow-[0_0_15px_rgba(29,255,0,0.2)] group-hover:scale-110 transition-transform duration-300">
              <FileText className="w-5 h-5 text-[#1dff00] drop-shadow-[0_0_8px_rgba(29,255,0,0.8)]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white truncate text-base group-hover:text-[#1dff00] transition-colors duration-300">
                {letter.name}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                <Calendar className="w-3.5 h-3.5 text-[#1dff00]/60" />
                <span>{formatDate(letter.updatedAt)}</span>
              </div>
            </div>
          </div>
          
          {/* Selection checkbox */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            className={`flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-200 ${
              isSelected
                ? 'bg-[#1dff00] border-[#1dff00] shadow-[0_0_15px_rgba(29,255,0,0.5)] scale-110'
                : 'border-white/30 hover:border-[#1dff00]/50 hover:bg-[#1dff00]/10 hover:scale-110'
            }`}
          >
            {isSelected && <Check className="w-4 h-4 text-black font-bold" />}
          </button>
        </div>

        {/* Content Preview */}
        <div className="flex-1 p-4 space-y-3 overflow-hidden">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-gradient-to-br from-[#1dff00]/10 to-[#1dff00]/5 border border-[#1dff00]/20">
            <Building2 className="w-4 h-4 text-[#1dff00] flex-shrink-0" />
            <span className="truncate text-sm text-white font-medium">{company}</span>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20">
            <Briefcase className="w-4 h-4 text-gray-300 flex-shrink-0" />
            <span className="truncate text-sm text-gray-200">{role}</span>
          </div>
          
          {hasContent && (
            <div className="mt-3 pt-3 border-t border-[#1dff00]/20">
              <p className="text-xs text-gray-400 line-clamp-5 leading-relaxed">
                {data.content || data.paragraphs?.[0] || 'No content yet...'}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-2 p-3 border-t border-[#1dff00]/20 bg-gradient-to-r from-black/40 to-black/20 backdrop-blur-sm">
          <button
            onClick={handleOpen}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-[#1dff00]/15 to-[#1dff00]/5 border border-[#1dff00]/40 text-[#1dff00] text-sm font-semibold hover:from-[#1dff00]/25 hover:to-[#1dff00]/10 hover:border-[#1dff00]/60 hover:shadow-[0_0_20px_rgba(29,255,0,0.2)] hover:scale-105 transition-all duration-200 group/btn"
          >
            <Pencil className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
            Edit
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowPreview(true);
            }}
            className="px-4 py-2.5 rounded-xl border border-white/30 hover:border-white/50 text-white text-sm hover:bg-white/10 hover:scale-105 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all duration-200 group/btn"
            title="Preview"
          >
            <Eye className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2.5 rounded-xl border border-red-500/50 hover:bg-red-500/15 text-red-400 hover:text-red-300 text-sm hover:border-red-500/70 hover:scale-105 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all duration-200 group/btn"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
          </button>
        </div>

        {/* Enhanced Hover glow */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#1dff00]/0 via-[#1dff00]/10 to-[#1dff00]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        
        {/* Ambient corner glows */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#1dff00]/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#1dff00]/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      </div>

      {/* Enhanced Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in-0 duration-300">
          <div 
            className="absolute inset-0 bg-black/90 backdrop-blur-xl" 
            onClick={() => setShowPreview(false)}
          />
          <div className="relative z-10 w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl border border-[#1dff00]/30 bg-gradient-to-br from-[#0a0a0a]/98 to-[#0f0f0f]/98 shadow-[0_0_80px_rgba(29,255,0,0.3)] backdrop-blur-xl animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[#1dff00]/30 bg-gradient-to-r from-[#0a0a0a]/98 to-[#0f0f0f]/98 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#1dff00]/15 to-[#1dff00]/5 border border-[#1dff00]/40">
                  <Eye className="w-5 h-5 text-[#1dff00]" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">{letter.name}</h3>
                  <p className="text-xs text-gray-400">Cover Letter Preview</p>
                </div>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="flex items-center justify-center w-10 h-10 rounded-xl border border-white/20 hover:border-[#1dff00]/50 hover:bg-[#1dff00]/10 text-white hover:text-[#1dff00] transition-all duration-200 hover:scale-110"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Modal Content - Letter Preview */}
            <div className="overflow-auto max-h-[calc(85vh-80px)] p-6">
              <div className="mx-auto max-w-3xl rounded-2xl border border-white/20 bg-white shadow-[0_0_60px_rgba(0,0,0,0.5)] p-12">
                <div className="text-gray-900 text-[15px] leading-relaxed space-y-5">
                  {/* Sender */}
                  {data.senderName && (
                    <div className="text-right mb-6">
                      <p className="font-bold text-base">{data.senderName}</p>
                      {data.senderPhone && <p className="mt-1">{data.senderPhone}</p>}
                      {data.senderEmail && <p className="mt-0.5">{data.senderEmail}</p>}
                      {data.senderAddress && <p className="mt-0.5 text-gray-600">{data.senderAddress}</p>}
                    </div>
                  )}
                  
                  {/* Date */}
                  {data.date && (
                    <p className="text-right mb-6 text-gray-700">
                      {new Date(data.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                  
                  {/* Recipient */}
                  {(data.recipient || data.company) && (
                    <div className="mb-6">
                      {data.recipient && <p className="font-semibold">{data.recipient}</p>}
                      {data.recipientTitle && <p className="text-gray-700 mt-0.5">{data.recipientTitle}</p>}
                      {data.company && <p className="font-medium mt-1">{data.company}</p>}
                      {data.recipientAddress && <p className="text-gray-600 mt-0.5">{data.recipientAddress}</p>}
                    </div>
                  )}
                  
                  {/* Subject */}
                  {data.subject && (
                    <p className="font-bold mb-6 text-gray-900">Subject: {data.subject}</p>
                  )}
                  
                  {/* Salutation */}
                  {data.salutation && <p className="mb-5 text-gray-900">{data.salutation}</p>}
                  
                  {/* Body */}
                  {Array.isArray(data.paragraphs) && data.paragraphs.length > 0 ? (
                    <div className="space-y-4">
                      {data.paragraphs.map((p: string, i: number) => (
                        <p key={i} className="whitespace-pre-wrap text-gray-800 leading-relaxed">{p}</p>
                      ))}
                    </div>
                  ) : data.content ? (
                    <div className="space-y-4">
                      {data.content.split('\n\n').map((p: string, i: number) => (
                        <p key={i} className="whitespace-pre-wrap text-gray-800 leading-relaxed">{p}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 italic text-center py-8">No content available</p>
                  )}
                  
                  {/* Closing */}
                  {(data.closing || data.signatureName) && (
                    <div className="mt-8 pt-4">
                      {data.closing && <p className="mb-12 text-gray-900">{data.closing}</p>}
                      {data.signatureName && <p className="font-bold text-gray-900">{data.signatureName}</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
