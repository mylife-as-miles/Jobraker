import { Envelope, Globe, MapPin, Phone } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { getSectionComponent } from "../shared/get-section-component";
import { PageIcon } from "../shared/page-icon";
import { PageLink } from "../shared/page-link";
import { PagePicture } from "../shared/page-picture";
import type { TemplateProps } from "../azurill/types";
import { useResumeTemplateData } from "../use-resume-template-data";

const sectionClassName = cn(
	// Section Heading with accent underline
	"[&>h6]:border-[color:var(--page-primary-color)] [&>h6]:border-b-2 [&>h6]:pb-1",

	// Section Item Header in Sidebar Layout
	"group-data-[layout=sidebar]:[&_.section-item-header>div]:flex-col",
	"group-data-[layout=sidebar]:[&_.section-item-header>div]:items-start",
);

/**
 * Template: Pikachu ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Bold Accent Banner
 * A vibrant template with a colored header banner and sidebar layout.
 */
export function PikachuTemplate({ pageIndex = 0, pageLayout }: TemplateProps) {
	const defaultLayout = {
		fullWidth: false,
		main: ['summary', 'experience', 'education', 'projects'],
		sidebar: ['skills']
	};
	const resumeData = useResumeTemplateData();
	const storeLayout = resumeData.metadata.layout.pages[pageIndex];
	const themePrimary = resumeData.metadata.theme?.primary || '#1dff00';
	const layout = pageLayout || storeLayout || defaultLayout;

	const isFirstPage = pageIndex === 0;
	const { main, sidebar, fullWidth } = layout;

	const styles: React.CSSProperties = {
		'--page-primary-color': themePrimary,
		'--page-background-color': '#ffffff',
		'--page-sidebar-width': '30%',
		'--page-margin-x': '2.5rem',
		'--page-margin-y': '2.5rem',
		'--page-gap-y': '1.25rem',
	} as React.CSSProperties;

	return (
		<div style={styles} className="template-pikachu page-content px-[var(--page-margin-x)] pt-[var(--page-margin-y)] print:p-0 h-full bg-white text-gray-800">
			<div className="flex gap-x-[var(--page-margin-x)] h-full">
				{!fullWidth && (
					<aside
						data-layout="sidebar"
						className="group page-sidebar flex w-[var(--page-sidebar-width)] shrink-0 flex-col space-y-[var(--page-gap-y)]"
					>
						{isFirstPage && (
							<div className="flex max-w-[var(--page-sidebar-width)] items-center justify-start">
								<PagePicture className="w-full aspect-square rounded-[2rem] border-[4px] border-[color:var(--page-primary-color)]/22 bg-white p-1.5 shadow-[0_18px_32px_rgba(15,23,42,0.16)] object-cover" />
							</div>
						)}

						{!fullWidth && (
							<div className="shrink-0 space-y-[var(--page-gap-y)] overflow-x-hidden">
								{sidebar.map((section: string) => {
									const Component = getSectionComponent(section, { sectionClassName });
									return <Component key={section} id={section} />;
								})}
							</div>
						)}
					</aside>
				)}

				<main data-layout="main" className="group page-main flex-1 space-y-[var(--page-gap-y)]">
					{isFirstPage && (
						<div className="flex items-center gap-x-6">
							{fullWidth && <PagePicture className="w-24 h-24 rounded-[1.5rem] border-[3px] border-[color:var(--page-primary-color)]/20 bg-white p-1 shadow-lg" />}
							<Header />
						</div>
					)}

					<div className="space-y-[var(--page-gap-y)]">
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
		<div className="page-header w-full space-y-4 rounded-[2rem] bg-[color:var(--page-primary-color)] px-[var(--page-margin-x)] py-7 text-gray-900 shadow-[0_18px_32px_rgba(15,23,42,0.12)]">
			<div className="border-[var(--page-background-color)]/30 border-b pb-2">
				<h2 className="basics-name text-2xl font-extrabold tracking-tight">{basics.name}</h2>
				<p className="basics-headline text-sm font-medium opacity-80 mt-0.5">{basics.headline}</p>
			</div>

			<div
				className="basics-items flex flex-wrap gap-2 text-[0.72rem] font-semibold [&_svg]:text-gray-900 *:flex *:items-center *:gap-x-1.5 *:rounded-full *:border *:border-black/10 *:bg-white/30 *:px-3 *:py-1.5"
			>
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
	);
}
