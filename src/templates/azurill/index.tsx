import { cn } from "../../lib/utils";
import { getSectionComponent } from "../shared/get-section-component";
import { PageIcon } from "../shared/page-icon";
import { PageLink } from "../shared/page-link";
import { PagePicture } from "../shared/page-picture";
import type { TemplateProps } from "./types";
import { useResumeTemplateData } from "../use-resume-template-data";

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
  "group-data-[layout=sidebar]:[&>h6]:before:bg-[var(--page-primary-color)]",
  "group-data-[layout=sidebar]:[&>h6]:after:content-['']",
  "group-data-[layout=sidebar]:[&>h6]:after:absolute",
  "group-data-[layout=sidebar]:[&>h6]:after:right-0",
  "group-data-[layout=sidebar]:[&>h6]:after:rounded-full",
  "group-data-[layout=sidebar]:[&>h6]:after:size-1.5",
  "group-data-[layout=sidebar]:[&>h6]:after:bg-[var(--page-primary-color)]",

  // Section in Sidebar Layout
  "group-data-[layout=sidebar]:[&_.section-item-header>div]:flex-col",
  "group-data-[layout=sidebar]:[&_.section-item-header>div]:items-start",

  // Section in Main Layout ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Timeline
  "group-data-[layout=main]:[&>.section-content]:relative",
  "group-data-[layout=main]:[&>.section-content]:ml-3",
  "group-data-[layout=main]:[&>.section-content]:pl-4",
  "group-data-[layout=main]:[&>.section-content]:border-l",
  "group-data-[layout=main]:[&>.section-content]:border-[var(--page-primary-color)]/20",

  // Timeline Marker
  "group-data-[layout=main]:[&>.section-content]:after:content-['']",
  "group-data-[layout=main]:[&>.section-content]:after:absolute",
  "group-data-[layout=main]:[&>.section-content]:after:top-5",
  "group-data-[layout=main]:[&>.section-content]:after:left-0",
  "group-data-[layout=main]:[&>.section-content]:after:size-2",
  "group-data-[layout=main]:[&>.section-content]:after:translate-x-[-50%]",
  "group-data-[layout=main]:[&>.section-content]:after:translate-y-[-50%]",
  "group-data-[layout=main]:[&>.section-content]:after:rounded-full",
  "group-data-[layout=main]:[&>.section-content]:after:bg-[var(--page-primary-color)]",
);

/**
 * Template: Azurill ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Clean Timeline
 * A professional template with a timeline-style main column and clean sidebar.
 */
export function AzurillTemplate({ pageIndex = 0, pageLayout }: TemplateProps) {
  const defaultLayout = {
    fullWidth: false,
    main: ["summary", "experience", "education", "projects"],
    sidebar: ["skills"],
  };

  const resumeData = useResumeTemplateData();
  const storeLayout = resumeData.metadata.layout.pages[pageIndex];
  const metadata = resumeData.metadata;
  const theme = metadata.theme;
  const typography = metadata.typography.font;
  const page = metadata.page;

  const themePrimary = theme?.primary || "#3b82f6";
  const themeText = theme?.text || "#1f2937";
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
          padding: `${page.margin}mm`,
        } as React.CSSProperties
      }
      className='template-azurill page-content space-y-5 h-full'
    >
      {isFirstPage && <Header />}

      <div className='flex gap-x-8 h-full'>
        {!fullWidth && (
          <aside
            data-layout='sidebar'
            className='group page-sidebar w-[28%] shrink-0 space-y-5 overflow-x-hidden border-r border-gray-100 pr-6'
          >
            {sidebar.map((section: string) => {
              const Component = getSectionComponent(section, {
                sectionClassName,
              });
              return <Component key={section} id={section} />;
            })}
          </aside>
        )}

        <main data-layout='main' className='group page-main grow space-y-5'>
          {main.map((section: string) => {
            const Component = getSectionComponent(section, {
              sectionClassName,
            });
            return <Component key={section} id={section} />;
          })}
        </main>
      </div>
    </div>
  );
}

function Header() {
  const basics = useResumeTemplateData().basics;
  // Inherit colors from parent CSS variables or context, but for explicit classes we might need store or use 'text-[var(--page-primary-color)]'
  // Since we set CSS variable in parent, we can use it here.

  return (
    <div className='page-header flex items-start gap-x-6 rounded-[2rem] border border-gray-100/80 bg-slate-50/80 px-6 py-6 shadow-[0_18px_32px_rgba(15,23,42,0.06)]'>
      <PagePicture className='w-32 h-32 rounded-full border-[4px] border-[var(--page-primary-color)] bg-white p-1.5 shadow-[0_18px_28px_rgba(15,23,42,0.14)] shrink-0' />

      <div className='page-basics space-y-2.5 min-w-0'>
        <div className='basics-header'>
          <h2 className='basics-name text-2xl font-bold tracking-tight text-current'>
            {basics.name}
          </h2>
          <p className='basics-headline text-sm text-[var(--page-primary-color)] font-medium mt-0.5'>
            {basics.headline}
          </p>
        </div>

        <div className='basics-items flex flex-wrap gap-2 text-[0.72rem] text-gray-500 [&_svg]:text-[var(--page-primary-color)] *:flex *:items-center *:gap-x-1.5 *:rounded-full *:border *:border-gray-200/80 *:bg-white/90 *:px-3 *:py-1.5 *:shadow-[0_6px_16px_rgba(15,23,42,0.05)]'>
          {basics.email && (
            <div className='basics-item-email'>
              <PageIcon name='Envelope' />
              <PageLink type='email' value={basics.email} />
            </div>
          )}
          {basics.phone && (
            <div className='basics-item-phone'>
              <PageIcon name='Phone' />
              <PageLink type='phone' value={basics.phone} />
            </div>
          )}
          {basics.location && (
            <div className='basics-item-location'>
              <PageIcon name='MapPin' />
              <span>{basics.location}</span>
            </div>
          )}
          {basics.website && basics.website.url && (
            <div className='basics-item-website'>
              <PageIcon name='Globe' />
              <PageLink
                type='url'
                value={basics.website.url}
                label={basics.website.label || basics.website.url}
              />
            </div>
          )}
          {basics.customFields.map((field) => (
            <div key={field.id} className='basics-item-custom'>
              <PageIcon name={field.icon} />
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
