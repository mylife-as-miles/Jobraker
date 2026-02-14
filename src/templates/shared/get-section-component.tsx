import React from 'react';
import { useArtboardStore } from '../../store/artboard';
import { cn } from '../../lib/utils';

// Placeholder section components - mapping logic will be expanded
const SectionPlaceholder = ({ id, className }: { id: string, className?: string }) => {
    const section = useArtboardStore((state) => state.resume.data.sections[id]);
    if (!section || section.hidden) return null;

    return (
        <div className={cn("section-content", className)}>
            <h6 className="font-bold uppercase tracking-wider mb-2 text-sm">{section.title}</h6>
            <div className="text-sm">
                {section.items.map((item: any) => (
                    <div key={item.id} className="mb-2">
                        {/* Basic rendering fallback */}
                        <div className="font-semibold">{item.title || item.degree || item.name}</div>
                        <div className="text-xs text-gray-500">{item.company || item.school}</div>
                        <div className="text-xs text-gray-400">{item.date || item.period}</div>
                        {item.description && <div dangerouslySetInnerHTML={{ __html: item.description }} />}
                    </div>
                ))}
            </div>
        </div>
    );
}

export const getSectionComponent = (sectionId: string, options?: any) => {
    // In a real implementation this would map sectionId to specific components
    // relying on the store data.
    // For now we return a generic wrapper that renders based on the ID.
    return (props: any) => <SectionPlaceholder id={sectionId} className={options?.sectionClassName} {...props} />;
};
