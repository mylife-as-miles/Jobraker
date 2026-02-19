import React from "react";
import { cn } from "../../lib/utils";
import { PageIcon } from "../shared/page-icon";
import { PageLink } from "../shared/page-link";
import { PagePicture } from "../shared/page-picture";
import { useArtboardStore } from "../../store/artboard";
import type { TemplateProps } from "./types";

/**
 * Template: Azurill — High-Fidelity Timeline
 * A premium template with a stark timeline layout, circular portrait and clean sidebar.
 */
export function AzurillTemplate({ pageIndex = 0, pageLayout, metadataOverride }: TemplateProps) {
    const defaultLayout = {
        fullWidth: false,
        main: ["summary", "experience", "education", "projects"],
        sidebar: ["skills", "languages"],
    };

    const storeLayout = useArtboardStore(
        (state) => state.resume.data.metadata.layout.pages[pageIndex],
    );
    const storeMetadata = useArtboardStore((state) => state.resume.data.metadata);

    const metadata = metadataOverride || storeMetadata;
    const theme = metadata.theme;
    const typography = metadata.typography.font;

    const themePrimary = theme?.primary || "#0df233";
    const themeText = theme?.text || "#1e293b";
    const themeBackground = theme?.background || "#ffffff";

    const layout = pageLayout || storeLayout || defaultLayout;

    const isFirstPage = pageIndex === 0;
    const { main, sidebar, fullWidth } = layout;

    return (
        <div
            style={
                {
                    "--page-primary-color": themePrimary,
                    fontFamily: typography.family,
                    fontSize: `${typography.size}px`,
                    lineHeight: typography.lineHeight,
                    color: themeText,
                    backgroundColor: themeBackground,
                } as React.CSSProperties
            }
            className='template-azurill page-content h-full flex flex-col bg-white'
        >
            {isFirstPage && <Header />}

            <div className='flex flex-1'>
                {!fullWidth && (
                    <aside
                        data-layout='sidebar'
                        className='group page-sidebar w-1/3 bg-slate-50 px-8 py-10 border-r border-slate-100 shrink-0'
                    >
                        {sidebar.map((sectionId) => (
                            <Section key={sectionId} id={sectionId} layout="sidebar" />
                        ))}
                    </aside>
                )}

                <main data-layout='main' className='group page-main w-2/3 pl-12 pr-10 py-10 relative'>
                    {/* Timeline Line */}
                    {/* Positioned relative to the main container. Left padding is 48px (pl-12).
                        Line at left-[23px] (2px width) centers it at 24px. */}
                    <div className="absolute left-[23px] top-12 bottom-12 w-[2px] bg-[var(--page-primary-color)]/30"></div>

                    {main.map((sectionId) => (
                        <Section key={sectionId} id={sectionId} layout="main" />
                    ))}
                </main>
            </div>

            {/* Footer Decoration */}
            <div className="h-4 bg-[var(--page-primary-color)] w-full mt-auto"></div>
        </div>
    );
}

function Header() {
    const basics = useArtboardStore((state) => state.resume.data.basics);

    return (
        <div className='page-header px-12 pt-12 pb-8 flex items-center gap-8 border-b border-gray-100 bg-white'>
            <div className='relative group shrink-0'>
                <div className="w-32 h-32 rounded-full border-[3px] border-[var(--page-primary-color)] p-1 overflow-hidden bg-white shadow-sm">
                    <PagePicture className='w-full h-full rounded-full object-cover' />
                </div>
                {/* Edit Icon (Visual only, usually not interactive in print/preview but keeps the look) */}
                <div className="absolute bottom-0 right-2 w-8 h-8 bg-[var(--page-primary-color)] rounded-full flex items-center justify-center text-[#111812] shadow-md hidden print:hidden group-hover:flex">
                     <PageIcon name="Pencil" className="w-4 h-4" />
                </div>
            </div>

            <div className='flex-1 min-w-0'>
                <h1 className='basics-name text-4xl font-extrabold text-slate-900 tracking-tight mb-1 uppercase truncate'>
                    {basics.name}
                </h1>
                <h2 className='basics-headline text-xl font-bold text-[var(--page-primary-color)] mb-4 tracking-wide truncate'>
                    {basics.headline}
                </h2>

                <div className='basics-items flex flex-wrap gap-y-2 gap-x-6 text-sm text-slate-600 font-medium'>
                    {basics.email && (
                        <div className='basics-item-email flex items-center gap-1.5'>
                            <PageIcon name='Envelope' className='text-[var(--page-primary-color)] text-lg' />
                            <PageLink type='email' value={basics.email} />
                        </div>
                    )}
                    {basics.phone && (
                        <div className='basics-item-phone flex items-center gap-1.5'>
                            <PageIcon name='Phone' className='text-[var(--page-primary-color)] text-lg' />
                            <PageLink type='phone' value={basics.phone} />
                        </div>
                    )}
                    {basics.location && (
                        <div className='basics-item-location flex items-center gap-1.5'>
                            <PageIcon name='MapPin' className='text-[var(--page-primary-color)] text-lg' />
                            <span>{basics.location}</span>
                        </div>
                    )}
                    {basics.website && basics.website.url && (
                        <div className='basics-item-website flex items-center gap-1.5'>
                            <PageIcon name='Globe' className='text-[var(--page-primary-color)] text-lg' />
                            <PageLink type='url' value={basics.website.url} label={basics.website.label || basics.website.url} />
                        </div>
                    )}
                    {basics.customFields.map((field) => (
                        <div key={field.id} className='basics-item-custom flex items-center gap-1.5'>
                            <PageIcon name={field.icon} className='text-[var(--page-primary-color)] text-lg' />
                            {field.link ? (
                                <PageLink type='url' value={field.link} label={field.text} />
                            ) : (
                                <span>{field.text}</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function Section({ id, layout }: { id: string; layout: "sidebar" | "main" }) {
    const section = useArtboardStore((state) => state.resume.data.sections[id]);
    const summary = useArtboardStore((state) => state.resume.data.summary);

    if (id === "summary") {
        if (!summary || !summary.content || summary.hidden) return null;
        return (
             <div className={cn("mb-10 relative", layout === "main" ? "main-section" : "sidebar-section")}>
                <SectionHeader title={summary.title} layout={layout} />
                <div
                    className="text-slate-600 text-sm leading-relaxed text-justify [&_p]:mb-2 last:[&_p]:mb-0"
                    dangerouslySetInnerHTML={{ __html: summary.content }}
                />
            </div>
        );
    }

    if (!section || section.hidden) return null;

    return (
        <div className={cn("relative", layout === "main" ? "mb-10 main-section" : "mb-10 sidebar-section")}>
            <SectionHeader title={section.title} layout={layout} />

            <div className={layout === "sidebar" ? "space-y-4" : "space-y-8"}>
                {id === "skills" ? (
                    <SkillsSection items={section.items} />
                ) : id === "languages" ? (
                    <LanguagesSection items={section.items} />
                ) : (
                    <ItemsSection items={section.items} layout={layout} />
                )}
            </div>
        </div>
    );
}

function SectionHeader({ title, layout }: { title: string; layout: "sidebar" | "main" }) {
    if (layout === "sidebar") {
        return (
            <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--page-primary-color)]"></div>
                <h3 className="text-slate-900 font-bold uppercase tracking-wider text-sm">{title}</h3>
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--page-primary-color)]"></div>
            </div>
        );
    }

    // Main layout header with timeline dot
    return (
        <div className="relative">
            {/* Dot positioned on the timeline.
                Main Container: `pl-12` (48px)
                Timeline Line: `left-[23px]` (2px width, centered at 24px)
                Dot: `left-[-30px]` (relative to content at 48px -> 18px. Width 12px -> Center 24px).
            */}
            <div className="absolute left-[-30px] top-1 w-3 h-3 rounded-full border-2 border-[var(--page-primary-color)] bg-white z-10"></div>
            <h3 className="text-slate-900 font-bold uppercase tracking-wider text-sm mb-6">{title}</h3>
        </div>
    );
}

function SkillsSection({ items }: { items: any[] }) {
    return (
        <div className="flex flex-wrap gap-2">
            {items.map((item: any) => (
                <span
                    key={item.id}
                    className="px-3 py-1 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-700"
                >
                    {item.name}
                </span>
            ))}
        </div>
    );
}

function LanguagesSection({ items }: { items: any[] }) {
    return (
        <div className="space-y-3">
            {items.map((item: any) => {
                // Convert level (1-5 or 0-100) to percentage
                // Assuming item.level is 1-5 from store default
                const percentage = item.level ? (item.level / 5) * 100 : 0;
                // Map numeric level to text label if possible, or use item.level
                const levelLabel = item.level === 5 ? "Native" : item.level >= 4 ? "Professional" : item.level >= 3 ? "Advanced" : "Intermediate";

                return (
                    <div key={item.id}>
                         <div className="flex justify-between items-center text-sm mb-1">
                            <span className="text-slate-700 font-medium">{item.name}</span>
                            <span className="text-slate-400 text-xs">{levelLabel}</span>
                        </div>
                        <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-[var(--page-primary-color)]"
                                style={{ width: `${percentage}%` }}
                            ></div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function ItemsSection({ items, layout }: { items: any[]; layout: "sidebar" | "main" }) {
    return (
        <div className={layout === "sidebar" ? "space-y-4" : "space-y-8"}>
            {items.map((item: any) => (
                <div key={item.id} className="relative">
                    {layout === "main" ? (
                        <>
                             <div className="flex justify-between items-baseline mb-1">
                                <h4 className="text-slate-900 font-bold text-base">
                                    {item.title || item.degree || item.position}
                                </h4>
                                {(item.date || item.period) && (
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded font-medium">
                                        {item.date || item.period}
                                    </span>
                                )}
                            </div>
                            {(item.company || item.school) && (
                                <p className="text-[var(--page-primary-color)] font-semibold text-sm mb-3">
                                    {item.company || item.school} {item.location ? `• ${item.location}` : ""}
                                </p>
                            )}
                        </>
                    ) : (
                        // Sidebar Item Layout (Compact)
                        <>
                            <div>
                                <h4 className="text-slate-900 font-bold text-sm">
                                    {item.title || item.degree || item.position}
                                </h4>
                                {(item.company || item.school) && (
                                    <p className="text-[var(--page-primary-color)] text-xs font-semibold mb-1">
                                        {item.company || item.school}
                                    </p>
                                )}
                                {(item.date || item.period) && (
                                    <p className="text-slate-500 text-xs">{item.date || item.period}</p>
                                )}
                            </div>
                        </>
                    )}

                    {item.description && (
                        <div
                            className={cn(
                                "text-sm text-slate-600 leading-relaxed",
                                layout === "main"
                                    ? "list-disc list-outside ml-4 space-y-2 [&_li]:pl-1"
                                    : "mt-2 text-xs"
                            )}
                            dangerouslySetInnerHTML={{ __html: item.description }}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}
