import { Envelope, Globe, MapPin, Phone } from "@phosphor-icons/react";
import { useMemo } from "react";
import { cn } from "../../lib/utils";
import { getSectionComponent } from "../shared/get-section-component";
import { PageIcon } from "../shared/page-icon";
import { PageLink } from "../shared/page-link";
import { PagePicture } from "../shared/page-picture";
import type { TemplateProps } from "../azurill/types";
import { useResumeTemplateData } from "../use-resume-template-data";

const sectionClassName = cn(
	// Card container
	"rounded-lg border border-gray-100 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",

	// Section Heading ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â floating above card border
	"[&>h6]:-mt-7 [&>h6]:max-w-fit [&>h6]:bg-white [&>h6]:px-3 [&>h6]:text-[color:var(--page-primary-color)]",

	// First section gets extra top margin
	"group-data-[layout=main]:first-of-type:mt-4",
);

/**
 * Template: Lapras ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Card-Based Layout
 * A modern card-based template with floating section headers and subtle shadows.
 */
export function LaprasTemplate({ pageIndex = 0, pageLayout }: TemplateProps) {
	const defaultLayout = {
		fullWidth: false,
		main: ['summary', 'experience', 'education', 'projects'],
		sidebar: ['skills']
	};
	const resumeData = useResumeTemplateData();
	const storeLayout = resumeData.metadata.layout.pages[pageIndex];
	const layout = pageLayout || storeLayout || defaultLayout;

	const isFirstPage = pageIndex === 0;
	const { main, sidebar, fullWidth } = layout;

	const containerBorderRadius = Math.min(
		resumeData.basics.picture?.borderRadius || 0,
		30,
	);
	const headingNegativeMargin =
		(resumeData.metadata.typography.font.size || 16) + 6;
	const themePrimary = resumeData.metadata.theme?.primary || '#2dd4bf';

	const style = useMemo(() => {
		return {
			'--page-primary-color': themePrimary,
			'--page-text-color': '#111827',
			'--page-background-color': '#f8fafc',
			'--page-margin-x': '2rem',
			'--page-margin-y': '2rem',
			'--page-gap-y': '1.5rem',
			'--picture-border-radius': `${containerBorderRadius}px`,
			"--container-border-radius": `${containerBorderRadius}px`,
			"--heading-negative-margin": `${headingNegativeMargin}px`,
		} as React.CSSProperties;
	}, [containerBorderRadius, headingNegativeMargin, themePrimary]);

	return (
		<div
			style={style}
			className="template-lapras page-content space-y-5 px-[var(--page-margin-x)] pt-[var(--page-margin-y)] print:p-8 h-full bg-[color:var(--page-background-color)] text-gray-800"
		>
			{isFirstPage && <Header />}

			<div className="flex gap-5 h-full">
				<main data-layout="main" className="group page-main flex-1 space-y-5">
					{main.map((section: string) => {
						const Component = getSectionComponent(section, { sectionClassName });
						return <Component key={section} id={section} />;
					})}
				</main>

				{!fullWidth && (
					<aside data-layout="sidebar" className="group page-sidebar w-[28%] shrink-0 space-y-5">
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
		<div
			className={cn(
				"page-header flex items-start gap-x-5 mb-2",
				"rounded-[2rem] border border-gray-100/80 bg-white/95 p-6 shadow-[0_18px_32px_rgba(15,23,42,0.08)]",
			)}
		>
			<PagePicture className="w-28 h-28 rounded-[1.75rem] border-[4px] border-[color:var(--page-primary-color)]/18 bg-white p-1.5 shadow-[0_18px_30px_rgba(15,23,42,0.12)] shrink-0" />

			<div className="page-basics space-y-2 min-w-0">
				<div>
					<h2 className="basics-name text-2xl font-extrabold tracking-tight text-gray-900">{basics.name}</h2>
					<p className="basics-headline text-sm text-[color:var(--page-primary-color)] font-medium mt-0.5">{basics.headline}</p>
				</div>

				<div className="basics-items flex flex-wrap gap-2 text-[0.72rem] text-gray-500 [&_svg]:text-[color:var(--page-primary-color)] *:flex *:items-center *:gap-x-1.5 *:rounded-full *:border *:border-gray-200/80 *:bg-slate-50/90 *:px-3 *:py-1.5 *:shadow-[0_6px_16px_rgba(15,23,42,0.05)]">
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
