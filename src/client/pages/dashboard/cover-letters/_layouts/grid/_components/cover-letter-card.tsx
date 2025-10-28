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
        className={`group relative flex h-[300px] flex-col rounded-lg border transition-all ${
          isSelected
            ? 'border-[#1dff00] bg-[#1dff00]/10 shadow-[0_0_20px_-5px_rgba(29,255,0,0.4)]'
            : 'border-white/10 bg-gradient-to-br from-white/5 to-transparent hover:border-[#1dff00]/50 hover:shadow-[0_0_30px_-5px_rgba(29,255,0,0.2)]'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 p-2 rounded-lg bg-[#1dff00]/10 border border-[#1dff00]/30">
              <FileText className="w-5 h-5 text-[#1dff00]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate text-sm">
                {letter.name}
              </h3>
              <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                <Calendar className="w-3 h-3" />
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
            className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
              isSelected
                ? 'bg-[#1dff00] border-[#1dff00]'
                : 'border-white/30 hover:border-[#1dff00]/50'
            }`}
          >
            {isSelected && <Check className="w-3 h-3 text-black" />}
          </button>
        </div>

        {/* Content Preview */}
        <div className="flex-1 p-4 space-y-2 overflow-hidden">
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <Building2 className="w-3 h-3" />
            <span className="truncate">{company}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <Briefcase className="w-3 h-3" />
            <span className="truncate">{role}</span>
          </div>
          
          {hasContent && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-xs text-gray-400 line-clamp-4">
                {data.content || data.paragraphs?.[0] || 'No content yet...'}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-2 p-3 border-t border-white/10 bg-black/20">
          <button
            onClick={handleOpen}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#1dff00]/10 border border-[#1dff00]/30 text-[#1dff00] text-xs font-medium hover:bg-[#1dff00]/20 transition-all"
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowPreview(true);
            }}
            className="px-3 py-2 rounded-lg border border-white/20 hover:border-white/40 text-white text-xs transition-all"
            title="Preview"
          >
            <Eye className="w-3 h-3" />
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-2 rounded-lg border border-red-500/40 hover:bg-red-500/10 text-red-400 text-xs transition-all"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {/* Hover glow */}
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[#1dff00]/0 via-[#1dff00]/5 to-[#1dff00]/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
            onClick={() => setShowPreview(false)}
          />
          <div className="relative z-10 w-full max-w-3xl max-h-[80vh] overflow-auto rounded-xl border border-white/20 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-gray-200 bg-white">
              <h3 className="font-semibold text-gray-900">{letter.name}</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-8 text-gray-900 text-sm leading-relaxed space-y-4">
              {/* Sender */}
              {data.senderName && (
                <div className="text-right mb-4">
                  <p className="font-semibold">{data.senderName}</p>
                  {data.senderPhone && <p>{data.senderPhone}</p>}
                  {data.senderEmail && <p>{data.senderEmail}</p>}
                  {data.senderAddress && <p>{data.senderAddress}</p>}
                </div>
              )}
              
              {/* Date */}
              {data.date && (
                <p className="text-right mb-4">
                  {new Date(data.date).toLocaleDateString()}
                </p>
              )}
              
              {/* Recipient */}
              {(data.recipient || data.company) && (
                <div className="mb-4">
                  {data.recipient && <p>{data.recipient}</p>}
                  {data.recipientTitle && <p>{data.recipientTitle}</p>}
                  {data.company && <p>{data.company}</p>}
                  {data.recipientAddress && <p>{data.recipientAddress}</p>}
                </div>
              )}
              
              {/* Subject */}
              {data.subject && (
                <p className="font-semibold mb-4">Subject: {data.subject}</p>
              )}
              
              {/* Salutation */}
              {data.salutation && <p className="mb-4">{data.salutation}</p>}
              
              {/* Body */}
              {Array.isArray(data.paragraphs) && data.paragraphs.length > 0 ? (
                data.paragraphs.map((p: string, i: number) => (
                  <p key={i} className="whitespace-pre-wrap">{p}</p>
                ))
              ) : data.content ? (
                <p className="whitespace-pre-wrap">{data.content}</p>
              ) : (
                <p className="text-gray-400 italic">No content</p>
              )}
              
              {/* Closing */}
              {(data.closing || data.signatureName) && (
                <div className="mt-6">
                  {data.closing && <p className="mb-8">{data.closing}</p>}
                  {data.signatureName && <p className="font-semibold">{data.signatureName}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
