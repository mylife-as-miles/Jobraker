import { Envelope, Globe, MapPin, Phone } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { getSectionComponent } from "../shared/get-section-component";
import { PageIcon } from "../shared/page-icon";
import { PageLink } from "../shared/page-link";
import { PagePicture } from "../shared/page-picture";
import { useArtboardStore } from "../../store/artboard";
import type { TemplateProps } from "../azurill/types";

const sectionClassName = cn(
	// Section Layout
	"grid grid-cols-5 border-t border-[color:var(--page-primary-color)] pt-1",

	// Section Content
	"[&>.section-content]:col-span-4",
);

/**
 * Template: Bronzor
 */
export function BronzorTemplate({ pageIndex = 0, pageLayout }: TemplateProps) {
	// Fallback if pageLayout is missing (e.g. initial render)
    const defaultLayout = {
        fullWidth: false,
        main: ['summary', 'experience', 'education', 'projects'],
        sidebar: ['skills']
    };

    // If not provided prop, grab from store or use default
    const storeLayout = useArtboardStore((state) => state.resume.data.metadata.layout.pages[pageIndex]);
    const layout = pageLayout || storeLayout || defaultLayout;

	const isFirstPage = pageIndex === 0;
	const { main, sidebar, fullWidth } = layout;

    const styles: React.CSSProperties = {
        '--page-primary-color': '#000000',
        '--page-gap-y': '1rem',
        '--page-margin-x': '3rem',
        '--page-margin-y': '3rem',
    } as React.CSSProperties;

	return (
		<div style={styles} className="template-bronzor page-content space-y-[var(--page-gap-y)] px-[var(--page-margin-x)] pt-[var(--page-margin-y)] print:p-0 h-full bg-white text-gray-800">
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
	const basics = useArtboardStore((state) => state.resume.data.basics);

	return (
		<div className="page-header flex flex-col items-center gap-y-2">
			<PagePicture />

			<div className="page-basics space-y-2 text-center">
				<div className="basics-header">
					<h2 className="basics-name text-2xl font-bold">{basics.name}</h2>
					<p className="basics-headline text-lg text-gray-600">{basics.headline}</p>
				</div>

				<div className="basics-items flex flex-wrap justify-center gap-x-3 gap-y-1 text-center *:flex *:items-center *:gap-x-1.5 text-sm text-gray-600">
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
