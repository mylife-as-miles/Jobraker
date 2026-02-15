import { useArtboardStore, ArtboardStore } from '../../../store/artboard';
import { X, Check } from 'lucide-react';
import { TemplatePreview } from './TemplatePreview';

const availableTemplates = [
    { id: 'azurill', name: 'Azurill', description: 'A clean, sidebar-based layout with blue accents.' },
    { id: 'onyx', name: 'Onyx', description: 'A classic, single-column professional layout.' },
    { id: 'bronzor', name: 'Bronzor', description: 'A professional layout with left-aligned section headers.' },
    { id: 'chikorita', name: 'Chikorita', description: 'A fresh, nature-inspired layout with a sidebar background.' }
];

interface TemplateSelectorProps {
    isOpen: boolean;
    onClose: () => void;
}

export const TemplateSelector = ({ isOpen, onClose }: TemplateSelectorProps) => {
    // Explicitly type schema to avoid implicit any
    const currentTemplate = useArtboardStore((state: ArtboardStore) => state.resume.data.metadata.template);
    const setResumeData = useArtboardStore((state: ArtboardStore) => state.setResumeData);

    const handleSelect = (templateId: string) => {
        setResumeData({ metadata: { ...useArtboardStore.getState().resume.data.metadata, template: templateId } });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#121212] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-white/10 animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Choose a Template</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Select a design that best fits your professional story.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full text-gray-500 dark:text-gray-400 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Grid */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {availableTemplates.map((template) => (
                            <div
                                key={template.id}
                                onClick={() => handleSelect(template.id)}
                                className={`
                                    group relative rounded-xl border-2 cursor-pointer transition-all duration-200 overflow-hidden
                                    ${currentTemplate === template.id
                                        ? 'border-[#1dff00] bg-[#1dff00]/5 ring-2 ring-[#1dff00]/20'
                                        : 'border-gray-200 dark:border-white/10 hover:border-[#1dff00]/50 hover:shadow-lg bg-white dark:bg-[#1A1A1A]'
                                    }
                                `}
                            >
                                {/* Preview Image Container */}
                                <div className="aspect-[210/297] bg-gray-100 dark:bg-[#2A2A2A] relative overflow-hidden">
                                    {/* Live Preview */}
                                    {/* We need a wrapper to center/contain the scaled preview if necessary, 
                                         but the component handles scaling. 
                                         However, since our scale is hardcoded to 0.3 (approx 240px), 
                                         and the grid cards might vary, we might want a container that centers it. 
                                     */}
                                    <div className="w-full h-full flex items-start justify-center bg-gray-50 dark:bg-[#1A1A1A]">
                                        <TemplatePreview templateId={template.id} />
                                    </div>

                                    {/* Overlay on Hover */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 dark:group-hover:bg-white/5 transition-colors z-10" />

                                    {/* Selected Badge */}
                                    {currentTemplate === template.id && (
                                        <div className="absolute top-3 right-3 z-20 bg-[#1dff00] text-black text-xs font-bold px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
                                            <Check className="w-3 h-3" /> Selected
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="p-4 border-t border-gray-100 dark:border-white/5">
                                    <h3 className="font-bold text-gray-900 dark:text-white">{template.name}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{template.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};
