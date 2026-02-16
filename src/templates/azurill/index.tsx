import { cn } from "../../lib/utils";
import { getSectionComponent } from "../shared/get-section-component";
import { PageIcon } from "../shared/page-icon";
import { PageLink } from "../shared/page-link";
import { PagePicture } from "../shared/page-picture";
import { useArtboardStore } from "../../store/artboard";
import type { TemplateProps } from "./types";

const sectionClassName = cn(
    // Heading Decoration in Sidebar Layout
    "group-data-[layout=sidebar]:[&>h6]:px-4",
    "group-data-[layout=sidebar]:[&>h6]:relative",
    "group-data-[layout=sidebar]:[&>h6]:inline-flex",
    "group-data-[layout=sidebar]:[&>h6]:items-center",
    "group-data-[layout=sidebar]:[&>h6]:before:content-['']",
    "group-data-[layout=sidebar]:[&>h6]:before:absolute",
    "group-data-[layout=sidebar]:[&>h6]:before:left-0",
    "group-data-[layout=sidebar]:[&>h6]:before:rounded-full",
    "group-data-[layout=sidebar]:[&>h6]:before:size-1.5",
    "group-data-[layout=sidebar]:[&>h6]:before:bg-[#3b82f6]",
    "group-data-[layout=sidebar]:[&>h6]:after:content-['']",
    "group-data-[layout=sidebar]:[&>h6]:after:absolute",
    "group-data-[layout=sidebar]:[&>h6]:after:right-0",
    "group-data-[layout=sidebar]:[&>h6]:after:rounded-full",
    "group-data-[layout=sidebar]:[&>h6]:after:size-1.5",
    "group-data-[layout=sidebar]:[&>h6]:after:bg-[#3b82f6]",

    // Section in Sidebar Layout
    "group-data-[layout=sidebar]:[&_.section-item-header>div]:flex-col",
    "group-data-[layout=sidebar]:[&_.section-item-header>div]:items-start",

    // Section in Main Layout — Timeline
    "group-data-[layout=main]:[&>.section-content]:relative",
    "group-data-[layout=main]:[&>.section-content]:ml-3",
    "group-data-[layout=main]:[&>.section-content]:pl-4",
    "group-data-[layout=main]:[&>.section-content]:border-l",
    "group-data-[layout=main]:[&>.section-content]:border-[#3b82f6]/20",

    // Timeline Marker
    "group-data-[layout=main]:[&>.section-content]:after:content-['']",
    "group-data-[layout=main]:[&>.section-content]:after:absolute",
    "group-data-[layout=main]:[&>.section-content]:after:top-5",
    "group-data-[layout=main]:[&>.section-content]:after:left-0",
    "group-data-[layout=main]:[&>.section-content]:after:size-2",
    "group-data-[layout=main]:[&>.section-content]:after:translate-x-[-50%]",
    "group-data-[layout=main]:[&>.section-content]:after:translate-y-[-50%]",
    "group-data-[layout=main]:[&>.section-content]:after:rounded-full",
    "group-data-[layout=main]:[&>.section-content]:after:bg-[#3b82f6]",
);

/**
 * Template: Azurill — Clean Timeline
 * A professional template with a timeline-style main column and clean sidebar.
 */
export function AzurillTemplate({ pageIndex = 0, pageLayout }: TemplateProps) {
    const defaultLayout = {
        fullWidth: false,
        main: ['summary', 'experience', 'education', 'projects'],
        sidebar: ['skills']
    };

    const storeLayout = useArtboardStore((state) => state.resume.data.metadata.layout.pages[pageIndex]);
    const themePrimary = useArtboardStore((state) => state.resume.data.metadata.theme?.primary) || '#3b82f6';
    const layout = pageLayout || storeLayout || defaultLayout;

    const isFirstPage = pageIndex === 0;
    const { main, sidebar, fullWidth } = layout;

    return (
        <div style={{ '--page-primary-color': themePrimary } as React.CSSProperties} className="template-azurill page-content space-y-5 px-10 pt-10 print:p-8 h-full bg-white text-gray-800">
            {isFirstPage && <Header />}

            <div className="flex gap-x-8 h-full">
                {!fullWidth && (
                    <aside
                        data-layout="sidebar"
                        className="group page-sidebar w-[28%] shrink-0 space-y-5 overflow-x-hidden border-r border-gray-100 pr-6"
                    >
                        {sidebar.map((section: string) => {
                            const Component = getSectionComponent(section, { sectionClassName });
                            return <Component key={section} id={section} />;
                        })}
                    </aside>
                )}

                <main data-layout="main" className="group page-main grow space-y-5">
                    {main.map((section: string) => {
                        const Component = getSectionComponent(section, { sectionClassName });
                        return <Component key={section} id={section} />;
                    })}
                </main>
            </div>
        </div>
    );
}

function Header() {
    const basics = useArtboardStore((state) => state.resume.data.basics);

    return (
        <div className="page-header flex items-start gap-x-6 pb-6 border-b border-gray-100">
            <PagePicture className="w-24 h-24 rounded-full border-2 border-[#3b82f6]/20 shadow-sm shrink-0" />

            <div className="page-basics space-y-2.5 min-w-0">
                <div className="basics-header">
                    <h2 className="basics-name text-2xl font-bold tracking-tight text-gray-900">{basics.name}</h2>
                    <p className="basics-headline text-sm text-[#3b82f6] font-medium mt-0.5">{basics.headline}</p>
                </div>

                <div className="basics-items flex flex-wrap gap-x-4 gap-y-1.5 text-[0.7rem] text-gray-500 *:flex *:items-center *:gap-x-1.5">
                    {basics.email && (
                        <div className="basics-item-email">
                            <PageIcon name="Envelope" />
                            <PageLink type="email" value={basics.email} />
                        </div>
                    )}
                    {basics.phone && (
                        <div className="basics-item-phone">
                            <PageIcon name="Phone" />
                            <PageLink type="phone" value={basics.phone} />
                        </div>
                    )}
                    {basics.location && (
                        <div className="basics-item-location">
                            <PageIcon name="MapPin" />
                            <span>{basics.location}</span>
                        </div>
                    )}
                    {basics.website && basics.website.url && (
                        <div className="basics-item-website">
                            <PageIcon name="Globe" />
                            <PageLink type="url" value={basics.website.url} label={basics.website.label || basics.website.url} />
                        </div>
                    )}
                    {basics.customFields.map((field) => (
                        <div key={field.id} className="basics-item-custom">
                            <PageIcon name={field.icon} />
                            {field.link ? <PageLink type="url" value={field.link} label={field.text} /> : <span>{field.text}</span>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
