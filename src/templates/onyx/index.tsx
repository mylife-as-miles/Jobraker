import { useArtboardStore } from "../../store/artboard";
import { cn } from "../../lib/utils";
import { getSectionComponent } from "../shared/get-section-component";
import { PageLink } from "../shared/page-link";
import { PageIcon } from "../shared/page-icon";
import { PagePicture } from "../shared/page-picture";
import type { TemplateProps } from "../azurill/types"; // Reuse types for now

const sectionClassName = cn(
    "mb-6",
    "[&>h6]:text-xs [&>h6]:font-bold [&>h6]:uppercase [&>h6]:tracking-wider [&>h6]:mb-3 [&>h6]:border-b [&>h6]:border-gray-900 [&>h6]:pb-1",
    "[&_.section-item]:mb-3",
    "[&_.section-item-title]:font-bold [&_.section-item-title]:text-gray-900",
    "[&_.section-item-subtitle]:text-sm [&_.section-item-subtitle]:font-medium [&_.section-item-subtitle]:text-gray-700",
    "[&_.section-item-date]:text-xs [&_.section-item-date]:text-gray-500 [&_.section-item-date]:italic",
    "[&_.section-item-description]:text-sm [&_.section-item-description]:mt-1"
);

export function OnyxTemplate({ pageIndex = 0 }: TemplateProps) {
    const basics = useArtboardStore((state) => state.resume.data.basics);
    const sections = useArtboardStore((state) => state.resume.data.sections);

    // Onyx is a simple single column layout
    // We'll just map through the main sections defined in metadata or defaults
    const storeLayout = useArtboardStore((state) => state.resume.data.metadata.layout.pages[pageIndex]);
    const defaultOrder = ['summary', 'experience', 'education', 'skills', 'projects'];
    // Merge main and sidebar for single column, or just use what's in 'main' if sidebar depends on layout
    const layoutSections = storeLayout ? [...storeLayout.main, ...storeLayout.sidebar] : defaultOrder;

    return (
        <div className="template-onyx page-content p-12 h-full bg-white text-gray-800 font-sans">
            {/* Header */}
            <header className="border-b-2 border-gray-900 pb-6 mb-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-4xl font-bold uppercase tracking-tight text-gray-900 mb-2">{basics.name}</h1>
                        <p className="text-lg font-medium text-gray-600 mb-4">{basics.headline}</p>
                    </div>
                    {basics.picture && !basics.picture.effects?.hidden && (
                        <PagePicture className="w-24 h-24 rounded-full border-2 border-gray-200" />
                    )}
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                    {basics.email && (
                        <div className="flex items-center gap-1.5">
                            <PageIcon name="Envelope" size={14} />
                            <PageLink type="email" value={basics.email} />
                        </div>
                    )}
                    {basics.phone && (
                        <div className="flex items-center gap-1.5">
                            <PageIcon name="Phone" size={14} />
                            <PageLink type="phone" value={basics.phone} />
                        </div>
                    )}
                    {basics.location && (
                        <div className="flex items-center gap-1.5">
                            <PageIcon name="MapPin" size={14} />
                            <span>{basics.location}</span>
                        </div>
                    )}
                    {basics.website?.url && (
                        <div className="flex items-center gap-1.5">
                            <PageIcon name="Globe" size={14} />
                            <PageLink type="url" value={basics.website.url} label={basics.website.label} />
                        </div>
                    )}
                </div>
            </header>

            {/* Content */}
            <main className="space-y-2">
                {layoutSections.map((sectionId) => {
                    const Component = getSectionComponent(sectionId, { sectionClassName });
                    return <Component key={sectionId} id={sectionId} />;
                })}
            </main>
        </div>
    );
}
