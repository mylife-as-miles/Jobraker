import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Wand2, Check } from 'lucide-react';
import { useState } from 'react';

interface Suggestion {
    id: string;
    type: 'enhancement' | 'correction' | 'professional';
    label: string;
    isRecommended?: boolean;
    content: string;
    original: string;
}

interface AIPolishDialogProps {
    open: boolean;
    onClose: () => void;
    originalText: string;
    onApply: (text: string) => void;
    loading?: boolean;
}

export const AIPolishDialog = ({ open, onClose, originalText, onApply, loading = false }: AIPolishDialogProps) => {
    const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);

    // Mock suggestions for now - in real app this would come from API
    const suggestions: Suggestion[] = [
        {
            id: '1',
            type: 'enhancement',
            label: 'Stronger Verbs + Metrics',
            isRecommended: true,
            original: originalText,
            content: originalText.replace(/Led/g, 'Spearheaded').replace(/improved/g, 'optimized').replace(/\./g, ', resulting in 40% efficiency increase.')
        },
        {
            id: '2',
            type: 'professional',
            label: 'More Professional',
            original: originalText,
            content: `Directed strategy and execution for ${originalText.toLowerCase()}, ensuring alignment with corporate objectives.`
        }
    ];

    if (!open) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/70 backdrop-blur-[1px]"
                    onClick={onClose}
                />

                {/* Pointer events none wrapper to position relative to trigger if needed, but centering for now as per request */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="relative w-[450px] z-50 pointer-events-auto flex flex-col"
                >
                    {/* Glow effect */}
                    <div className="absolute -inset-4 border-2 border-[#1dff00] rounded-xl shadow-[0_0_30px_rgba(29,255,0,0.2)] bg-transparent animate-pulse pointer-events-none" />

                    <div className="bg-[#1a1a1a] border border-[#1dff00]/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col relative z-10">

                        {/* Header */}
                        <div className="bg-gradient-to-r from-[#1dff00]/20 to-transparent p-4 border-b border-white/5 flex justify-between items-center">
                            <div className="flex items-center gap-2 text-[#1dff00] font-bold">
                                <Sparkles className="w-5 h-5" />
                                <span>AI Polish Suggestions</span>
                            </div>
                            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-5 space-y-6 max-h-[80vh] overflow-y-auto">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                    <Wand2 className="w-8 h-8 text-[#1dff00] animate-spin" />
                                    <p className="text-sm text-gray-400">Analyzing your content...</p>
                                </div>
                            ) : (
                                <>
                                    {/* Original */}
                                    <div>
                                        <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">Original</div>
                                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-slate-300 text-sm line-through decoration-slate-500/50">
                                            {originalText}
                                        </div>
                                    </div>

                                    {/* Suggestions */}
                                    <div className="space-y-4">
                                        {suggestions.map((suggestion, index) => (
                                            <div key={suggestion.id} className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`text-xs uppercase tracking-wider font-bold ${suggestion.isRecommended ? 'text-[#1dff00]' : 'text-slate-400'}`}>
                                                            Suggestion {index + 1}
                                                        </div>
                                                        {suggestion.isRecommended && (
                                                            <span className="px-1.5 py-0.5 rounded bg-[#1dff00]/20 text-[#1dff00] text-[10px] font-medium">Recommended</span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500">{suggestion.label}</div>
                                                </div>

                                                <div className={`p-4 rounded-lg border transition-colors group cursor-pointer ${selectedSuggestion === suggestion.id
                                                    ? 'bg-[#1dff00]/10 border-[#1dff00]/50'
                                                    : 'bg-white/5 border-white/10 hover:bg-[#1dff00]/5 hover:border-[#1dff00]/30'
                                                    }`}
                                                    onClick={() => setSelectedSuggestion(suggestion.id)}
                                                >
                                                    <p className="text-white text-sm leading-relaxed">
                                                        {suggestion.content}
                                                    </p>

                                                    <div className={`mt-4 flex gap-3 transition-opacity ${selectedSuggestion === suggestion.id ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`}>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onApply(suggestion.content);
                                                            }}
                                                            className="flex-1 bg-[#1dff00] hover:bg-[#15bd00] text-black text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 shadow-lg shadow-[#1dff00]/20 transition-all"
                                                        >
                                                            <Check className="w-4 h-4" /> Apply
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedSuggestion(null);
                                                            }}
                                                            className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-slate-400 text-xs font-medium transition-colors"
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
                        <div className="p-3 bg-black/20 text-center border-t border-white/5 text-[10px] text-slate-500">
                            AI can make mistakes. Please review suggestions.
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
