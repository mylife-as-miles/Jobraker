import React from 'react';
import { Envelope, Globe, MapPin, Phone } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { getSectionComponent } from "../shared/get-section-component";
import { PageIcon } from "../shared/page-icon";
import { PageLink } from "../shared/page-link";
import { PagePicture } from "../shared/page-picture";
import type { TemplateProps } from "../azurill/types";
import { useResumeTemplateData } from "../use-resume-template-data";

const sectionClassName = cn(
  "[&>h6]:text-xs [&>h6]:font-bold [&>h6]:uppercase [&>h6]:tracking-wider [&>h6]:mb-3 [&>h6]:pb-1 [&>h6]:border-b [&>h6]:border-gray-300",
  "[&_.section-content]:text-sm",
);

/**
 * Template: Eevee - Boxed Header and Clean Layout
 * A professional template with a distinctive boxed header and organized sidebar.
 */
export function EeveeTemplate({ pageIndex = 0, pageLayout }: TemplateProps) {
  const defaultLayout = {
    fullWidth: false,
    sidebar: ['skills', 'interests', 'languages'],
    main: ['summary', 'experience', 'education', 'volunteer', 'projects', 'certifications', 'awards', 'references'],
  };

  const resumeData = useResumeTemplateData();
  const storeLayout = resumeData.metadata.layout.pages[pageIndex];
  const metadata = resumeData.metadata;
  const basics = resumeData.basics;
  const themePrimary = metadata.theme?.primary || '#000000';
  const typography = metadata.typography.font;
  const layout = pageLayout || storeLayout || defaultLayout;

  const isFirstPage = pageIndex === 0;
  const { main, sidebar, fullWidth } = layout;

  const styles: React.CSSProperties = {
    '--page-primary-color': themePrimary,
    '--page-background-color': '#f3f4f6',
    '--page-sidebar-width': '30%',
    '--page-margin-x': '2.5rem',
    '--page-margin-y': '2.5rem',
    '--page-gap-y': '2rem',
    fontFamily: typography.family,
  } as React.CSSProperties;

  return (
    <div style={styles} className="template-eevee w-full h-full bg-white text-gray-800 relative">
      <div className="absolute top-0 bottom-0 left-0 w-[var(--page-sidebar-width)] bg-gray-100/50 print:bg-gray-100/50" />

      <div className="relative z-10 h-full flex flex-col px-[var(--page-margin-x)] pt-[var(--page-margin-y)]">
        {isFirstPage && (
          <header className="mb-12 flex justify-end">
            <div className="w-[72%] rounded-[2rem] border-[3px] border-gray-900 bg-white px-7 py-7 shadow-[0_18px_36px_rgba(15,23,42,0.10)]">
              <div className="flex items-center gap-6">
                <PagePicture className="h-28 w-28 rounded-[2rem] border-[4px] border-gray-900/10 bg-white p-1.5 shadow-[0_18px_28px_rgba(15,23,42,0.12)] shrink-0" />
                <div className="min-w-0 flex-1 text-left">
                  <h1 className="mb-2 text-3xl font-black uppercase tracking-[0.08em] text-gray-900">
                    {basics.name}
                  </h1>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-500">
                    {basics.headline}
                  </p>
                  <div className="basics-items mt-4 flex flex-wrap gap-2 text-[0.72rem] text-gray-500 [&_svg]:text-[color:var(--page-primary-color)] *:flex *:items-center *:gap-x-1.5 *:rounded-full *:border *:border-gray-200/80 *:bg-white/95 *:px-3 *:py-1.5 *:shadow-[0_6px_16px_rgba(15,23,42,0.05)]">
                    {basics.email && (
                      <div className="basics-item-email">
                        <Envelope />
                        <PageLink type="email" value={basics.email} />
                      </div>
                    )}
                    {basics.phone && (
                      <div className="basics-item-phone">
                        <Phone />
                        <PageLink type="phone" value={basics.phone} />
                      </div>
                    )}
                    {basics.location && (
                      <div className="basics-item-location">
                        <MapPin />
                        <span>{basics.location}</span>
                      </div>
                    )}
                    {basics.website && basics.website.url && (
                      <div className="basics-item-website">
                        <Globe />
                        <PageLink
                          type="url"
                          value={basics.website.url}
                          label={basics.website.label || basics.website.url}
                        />
                      </div>
                    )}
                    {basics.customFields.map((field) => (
                      <div key={field.id} className="basics-item-custom">
                        <PageIcon name={field.icon} />
                        {field.link ? (
                          <PageLink type="url" value={field.link} label={field.text} />
                        ) : (
                          <span>{field.text}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </header>
        )}

        <div className="flex h-full flex-1 gap-x-12">
          {!fullWidth && (
            <aside className="w-[var(--page-sidebar-width)] shrink-0 flex flex-col gap-y-8 text-sm">
              {isFirstPage && (
                <div className="rounded-[1.5rem] border border-gray-200/80 bg-white/90 p-4 shadow-[0_12px_24px_rgba(15,23,42,0.06)]">
                  <h6 className="mb-3 border-b border-gray-300 pb-1 text-xs font-bold uppercase tracking-wider">
                    Details
                  </h6>

                  <div className="space-y-2.5 text-xs">
                    {basics.location && (
                      <div className="rounded-xl border border-gray-200/80 bg-slate-50/90 px-3 py-2">
                        <div className="mb-0.5 font-bold uppercase text-gray-900">Address</div>
                        <div className="text-gray-600">{basics.location}</div>
                      </div>
                    )}

                    {basics.phone && (
                      <div className="rounded-xl border border-gray-200/80 bg-slate-50/90 px-3 py-2">
                        <div className="mb-0.5 font-bold uppercase text-gray-900">Phone</div>
                        <div className="text-gray-600">
                          <a href={`tel:${basics.phone}`} className="hover:underline">
                            {basics.phone}
                          </a>
                        </div>
                      </div>
                    )}

                    {basics.email && (
                      <div className="rounded-xl border border-gray-200/80 bg-slate-50/90 px-3 py-2">
                        <div className="mb-0.5 font-bold uppercase text-gray-900">Email</div>
                        <div className="text-gray-600 break-all">
                          <a href={`mailto:${basics.email}`} className="hover:underline">
                            {basics.email}
                          </a>
                        </div>
                      </div>
                    )}

                    {basics.website && basics.website.url && (
                      <div className="rounded-xl border border-gray-200/80 bg-slate-50/90 px-3 py-2">
                        <div className="mb-0.5 font-bold uppercase text-gray-900">Website</div>
                        <div className="text-gray-600 break-all">
                          <a
                            href={basics.website.url}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline"
                          >
                            {basics.website.label || basics.website.url}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-8">
                {sidebar.map((section: string) => {
                  const Component = getSectionComponent(section, { sectionClassName });
                  return <Component key={section} id={section} />;
                })}
              </div>
            </aside>
          )}

          <main className="flex-1 flex flex-col gap-y-8">
            {main.map((section: string) => {
              const Component = getSectionComponent(section, {
                sectionClassName: cn(sectionClassName, 'space-y-4'),
              });
              return <Component key={section} id={section} />;
            })}
          </main>
        </div>
      </div>
    </div>
  );
}
