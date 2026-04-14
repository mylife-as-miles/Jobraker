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
	"[&>h6]:border-[color:var(--page-primary-color)] [&>h6]:border-b-2 [&>h6]:pb-1.5",
);

/**
 * Template: Rhyhorn ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Horizontal Professional
 * A clean professional template with a horizontal header layout and pipe-separated contact details.
 */
export function RhyhornTemplate({ pageIndex = 0, pageLayout }: TemplateProps) {
	const defaultLayout = {
		fullWidth: false,
		main: ['summary', 'experience', 'education', 'projects'],
		sidebar: ['skills']
	};
	const resumeData = useResumeTemplateData();
	const storeLayout = resumeData.metadata.layout.pages[pageIndex];
	const themePrimary = resumeData.metadata.theme?.primary || '#475569';
	const layout = pageLayout || storeLayout || defaultLayout;

	const isFirstPage = pageIndex === 0;
	const { main, sidebar, fullWidth } = layout;

	const styles: React.CSSProperties = {
		'--page-primary-color': themePrimary,
		'--page-margin-x': '2.5rem',
		'--page-margin-y': '2.5rem',
		'--page-gap-y': '1.25rem',
		'--page-gap-x': '1.5rem',
	} as React.CSSProperties;

	return (
		<div style={styles} className="template-rhyhorn page-content space-y-[var(--page-gap-y)] px-[var(--page-margin-x)] pt-[var(--page-margin-y)] print:p-8 h-full bg-white text-gray-800">
			{isFirstPage && <Header />}

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
	);
}

function Header() {
	const basics = useResumeTemplateData().basics;

	return (
		<div className="page-header flex items-start gap-x-5 rounded-[2rem] border border-[color:var(--page-primary-color)]/15 bg-white/95 px-6 py-6 shadow-[0_16px_30px_rgba(15,23,42,0.06)]">
			<div className="page-basics grow space-y-2">
				<div>
					<h2 className="basics-name text-2xl font-extrabold tracking-tight text-gray-900">{basics.name}</h2>
					<p className="basics-headline text-sm text-[color:var(--page-primary-color)] font-medium mt-0.5">{basics.headline}</p>
				</div>

				<div className="basics-items flex flex-wrap gap-2 text-[0.72rem] text-gray-500 [&_svg]:text-[color:var(--page-primary-color)] *:flex *:items-center *:gap-x-1.5 *:rounded-full *:border *:border-[color:var(--page-primary-color)]/12 *:bg-[color:var(--page-primary-color)]/6 *:px-3 *:py-1.5 *:shadow-[0_6px_16px_rgba(15,23,42,0.05)]">
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

			<PagePicture className="w-28 h-28 rounded-[1.75rem] border-[4px] border-gray-200 bg-white p-1.5 shadow-[0_18px_30px_rgba(15,23,42,0.12)] shrink-0" />
		</div>
	);
}
