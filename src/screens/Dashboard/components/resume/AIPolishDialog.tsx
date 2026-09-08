import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Wand2, Check } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

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
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedSuggestion(null);
    closeButtonRef.current?.focus();
  }, [open]);

  if (!open) return null;

  // Calculate position
  let style: CSSProperties = {};
  const useAnchoredPosition = Boolean(targetRect && window.innerWidth >= 768);
  if (targetRect && useAnchoredPosition) {
    const dialogWidth = Math.min(450, window.innerWidth - 32);
    const preferredLeft = targetRect.right + 16;
    const left =
      preferredLeft + dialogWidth <= window.innerWidth - 16
        ? preferredLeft
        : Math.max(16, targetRect.left - dialogWidth - 16);

    style = {
      position: "fixed",
      top: Math.max(16, Math.min(targetRect.top, window.innerHeight - 96)),
      left,
      width: dialogWidth,
      margin: 0,
    };
  }

  return (
    <AnimatePresence>
      {/* Overlay - clear/none to allow clicking outside but maybe capturing clicks?
                Actually for this "popover" style, we usually want a transparent overlay to close on click outside.
            */}
      <div
        className='fixed inset-0 z-50 flex items-center justify-center p-4'
        onClick={onClose}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        {/* Pointer events none wrapper */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, x: -10 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.95, x: -10 }}
          className={`${useAnchoredPosition ? "fixed" : "relative"} z-50 pointer-events-auto flex w-full max-w-[450px] flex-col`}
          style={style}
          onClick={(e) => e.stopPropagation()}
          role='dialog'
          aria-modal='true'
          aria-label='AI summary suggestions'
        >
          {/* Connector Line/Dot */}
          {targetRect && (
            <div className='absolute top-6 -left-6 flex items-center'>
              <div className='w-1.5 h-1.5 rounded-full bg-brand shadow-[0_0_10px_#2fd968]' />
              <div className='w-6 h-[1px] bg-gradient-to-r from-brand to-brand/30' />
            </div>
          )}

          {/* Glow effect */}
          <div className='absolute -inset-4 border-2 border-brand rounded-xl shadow-[0_0_30px_rgba(47,217,104,0.2)] bg-transparent animate-pulse pointer-events-none' />

          <div className='bg-background border border-brand/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col relative z-10'>
            {/* Header */}
            <div className='bg-gradient-to-r from-brand/20 to-transparent p-4 border-b border-foreground/5 flex justify-between items-center'>
              <div className='flex items-center gap-2 text-brand font-bold'>
                <Sparkles className='w-5 h-5' />
                <span>AI Polish Suggestions</span>
              </div>
              <button
                ref={closeButtonRef}
                onClick={onClose}
                className='text-muted-foreground hover:text-foreground transition-colors'
                aria-label='Close AI suggestions'
              >
                <X className='w-5 h-5' />
              </button>
            </div>

            {/* Content */}
            <div className='p-5 space-y-6 max-h-[80vh] overflow-y-auto'>
              {loading ? (
                <div className='flex flex-col items-center justify-center py-12 space-y-4'>
                  <Wand2 className='w-8 h-8 text-brand animate-spin' />
                  <p className='text-sm text-muted-foreground'>
                    Analyzing your content...
                  </p>
                </div>
              ) : (
                <>
                  {/* Original */}
                  <div>
                    <div className='text-xs uppercase tracking-wider text-muted-foreground font-bold mb-2'>
                      Original
                    </div>
                    <div className='p-3 bg-brand/10 border border-brand/20 rounded-lg text-foreground/80 text-sm line-through decoration-slate-500/50'>
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
                              className={`text-xs uppercase tracking-wider font-bold ${suggestion.isRecommended ? "text-brand" : "text-muted-foreground"}`}
                            >
                              Suggestion {index + 1}
                            </div>
                            {suggestion.isRecommended && (
                              <span className='px-1.5 py-0.5 rounded bg-brand/20 text-brand text-[10px] font-medium'>
                                Recommended
                              </span>
                            )}
                          </div>
                          <div className='text-[10px] text-muted-foreground'>
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
                              className='px-3 py-2 rounded-lg border border-foreground/10 hover:bg-muted/50 text-muted-foreground text-xs font-medium transition-colors'
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
            <div className='p-3 bg-muted text-center border-t border-border text-[10px] text-muted-foreground'>
              AI can make mistakes. Please review suggestions.
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
