import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Wand2, Check } from "lucide-react";
import { useState } from "react";

import { Suggestion } from "../../../../services/ai/polishContent";

interface AIPolishDialogProps {
  open: boolean;
  onClose: () => void;
  originalText: string;
  suggestions: Suggestion[];
  onApply: (text: string) => void;
  loading?: boolean;
  targetRect?: DOMRect | null;
}

export const AIPolishDialog = ({
  open,
  onClose,
  originalText,
  suggestions,
  onApply,
  loading = false,
  targetRect,
}: AIPolishDialogProps) => {
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(
    null,
  );

  if (!open) return null;

  // Calculate position
  let style = {};
  let connectorStyle = {};

  if (targetRect) {
    // Position to the right of the target if space permits, otherwise below
    // For this demo, let's assume valid desktop space as per the image
    const top = targetRect.top + window.scrollY;
    const left = targetRect.right + 20 + window.scrollX; // 20px gap

    style = {
      position: "absolute",
      top: top,
      left: left,
      margin: 0,
    };
  }

  return (
    <AnimatePresence>
      {/* Overlay - clear/none to allow clicking outside but maybe capturing clicks?
                Actually for this "popover" style, we usually want a transparent overlay to close on click outside.
            */}
      <div className='fixed inset-0 z-50' onClick={onClose}>
        {/* Pointer events none wrapper */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, x: -10 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.95, x: -10 }}
          className='absolute z-50 pointer-events-auto flex flex-col w-[450px]'
          style={style}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Connector Line/Dot */}
          {targetRect && (
            <div className='absolute top-6 -left-6 flex items-center'>
              <div className='w-1.5 h-1.5 rounded-full bg-brand shadow-[0_0_10px_#1dff00]' />
              <div className='w-6 h-[1px] bg-gradient-to-r from-brand to-brand/30' />
            </div>
          )}

          {/* Glow effect */}
          <div className='absolute -inset-4 border-2 border-brand rounded-xl shadow-[0_0_30px_rgba(29,255,0,0.2)] bg-transparent animate-pulse pointer-events-none' />

          <div className='bg-background border border-brand/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col relative z-10'>
            {/* Header */}
            <div className='bg-gradient-to-r from-brand/20 to-transparent p-4 border-b border-foreground/5 flex justify-between items-center'>
              <div className='flex items-center gap-2 text-brand font-bold'>
                <Sparkles className='w-5 h-5' />
                <span>AI Polish Suggestions</span>
              </div>
              <button
                onClick={onClose}
                className='text-slate-400 hover:text-foreground transition-colors'
              >
                <X className='w-5 h-5' />
              </button>
            </div>

            {/* Content */}
            <div className='p-5 space-y-6 max-h-[80vh] overflow-y-auto'>
              {loading ? (
                <div className='flex flex-col items-center justify-center py-12 space-y-4'>
                  <Wand2 className='w-8 h-8 text-brand animate-spin' />
                  <p className='text-sm text-gray-400'>
                    Analyzing your content...
                  </p>
                </div>
              ) : (
                <>
                  {/* Original */}
                  <div>
                    <div className='text-xs uppercase tracking-wider text-slate-500 font-bold mb-2'>
                      Original
                    </div>
                    <div className='p-3 bg-brand/10 border border-brand/20 rounded-lg text-slate-300 text-sm line-through decoration-slate-500/50'>
                      {originalText}
                    </div>
                  </div>

                  {/* Suggestions */}
                  <div className='space-y-4'>
                    {suggestions.map((suggestion, index) => (
                      <div key={suggestion.id} className='space-y-3'>
                        <div className='flex items-center justify-between'>
                          <div className='flex items-center gap-2'>
                            <div
                              className={`text-xs uppercase tracking-wider font-bold ${suggestion.isRecommended ? "text-brand" : "text-slate-400"}`}
                            >
                              Suggestion {index + 1}
                            </div>
                            {suggestion.isRecommended && (
                              <span className='px-1.5 py-0.5 rounded bg-brand/20 text-brand text-[10px] font-medium'>
                                Recommended
                              </span>
                            )}
                          </div>
                          <div className='text-[10px] text-slate-500'>
                            {suggestion.label}
                          </div>
                        </div>

                        <div
                          className={`p-4 rounded-lg border transition-colors group cursor-pointer ${
                            selectedSuggestion === suggestion.id
                              ? "bg-brand/10 border-brand/50"
                              : "bg-muted/50 border-foreground/10 hover:bg-brand/5 hover:border-brand/30"
                          }`}
                          onClick={() => setSelectedSuggestion(suggestion.id)}
                        >
                          <p className='text-foreground text-sm leading-relaxed'>
                            {suggestion.content}
                          </p>

                          <div
                            className={`mt-4 flex gap-3 transition-opacity ${selectedSuggestion === suggestion.id ? "opacity-100" : "opacity-40 group-hover:opacity-100"}`}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onApply(suggestion.content);
                              }}
                              className='flex-1 bg-brand hover:bg-brand text-black text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 shadow-lg shadow-brand/20 transition-all'
                            >
                              <Check className='w-4 h-4' /> Apply
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSuggestion(null);
                              }}
                              className='px-3 py-2 rounded-lg border border-foreground/10 hover:bg-muted/50 text-slate-400 text-xs font-medium transition-colors'
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className='p-3 bg-muted text-center border-t border-border text-[10px] text-slate-500'>
              AI can make mistakes. Please review suggestions.
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
