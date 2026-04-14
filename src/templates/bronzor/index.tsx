import { Envelope, Globe, MapPin, Phone } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { getSectionComponent } from "../shared/get-section-component";
import { PageIcon } from "../shared/page-icon";
import { PageLink } from "../shared/page-link";
import { PagePicture } from "../shared/page-picture";
import type { TemplateProps } from "../azurill/types";
import { useResumeTemplateData } from "../use-resume-template-data";

const sectionClassName = cn(
	// Grid layout: heading on left column, content on right
	"grid grid-cols-[120px_1fr] gap-x-4",
	"[&>h6]:text-right [&>h6]:pt-0.5",
	"[&>h6]:border-r-2 [&>h6]:border-gray-900 [&>h6]:pr-4",
);

/**
 * Template: Bronzor ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Structured Grid
 * A professional grid-based template with section headings aligned to a left column.
 */
export function BronzorTemplate({ pageIndex = 0, pageLayout }: TemplateProps) {
	const defaultLayout = {
		fullWidth: false,
		main: ['summary', 'experience', 'education', 'projects'],
		sidebar: ['skills']
	};

	const resumeData = useResumeTemplateData();
	const storeLayout = resumeData.metadata.layout.pages[pageIndex];
	const themePrimary = resumeData.metadata.theme?.primary || '#111827';
	const layout = pageLayout || storeLayout || defaultLayout;

	const isFirstPage = pageIndex === 0;
	const { main, sidebar, fullWidth } = layout;

	const styles: React.CSSProperties = {
		'--page-primary-color': themePrimary,
		'--page-gap-y': '1.25rem',
		'--page-margin-x': '2.5rem',
		'--page-margin-y': '2.5rem',
	} as React.CSSProperties;

	return (
		<div style={styles} className="template-bronzor page-content space-y-[var(--page-gap-y)] px-[var(--page-margin-x)] pt-[var(--page-margin-y)] print:p-8 h-full bg-white text-gray-800">
			{isFirstPage && <Header />}

			<div className="space-y-[var(--page-gap-y)]">
				<main data-layout="main" className="group page-main space-y-[var(--page-gap-y)]">
					{main.map((section: string) => {
						const Component = getSectionComponent(section, { sectionClassName });
						return <Component key={section} id={section} />;
					})}
				</main>

				{!fullWidth && (
					<aside data-layout="sidebar" className="group page-sidebar space-y-[var(--page-gap-y)]">
						{sidebar.map((section: string) => {
							const Component = getSectionComponent(section, { sectionClassName });
							return <Component key={section} id={section} />;
						})}
					</aside>
				)}
			</div>
		</div>
	);
}

function Header() {
	const basics = useResumeTemplateData().basics;

	return (
		<div className="page-header flex flex-col items-center gap-y-4 rounded-[2rem] border border-gray-200/80 bg-slate-50/80 px-8 py-7 shadow-[0_16px_30px_rgba(15,23,42,0.06)]">
			<PagePicture className="w-28 h-28 rounded-full border-[4px] border-gray-200 bg-white p-1.5 shadow-[0_18px_28px_rgba(15,23,42,0.12)]" />

			<div className="page-basics space-y-2.5 text-center">
				<div className="basics-header">
					<h2 className="basics-name text-2xl font-extrabold uppercase tracking-wide">{basics.name}</h2>
					<p className="basics-headline text-sm text-gray-500 font-medium mt-0.5">{basics.headline}</p>
				</div>

				<div className="basics-items flex flex-wrap justify-center gap-2 text-[0.72rem] text-gray-500 [&_svg]:text-[color:var(--page-primary-color)] *:flex *:items-center *:gap-x-1.5 *:rounded-full *:border *:border-gray-200/80 *:bg-white/90 *:px-3 *:py-1.5 *:shadow-[0_6px_16px_rgba(15,23,42,0.05)]">
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
