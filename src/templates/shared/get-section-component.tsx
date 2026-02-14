import { useArtboardStore } from '../../store/artboard';
import { cn } from '../../lib/utils';

// Placeholder section components - mapping logic will be expanded
const SectionPlaceholder = ({ id, className }: { id: string, className?: string }) => {
    // Handle Summary specially as it lives on the root of resume data, but we treat it as a section for mapping
    const summary = useArtboardStore((state) => state.resume.data.summary);
    const section = useArtboardStore((state) => state.resume.data.sections[id]);

    // Check if it's the summary section
    if (id === 'summary') {
        if (!summary || !summary.content || summary.hidden) return null;
        return (
            <div className={cn("section-content section-summary", className)}>
                <h6 className="font-bold uppercase tracking-wider mb-2 text-sm">{summary.title}</h6>
                <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: summary.content }} />
            </div>
        );
    }

    if (!section || section.hidden) return null;

    return (
        <div className={cn("section-content", className, `section-${id}`)}>
            <h6 className="font-bold uppercase tracking-wider mb-2 text-sm group-data-[layout=sidebar]:text-gray-900 group-data-[layout=main]:text-gray-900">{section.title}</h6>
            <div className="text-sm">
                {id === 'skills' ? (
                    <div className="flex flex-wrap gap-2">
                        {section.items.map((item: any) => (
                            <span key={item.id} className="px-2 py-1 bg-gray-100 rounded text-xs font-semibold text-gray-700 print:bg-gray-100 print:text-black">
                                {item.name}
                            </span>
                        ))}
                    </div>
                ) : (
                    section.items.map((item: any) => (
                        <div key={item.id} className="mb-4 last:mb-0">
                            {/* Work / Education / Projects */}
                            <div className="flex justify-between items-baseline mb-1">
                                <div className="font-bold text-gray-900">{item.title || item.degree || item.name}</div>
                                <div className="text-xs text-gray-500 font-medium">{item.date || item.period}</div>
                            </div>
                            <div className="text-xs text-gray-600 italic mb-1.5">{item.company || item.school}</div>
                            {item.description && (
                                <div className="text-xs text-gray-600 leading-relaxed [&_ul]:list-disc [&_ul]:pl-4 [&_li]:mb-1" dangerouslySetInnerHTML={{ __html: item.description }} />
                            )}
                        </div>
                    ))
                )}
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
