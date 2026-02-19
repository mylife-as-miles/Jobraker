import React from 'react';
import { useArtboardStore } from "../../store/artboard";
import { cn } from "../../lib/utils";
import { getSectionComponent } from "../shared/get-section-component";
import type { TemplateProps } from "../azurill/types";

const sectionClassName = cn(
    // Section Heading styling
    "[&>h6]:text-xs [&>h6]:font-bold [&>h6]:uppercase [&>h6]:tracking-wider [&>h6]:mb-3 [&>h6]:pb-1 [&>h6]:border-b [&>h6]:border-gray-300",
    // Section Content
    "[&_.section-content]:text-sm",
);

/**
 * Template: Eevee — Boxed Header & Clean Layout
 * A professional template with a distinctive boxed header and organized sidebar.
 */
export function EeveeTemplate({ pageIndex = 0, pageLayout, metadataOverride }: TemplateProps) {
    const defaultLayout = {
        fullWidth: false,
        sidebar: ['skills', 'interests', 'languages'],
        main: ['summary', 'experience', 'education', 'volunteer', 'projects', 'certifications', 'awards', 'references']
    };

    const storeLayout = useArtboardStore((state) => state.resume.data.metadata.layout.pages[pageIndex]);
    const storeMetadata = useArtboardStore((state) => state.resume.data.metadata);

    const metadata = metadataOverride || storeMetadata;
    const themePrimary = metadata.theme?.primary || '#000000';
    const typography = metadata.typography.font;

    const layout = pageLayout || storeLayout || defaultLayout;
    const basics = useArtboardStore((state) => state.resume.data.basics);

    const isFirstPage = pageIndex === 0;
    const { main, sidebar, fullWidth } = layout;

    const styles: React.CSSProperties = {
        '--page-primary-color': themePrimary,
        '--page-background-color': '#f3f4f6', // Light gray background for page
        '--page-sidebar-width': '30%',
        '--page-margin-x': '2.5rem',
        '--page-margin-y': '2.5rem',
        '--page-gap-y': '2rem',
        fontFamily: typography.family,
    } as React.CSSProperties;

    return (
        <div style={styles} className="template-eevee w-full h-full bg-white text-gray-800 relative">
            {/* Gray background overlay for the left sidebar area if needed */}
            <div className="absolute top-0 bottom-0 left-0 w-[var(--page-sidebar-width)] bg-gray-100/50 print:bg-gray-100/50" />

            <div className="relative z-10 h-full flex flex-col px-[var(--page-margin-x)] pt-[var(--page-margin-y)]">

                {/* Header Section */}
                {isFirstPage && (
                    <header className="mb-12 flex justify-end">
                        <div className="w-[65%] border-[3px] border-gray-900 p-8 text-center bg-white">
                            <h1 className="text-3xl font-black tracking-widest uppercase text-gray-900 mb-2">
                                {basics.name}
                            </h1>
                            <p className="text-sm font-medium tracking-[0.2em] uppercase text-gray-500">
                                {basics.headline}
                            </p>
                        </div>
                    </header>
                )}

                <div className="flex gap-x-12 h-full flex-1">
                    {/* Sidebar */}
                    {!fullWidth && (
                        <aside className="w-[var(--page-sidebar-width)] shrink-0 flex flex-col gap-y-8 text-sm">

                            {/* Details Section (Manual) */}
                            {isFirstPage && (
                                <div className="space-y-4">
                                    <h6 className="text-xs font-bold uppercase tracking-wider border-b border-gray-300 pb-1 mb-3">
                                        Details
                                    </h6>

                                    <div className="space-y-4 text-xs">
                                        {basics.location && (
                                            <div>
                                                <div className="font-bold uppercase text-gray-900 mb-0.5">Address</div>
                                                <div className="text-gray-600">{basics.location}</div>
                                            </div>
                                        )}

                                        {basics.phone && (
                                            <div>
                                                <div className="font-bold uppercase text-gray-900 mb-0.5">Phone</div>
                                                <div className="text-gray-600">
                                                    <a href={`tel:${basics.phone}`} className="hover:underline">{basics.phone}</a>
                                                </div>
                                            </div>
                                        )}

                                        {basics.email && (
                                            <div>
                                                <div className="font-bold uppercase text-gray-900 mb-0.5">Email</div>
                                                <div className="text-gray-600">
                                                    <a href={`mailto:${basics.email}`} className="hover:underline text-wrap break-all">{basics.email}</a>
                                                </div>
                                            </div>
                                        )}

                                        {basics.website && basics.website.url && (
                                            <div>
                                                <div className="font-bold uppercase text-gray-900 mb-0.5">Website</div>
                                                <div className="text-gray-600">
                                                    <a href={basics.website.url} target="_blank" rel="noreferrer" className="hover:underline break-all">
                                                        {basics.website.label || basics.website.url}
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Sidebar Dynamic Sections */}
                            <div className="space-y-8">
                                {sidebar.map((section: string) => {
                                    const Component = getSectionComponent(section, { sectionClassName });
                                    return <Component key={section} id={section} />;
                                })}
                            </div>

                        </aside>
                    )}

                    {/* Main Content */}
                    <main className="flex-1 flex flex-col gap-y-8">
                        {main.map((section: string) => {
                            const Component = getSectionComponent(section, {
                                sectionClassName: cn(sectionClassName, "space-y-4")
                            });
                            return <Component key={section} id={section} />;
                        })}
                    </main>
                </div>
            </div>
        </div>
    );
}
