import { useArtboardStore } from '../../store/artboard';
import { cn } from '../../lib/utils';

const SectionPlaceholder = ({ id, className }: { id: string; className?: string }) => {
    const summary = useArtboardStore((state) => state.resume.data.summary);
    const section = useArtboardStore((state) => state.resume.data.sections[id]);

    // Summary Section
    if (id === 'summary') {
        if (!summary || !summary.content || summary.hidden) return null;
        return (
            <div className={cn('section-content section-summary', className)}>
                <h6 className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-gray-900 mb-3 pb-1.5">
                    {summary.title}
                </h6>
                <div
                    className="text-[0.8rem] leading-[1.7] text-gray-600 [&_a]:text-[color:var(--page-primary-color,#3b82f6)] [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: summary.content }}
                />
            </div>
        );
    }

    if (!section || section.hidden) return null;

    return (
        <div className={cn('section-content', className, `section-${id}`)}>
            <h6 className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-gray-900 mb-3 pb-1.5">
                {section.title}
            </h6>

            <div className="text-sm">
                {section.type === 'list' || id === 'skills' || id === 'languages' || id === 'interests' ? (
                    <SkillsSection items={section.items} />
                ) : (
                    <ItemsSection items={section.items} />
                )}
            </div>
        </div>
    );
};

// Modern Skills Display
function SkillsSection({ items }: { items: any[] }) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {items.map((item: any) => (
                <span
                    key={item.id}
                    className={cn(
                        'inline-flex items-center gap-1.5',
                        'px-2.5 py-1 rounded-md',
                        'text-[0.7rem] font-medium',
                        'bg-gray-50 text-gray-700',
                        'border border-gray-100',
                        'print:bg-gray-50 print:text-black print:border-gray-200'
                    )}
                >
                    {item.level && item.level > 0 && (
                        <span className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((dot) => (
                                <span
                                    key={dot}
                                    className={cn(
                                        'w-1 h-1 rounded-full',
                                        dot <= item.level
                                            ? 'bg-[color:var(--page-primary-color,#3b82f6)]'
                                            : 'bg-gray-200'
                                    )}
                                />
                            ))}
                        </span>
                    )}
                    {item.name}
                </span>
            ))}
        </div>
    );
}

// Modern Items (Experience, Education, Projects) Display
function ItemsSection({ items }: { items: any[] }) {
    return (
        <div className="space-y-3.5">
            {items.map((item: any) => (
                <div key={item.id} className="group/item">
                    {/* Header Row */}
                    <div className="section-item-header flex justify-between items-baseline gap-x-4 mb-0.5">
                        <div className="min-w-0">
                            <div className="section-item-title font-semibold text-[0.8rem] text-gray-900 leading-tight">
                                {item.title || item.degree || item.name}
                            </div>
                            {(item.company || item.school) && (
                                <div className="section-item-subtitle text-[0.75rem] font-medium text-[color:var(--page-primary-color,#3b82f6)] mt-0.5">
                                    {item.company || item.school}
                                </div>
                            )}
                        </div>
                        {(item.date || item.period) && (
                            <div className="section-item-date text-[0.65rem] text-gray-400 font-medium whitespace-nowrap tabular-nums">
                                {item.date || item.period}
                            </div>
                        )}
                    </div>

                    {/* Location */}
                    {item.location && (
                        <div className="text-[0.65rem] text-gray-400 mt-0.5">{item.location}</div>
                    )}

                    {/* Description */}
                    {item.description && (
                        <div
                            className={cn(
                                'section-item-description mt-1.5',
                                'text-[0.75rem] text-gray-600 leading-[1.65]',
                                '[&_ul]:mt-1 [&_ul]:space-y-0.5',
                                '[&_ul]:list-none [&_ul]:pl-0',
                                '[&_li]:relative [&_li]:pl-3.5',
                                '[&_li]:before:content-[""] [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:top-[0.55em]',
                                '[&_li]:before:w-1 [&_li]:before:h-1 [&_li]:before:rounded-full',
                                '[&_li]:before:bg-[color:var(--page-primary-color,#3b82f6)] [&_li]:before:opacity-60',
                                '[&_a]:text-[color:var(--page-primary-color,#3b82f6)] [&_a]:underline',
                                '[&_strong]:font-semibold [&_strong]:text-gray-700'
                            )}
                            dangerouslySetInnerHTML={{ __html: item.description }}
                        />
                    )}

                    {/* URL */}
                    {item.url && (
                        <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[0.65rem] text-[color:var(--page-primary-color,#3b82f6)] mt-1 hover:underline"
                        >
                            {item.url}
                        </a>
                    )}
                </div>
            ))}
        </div>
    );
}

export const getSectionComponent = (sectionId: string, options?: any) => {
    return (props: any) => (
        <SectionPlaceholder id={sectionId} className={options?.sectionClassName} {...props} />
    );
};
