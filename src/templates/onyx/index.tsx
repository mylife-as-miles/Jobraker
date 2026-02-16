import { useArtboardStore } from "../../store/artboard";
import { cn } from "../../lib/utils";
import { getSectionComponent } from "../shared/get-section-component";
import { PageLink } from "../shared/page-link";
import { PageIcon } from "../shared/page-icon";
import { PagePicture } from "../shared/page-picture";
import type { TemplateProps } from "../azurill/types";

const sectionClassName = cn(
    "mb-5",
    "[&>h6]:text-[0.6rem] [&>h6]:font-extrabold [&>h6]:uppercase [&>h6]:tracking-[0.25em] [&>h6]:mb-3",
    "[&>h6]:text-gray-900 [&>h6]:border-b-2 [&>h6]:border-gray-900 [&>h6]:pb-1.5 [&>h6]:inline-block",
);

/**
 * Template: Onyx — Elegant Minimalism
 * A clean, minimal single-column template with strong typographic hierarchy.
 */
export function OnyxTemplate({ pageIndex = 0 }: TemplateProps) {
    const basics = useArtboardStore((state) => state.resume.data.basics);

    const storeLayout = useArtboardStore((state) => state.resume.data.metadata.layout.pages[pageIndex]);
    const defaultOrder = ['summary', 'experience', 'education', 'skills', 'projects'];
    const layoutSections = storeLayout ? [...storeLayout.main, ...storeLayout.sidebar] : defaultOrder;

    return (
        <div className="template-onyx page-content p-12 h-full bg-white text-gray-800 font-[system-ui]">
            {/* Header */}
            <header className="mb-8">
                {/* Top accent line */}
                <div className="w-full h-1 bg-gray-900 mb-6" />

                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-extrabold uppercase tracking-tight text-gray-900 leading-none">{basics.name}</h1>
                        <p className="text-sm font-medium text-gray-500 mt-1.5 tracking-wide">{basics.headline}</p>
                    </div>
                    {basics.picture && !basics.picture.effects?.hidden && (
                        <PagePicture className="w-20 h-20 rounded-full border border-gray-200 shadow-sm" />
                    )}
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[0.7rem] text-gray-500 mt-4 pt-4 border-t border-gray-100">
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
