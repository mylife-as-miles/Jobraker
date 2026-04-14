import { cn } from "../../lib/utils";
import { getSectionComponent } from "../shared/get-section-component";
import { PageLink } from "../shared/page-link";
import { PageIcon } from "../shared/page-icon";
import { PagePicture } from "../shared/page-picture";
import type { TemplateProps } from "../azurill/types";
import { useResumeTemplateData } from "../use-resume-template-data";

const sectionClassName = cn(
    "mb-5",
    "[&>h6]:text-[0.6rem] [&>h6]:font-extrabold [&>h6]:uppercase [&>h6]:tracking-[0.25em] [&>h6]:mb-3",
    "[&>h6]:text-gray-900 [&>h6]:border-b-2 [&>h6]:border-gray-900 [&>h6]:pb-1.5 [&>h6]:inline-block",
);

/**
 * Template: Onyx ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Elegant Minimalism
 * A clean, minimal single-column template with strong typographic hierarchy.
 */
export function OnyxTemplate({ pageIndex = 0 }: TemplateProps) {
    const resumeData = useResumeTemplateData();
    const basics = resumeData.basics;
    const themePrimary = resumeData.metadata.theme?.primary || '#111';

    const storeLayout = resumeData.metadata.layout.pages[pageIndex];
    const defaultOrder = ['summary', 'experience', 'education', 'skills', 'projects'];
    const layoutSections = storeLayout ? [...storeLayout.main, ...storeLayout.sidebar] : defaultOrder;

    return (
        <div style={{ '--page-primary-color': themePrimary } as React.CSSProperties} className="template-onyx page-content p-12 h-full bg-white text-gray-800">
            {/* Header */}
            <header className="mb-8 rounded-[2rem] border border-gray-100/80 bg-slate-50/70 px-7 py-7 shadow-[0_16px_30px_rgba(15,23,42,0.06)]">
                {/* Top accent line */}
                <div className="w-full h-1 bg-gray-900 mb-6" />

                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-extrabold uppercase tracking-tight text-gray-900 leading-none">{basics.name}</h1>
                        <p className="text-sm font-medium text-gray-500 mt-1.5 tracking-wide">{basics.headline}</p>
                    </div>
                    {basics.picture && !basics.picture.effects?.hidden && (
                        <PagePicture className="w-28 h-28 rounded-[1.75rem] border-[4px] border-gray-200 bg-white p-1.5 shadow-[0_18px_30px_rgba(15,23,42,0.12)]" />
                    )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-200/80 pt-4 text-[0.72rem] text-gray-500 [&_svg]:text-[color:var(--page-primary-color)] *:flex *:items-center *:gap-x-1.5 *:rounded-full *:border *:border-gray-200/80 *:bg-white/90 *:px-3 *:py-1.5 *:shadow-[0_6px_16px_rgba(15,23,42,0.05)]">
                    {basics.email && (
                        <div className="flex items-center gap-1.5">
                            <PageIcon name="Envelope" size={12} />
                            <PageLink type="email" value={basics.email} />
                        </div>
                    )}
                    {basics.phone && (
                        <div className="flex items-center gap-1.5">
                            <PageIcon name="Phone" size={12} />
                            <PageLink type="phone" value={basics.phone} />
                        </div>
                    )}
                    {basics.location && (
                        <div className="flex items-center gap-1.5">
                            <PageIcon name="MapPin" size={12} />
                            <span>{basics.location}</span>
                        </div>
                    )}
                    {basics.website?.url && (
                        <div className="flex items-center gap-1.5">
                            <PageIcon name="Globe" size={12} />
                            <PageLink type="url" value={basics.website.url} label={basics.website.label} />
                        </div>
                    )}
                </div>
            </header>

            {/* Content */}
            <main className="space-y-1">
                {layoutSections.map((sectionId) => {
                    const Component = getSectionComponent(sectionId, { sectionClassName });
                    return <Component key={sectionId} id={sectionId} />;
                })}
            </main>
        </div>
    );
}
