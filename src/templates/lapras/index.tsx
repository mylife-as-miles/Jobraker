import { Envelope, Globe, MapPin, Phone } from "@phosphor-icons/react";
import { useMemo } from "react";
import { cn } from "../../lib/utils";
import { getSectionComponent } from "../shared/get-section-component";
import { PageIcon } from "../shared/page-icon";
import { PageLink } from "../shared/page-link";
import { PagePicture } from "../shared/page-picture";
import { useArtboardStore } from "../../store/artboard";
import type { TemplateProps } from "../azurill/types";

const sectionClassName = cn(
	// Card container
	"rounded-lg border border-gray-100 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",

	// Section Heading — floating above card border
	"[&>h6]:-mt-7 [&>h6]:max-w-fit [&>h6]:bg-white [&>h6]:px-3 [&>h6]:text-[color:var(--page-primary-color)]",

	// First section gets extra top margin
	"group-data-[layout=main]:first-of-type:mt-4",
);

/**
 * Template: Lapras — Card-Based Layout
 * A modern card-based template with floating section headers and subtle shadows.
 */
export function LaprasTemplate({ pageIndex = 0, pageLayout, metadataOverride }: TemplateProps) {
	const defaultLayout = {
		fullWidth: false,
		main: ['summary', 'experience', 'education', 'projects'],
		sidebar: ['skills']
	};
	const storeLayout = useArtboardStore((state) => state.resume.data.metadata.layout.pages[pageIndex]);
	const storeMetadata = useArtboardStore((state) => state.resume.data.metadata);

	const metadata = metadataOverride || storeMetadata;
	const layout = pageLayout || storeLayout || defaultLayout;

	const isFirstPage = pageIndex === 0;
	const { main, sidebar, fullWidth } = layout;

	const containerBorderRadius = useArtboardStore((state) => Math.min(state.resume.data.basics.picture?.borderRadius || 0, 30));
	const headingNegativeMargin = useArtboardStore((state) => (metadata.typography.font.size || 16) + 6);
	const themePrimary = metadata.theme?.primary || '#0369a1';
	const typography = metadata.typography.font;

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
			fontFamily: typography.family,
		} as React.CSSProperties;
	}, [containerBorderRadius, headingNegativeMargin, themePrimary, typography.family]);

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
	const basics = useArtboardStore((state) => state.resume.data.basics);

	return (
		<div
			className={cn(
				"page-header flex items-start gap-x-5 mb-2",
				"rounded-lg border border-gray-100 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
			)}
		>
			<PagePicture className="w-20 h-20 rounded-lg border border-gray-100 shadow-sm shrink-0" />

			<div className="page-basics space-y-2 min-w-0">
				<div>
					<h2 className="basics-name text-2xl font-extrabold tracking-tight text-gray-900">{basics.name}</h2>
					<p className="basics-headline text-sm text-[color:var(--page-primary-color)] font-medium mt-0.5">{basics.headline}</p>
				</div>

				<div className="basics-items flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem] text-gray-500 *:flex *:items-center *:gap-x-1.5 *:border-r *:border-gray-200 *:pr-3 *:last:border-r-0 *:last:pr-0">
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
