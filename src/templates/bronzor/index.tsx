import React from "react";
import { cn } from "../../lib/utils";
import { PageIcon } from "../shared/page-icon";
import { PageLink } from "../shared/page-link";
import { PagePicture } from "../shared/page-picture";
import { useArtboardStore } from "../../store/artboard";
import type { TemplateProps } from "../azurill/types";

/**
 * Template: Bronzor — Structured Grid
 * A professional grid-based template with section headings aligned to a left column.
 */
export function BronzorTemplate({ pageIndex = 0, pageLayout, metadataOverride }: TemplateProps) {
	const defaultLayout = {
		fullWidth: true,
		main: ["summary", "experience", "education", "projects"],
		sidebar: ["skills", "languages"],
	};

	const storeLayout = useArtboardStore((state) => state.resume.data.metadata.layout.pages[pageIndex]);
	const storeMetadata = useArtboardStore((state) => state.resume.data.metadata);

	const metadata = metadataOverride || storeMetadata;
	const themePrimary = metadata.theme?.primary || "#111827";
    const themeText = metadata.theme?.text || "#1e293b";
    const themeBackground = metadata.theme?.background || "#ffffff";
	const typography = metadata.typography.font;

	const layout = pageLayout || storeLayout || defaultLayout;
	const isFirstPage = pageIndex === 0;

    // Bronzor forces a single column visual layout (stack of rows), even if data is in "sidebar"
    const sections = [...layout.main, ...layout.sidebar];

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
            className="template-bronzor page-content h-full bg-white text-gray-800 flex flex-col"
        >
			{isFirstPage && <Header />}

			<div className="flex-1 flex flex-col px-12 pb-12">
                {sections.map((sectionId, index) => (
                    <Section
                        key={sectionId}
                        id={sectionId}
                        isFirst={index === 0}
                    />
                ))}

                {/* Footer Decoration */}
                <div className="h-6 bg-slate-900 w-full mt-auto"></div>
			</div>
		</div>
	);
}

function Header() {
	const basics = useArtboardStore((state) => state.resume.data.basics);

	return (
		<header className="flex flex-col items-center pt-12 pb-10 px-12 border-b-0">
            <div className="relative group cursor-pointer mb-6">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 shadow-md">
                    <PagePicture className="w-full h-full object-cover" />
                </div>
                {/* Edit Icon (Visual only) */}
                <div className="absolute bottom-1 right-1 w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center text-white shadow-md border border-white hidden print:hidden group-hover:flex">
                     <PageIcon name="Pencil" className="w-3 h-3" />
                </div>
            </div>

            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2 uppercase text-center">
                {basics.name}
            </h1>
            <h2 className="text-lg font-medium text-slate-500 mb-6 tracking-wide uppercase text-center">
                {basics.headline}
            </h2>

            <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-slate-700 font-medium">
                {basics.email && (
                    <div className="flex items-center gap-1.5">
                        <PageIcon name="Envelope" className="text-slate-900 text-lg" />
                        <PageLink type="email" value={basics.email} />
                    </div>
                )}
                {basics.phone && (
                    <div className="flex items-center gap-1.5">
                        <PageIcon name="Phone" className="text-slate-900 text-lg" />
                        <PageLink type="phone" value={basics.phone} />
                    </div>
                )}
                {basics.location && (
                    <div className="flex items-center gap-1.5">
                        <PageIcon name="MapPin" className="text-slate-900 text-lg" />
                        <span>{basics.location}</span>
                    </div>
                )}
                {basics.website && basics.website.url && (
                    <div className="flex items-center gap-1.5">
                        <PageIcon name="Globe" className="text-slate-900 text-lg" />
                        <PageLink type="url" value={basics.website.url} label={basics.website.label || basics.website.url} />
                    </div>
                )}
                 {basics.customFields.map((field) => (
                    <div key={field.id} className="flex items-center gap-1.5">
                        <PageIcon name={field.icon} className="text-slate-900 text-lg" />
                        {field.link ? (
                            <PageLink type="url" value={field.link} label={field.text} />
                        ) : (
                            <span>{field.text}</span>
                        )}
                    </div>
                ))}
            </div>
		</header>
	);
}

function Section({ id, isFirst }: { id: string; isFirst: boolean }) {
    const section = useArtboardStore((state) => state.resume.data.sections[id]);
    const summary = useArtboardStore((state) => state.resume.data.summary);

    if (id === "summary") {
        if (!summary || !summary.content || summary.hidden) return null;
        return (
             <div className={cn("flex py-8", isFirst ? "border-t-2 border-slate-900" : "border-t border-slate-200")}>
                <div className="w-[180px] shrink-0 pr-8 text-right">
                    <h3 className="text-slate-900 font-bold uppercase text-sm tracking-wider">
                        {summary.title}
                    </h3>
                </div>
                <div className="flex-1 pl-8 border-l-2 border-slate-900">
                    <div
                        className="text-slate-700 text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: summary.content }}
                    />
                </div>
            </div>
        );
    }

    if (!section || section.hidden) return null;

    return (
        <div className={cn("flex py-8", isFirst ? "border-t-2 border-slate-900" : "border-t border-slate-200")}>
            <div className="w-[180px] shrink-0 pr-8 text-right">
                <h3 className="text-slate-900 font-bold uppercase text-sm tracking-wider">
                    {section.title}
                </h3>
            </div>

            <div className="flex-1 pl-8 border-l-2 border-slate-900">
                {id === "skills" ? (
                    <SkillsSection items={section.items} />
                ) : (
                    <ItemsSection items={section.items} />
                )}
            </div>
        </div>
    );
}

function SkillsSection({ items }: { items: any[] }) {
    return (
        <div className="flex flex-wrap gap-2">
            {items.map((item: any) => (
                <span
                    key={item.id}
                    className="px-3 py-1 bg-slate-100 text-slate-800 text-sm font-semibold border border-slate-200"
                >
                    {item.name}
                </span>
            ))}
        </div>
    );
}

function ItemsSection({ items }: { items: any[] }) {
    return (
        <div className="space-y-8">
            {items.map((item: any) => (
                <div key={item.id}>
                    <div className="flex justify-between items-baseline mb-1">
                        <h4 className="text-slate-900 font-bold text-base uppercase">
                            {item.title || item.degree || item.position}
                        </h4>
                        {(item.date || item.period) && (
                             <span className="text-slate-500 text-sm font-medium">
                                {item.date || item.period}
                            </span>
                        )}
                    </div>

                    {(item.company || item.school) && (
                        <p className="text-slate-600 font-medium text-sm mb-3 italic">
                            {item.company || item.school} {item.location ? `• ${item.location}` : ""}
                        </p>
                    )}

                    {item.description && (
                        <div
                            className="text-sm text-slate-700 list-disc list-outside ml-4 space-y-1.5 [&_li]:pl-1"
                            dangerouslySetInnerHTML={{ __html: item.description }}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}
