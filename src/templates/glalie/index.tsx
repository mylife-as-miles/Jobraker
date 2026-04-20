import { Envelope, Globe, MapPin, Phone } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { getSectionComponent } from "../shared/get-section-component";
import { PageIcon } from "../shared/page-icon";
import { PageLink } from "../shared/page-link";
import { PagePicture } from "../shared/page-picture";
import type { TemplateProps } from "../azurill/types";
import { useResumeTemplateData } from "../use-resume-template-data";

const sectionClassName = cn(
	// Section Heading
	"[&>h6]:border-b [&>h6]:border-[color:var(--page-primary-color)]/30 [&>h6]:pb-1.5",

	// Sidebar headings Ã¢â‚¬â€ light on dark
	"group-data-[layout=sidebar]:[&>h6]:text-[color:var(--page-primary-color)]",

	// Section Item Header in Sidebar Layout
	"group-data-[layout=sidebar]:[&_.section-item-header>div]:flex-col",
	"group-data-[layout=sidebar]:[&_.section-item-header>div]:items-start",
);

/**
 * Template: Glalie Ã¢â‚¬â€ Left Sidebar with Card Contact
 * A modern template with a light left sidebar, centered profile, and contact info in a bordered card.
 */
export function GlalieTemplate({ pageIndex = 0, pageLayout }: TemplateProps) {
	const defaultLayout = {
		fullWidth: false,
		main: ['summary', 'experience', 'education', 'projects'],
		sidebar: ['skills']
	};
	const resumeData = useResumeTemplateData();
	const storeLayout = resumeData.metadata.layout.pages[pageIndex];
	const themePrimary = resumeData.metadata.theme?.primary || '#2dd4bf';
	const layout = pageLayout || storeLayout || defaultLayout;

	const isFirstPage = pageIndex === 0;
	const { main, sidebar, fullWidth } = layout;

	const styles: React.CSSProperties = {
		'--page-primary-color': themePrimary,
		'--page-background-color': '#ffffff',
		'--page-sidebar-width': '30%',
		'--page-margin-x': '2rem',
		'--page-margin-y': '2rem',
	} as React.CSSProperties;

	return (
		<div style={styles} className="template-glalie page-content relative h-full bg-white text-gray-800">
			{/* Sidebar Background */}
			{(!fullWidth || isFirstPage) && (
				<div className="page-sidebar-background pointer-events-none absolute inset-y-0 z-0 w-[var(--page-sidebar-width)] shrink-0 bg-[color:var(--page-primary-color)]/5 left-0" />
			)}

			<div className="flex h-full">
				{(!fullWidth || isFirstPage) && (
					<aside
						data-layout="sidebar"
						className="group page-sidebar z-10 flex w-[var(--page-sidebar-width)] shrink-0 flex-col space-y-5 px-[var(--page-margin-x)] pt-[var(--page-margin-y)]"
					>
						{isFirstPage && <Header />}

						{!fullWidth && (
							<div className="shrink-0 space-y-5 overflow-x-hidden">
								{sidebar.map((section: string) => {
									const Component = getSectionComponent(section, { sectionClassName });
									return <Component key={section} id={section} />;
								})}
							</div>
						)}
					</aside>
				)}

				<main data-layout="main" className="group page-main z-10 flex-1">
					<div className="space-y-5 px-[var(--page-margin-x)] pt-[var(--page-margin-y)]">
						{main.map((section: string) => {
							const Component = getSectionComponent(section, { sectionClassName });
							return <Component key={section} id={section} />;
						})}
					</div>
				</main>
			</div>
		</div>
	);
}

function Header() {
	const basics = useResumeTemplateData().basics;

	return (
		<div className="page-header relative flex">
			<div className="flex w-full shrink-0 flex-col items-center justify-center gap-y-3">
				<PagePicture className="w-32 h-32 rounded-[2rem] border-[4px] border-[color:var(--page-primary-color)]/30 bg-white p-1.5 shadow-[0_18px_30px_rgba(15,23,42,0.12)]" />

				<div className="text-center">
					<h2 className="basics-name text-xl font-extrabold tracking-tight text-gray-900">{basics.name}</h2>
					<p className="basics-headline text-sm text-[color:var(--page-primary-color)] font-medium mt-0.5">{basics.headline}</p>
				</div>

				<div className="basics-items flex w-full flex-col gap-y-2 rounded-[1.5rem] border border-[color:var(--page-primary-color)]/20 bg-white/95 p-4 text-[0.66rem] text-gray-500 shadow-[0_12px_24px_rgba(15,23,42,0.08)] *:flex *:items-center *:gap-x-1.5 *:rounded-xl *:border *:border-[color:var(--page-primary-color)]/10 *:bg-[color:var(--page-primary-color)]/5 *:px-3 *:py-2">
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
							<PageLink type="url" value={basics.website.url} label={basics.website.label} />
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
