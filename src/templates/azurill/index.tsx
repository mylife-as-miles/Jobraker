import { cn } from "../../lib/utils";
import { getSectionComponent } from "../shared/get-section-component";
import { PageIcon } from "../shared/page-icon";
import { PageLink } from "../shared/page-link";
import { PagePicture } from "../shared/page-picture";
import { useArtboardStore } from "../../store/artboard";
import type { TemplateProps } from "./types";

const sectionClassName = cn(
    // Heading Decoration in Sidebar Layout
    "group-data-[layout=sidebar]:mb-10",
    "group-data-[layout=sidebar]:[&>h6]:flex group-data-[layout=sidebar]:[&>h6]:items-center group-data-[layout=sidebar]:[&>h6]:gap-2 group-data-[layout=sidebar]:[&>h6]:mb-4",
    "group-data-[layout=sidebar]:[&>h6]:text-slate-900 group-data-[layout=sidebar]:[&>h6]:font-bold group-data-[layout=sidebar]:[&>h6]:uppercase group-data-[layout=sidebar]:[&>h6]:tracking-wider group-data-[layout=sidebar]:[&>h6]:text-sm",
    "group-data-[layout=sidebar]:[&>h6]:before:content-[''] group-data-[layout=sidebar]:[&>h6]:before:size-1.5 group-data-[layout=sidebar]:[&>h6]:before:rounded-full group-data-[layout=sidebar]:[&>h6]:before:bg-[var(--page-primary-color)]",
    "group-data-[layout=sidebar]:[&>h6]:after:content-[''] group-data-[layout=sidebar]:[&>h6]:after:size-1.5 group-data-[layout=sidebar]:[&>h6]:after:rounded-full group-data-[layout=sidebar]:[&>h6]:after:bg-[var(--page-primary-color)]",

    // Section Items in Sidebar Layout
    "group-data-[layout=sidebar]:[&_.section-item]:mb-4",
    "group-data-[layout=sidebar]:[&_.section-item-header_h4]:text-slate-900 group-data-[layout=sidebar]:[&_.section-item-header_h4]:font-bold group-data-[layout=sidebar]:[&_.section-item-header_h4]:text-sm",
    "group-data-[layout=sidebar]:[&_.section-item-header_p]:text-[var(--page-primary-color)] group-data-[layout=sidebar]:[&_.section-item-header_p]:text-xs group-data-[layout=sidebar]:[&_.section-item-header_p]:font-semibold group-data-[layout=sidebar]:[&_.section-item-header_p]:mb-1",
    "group-data-[layout=sidebar]:[&_.section-item-header_span]:text-slate-500 group-data-[layout=sidebar]:[&_.section-item-header_span]:text-xs",

    // Main Column Layout - Timeline Dots
    "group-data-[layout=main]:mb-10 group-data-[layout=main]:relative",
    "group-data-[layout=main]:[&>h6]:text-slate-900 group-data-[layout=main]:[&>h6]:font-bold group-data-[layout=main]:[&>h6]:uppercase group-data-[layout=main]:[&>h6]:tracking-wider group-data-[layout=main]:[&>h6]:text-sm group-data-[layout=main]:[&>h6]:mb-6",
    "group-data-[layout=main]:[&>h6]:before:content-[''] group-data-[layout=main]:[&>h6]:before:absolute group-data-[layout=main]:[&>h6]:before:left-[-34px] group-data-[layout=main]:[&>h6]:before:top-1 group-data-[layout=main]:[&>h6]:before:size-3 group-data-[layout=main]:[&>h6]:before:rounded-full group-data-[layout=main]:[&>h6]:before:border-2 group-data-[layout=main]:[&>h6]:before:border-[var(--page-primary-color)] group-data-[layout=main]:[&>h6]:before:bg-white group-data-[layout=main]:[&>h6]:before:z-10",

    // Section Items in Main Layout
    "group-data-[layout=main]:[&_.section-item]:mb-8 group-data-[layout=main]:[&_.section-item]:relative",
    "group-data-[layout=main]:[&_.section-item-header]:flex group-data-[layout=main]:[&_.section-item-header]:justify-between group-data-[layout=main]:[&_.section-item-header]:items-baseline group-data-[layout=main]:[&_.section-item-header]:mb-1",
    "group-data-[layout=main]:[&_.section-item-header_h4]:text-slate-900 group-data-[layout=main]:[&_.section-item-header_h4]:font-bold group-data-[layout=main]:[&_.section-item-header_h4]:text-base",
    "group-data-[layout=main]:[&_.section-item-header_span]:px-2 group-data-[layout=main]:[&_.section-item-header_span]:py-0.5 group-data-[layout=main]:[&_.section-item-header_span]:bg-slate-100 group-data-[layout=main]:[&_.section-item-header_span]:text-slate-600 group-data-[layout=main]:[&_.section-item-header_span]:text-xs group-data-[layout=main]:[&_.section-item-header_span]:rounded group-data-[layout=main]:[&_.section-item-header_span]:font-medium",
    "group-data-[layout=main]:[&_.section-item-header_p]:text-[var(--page-primary-color)] group-data-[layout=main]:[&_.section-item-header_p]:font-semibold group-data-[layout=main]:[&_.section-item-header_p]:text-sm group-data-[layout=main]:[&_.section-item-header_p]:mb-3",
    "group-data-[layout=main]:[&_.section-content]:list-disc group-data-[layout=main]:[&_.section-content]:list-outside group-data-[layout=main]:[&_.section-content]:ml-4 group-data-[layout=main]:[&_.section-content]:space-y-2 group-data-[layout=main]:[&_.section-content]:text-sm group-data-[layout=main]:[&_.section-content]:text-slate-600",
);

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
                        {sidebar.map((section: string) => {
                            const Component = getSectionComponent(section, {
                                sectionClassName,
                            });
                            return <Component key={section} id={section} />;
                        })}
                    </aside>
                )}

                <main data-layout='main' className='group page-main w-2/3 px-10 py-10 relative'>
                    {/* Timeline Line */}
                    <div className="absolute left-[38px] top-12 bottom-12 w-[2px] bg-[var(--page-primary-color)]/30"></div>

                    {main.map((section: string) => {
                        const Component = getSectionComponent(section, {
                            sectionClassName,
                        });
                        return <Component key={section} id={section} />;
                    })}
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
