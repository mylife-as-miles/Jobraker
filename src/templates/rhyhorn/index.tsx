import { Envelope, Globe, MapPin, Phone } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { getSectionComponent } from "../shared/get-section-component";
import { PageIcon } from "../shared/page-icon";
import { PageLink } from "../shared/page-link";
import { PagePicture } from "../shared/page-picture";
import { useArtboardStore } from "../../store/artboard";
import type { TemplateProps } from "../azurill/types";

const sectionClassName = cn(
	// Section Heading
	"[&>h6]:border-[color:var(--page-primary-color)] [&>h6]:border-b",
);

/**
 * Template: Rhyhorn
 */
export function RhyhornTemplate({ pageIndex = 0, pageLayout }: TemplateProps) {
	const defaultLayout = {
        fullWidth: false,
        main: ['summary', 'experience', 'education', 'projects'],
        sidebar: ['skills']
    };
    const storeLayout = useArtboardStore((state) => state.resume.data.metadata.layout.pages[pageIndex]);
    const layout = pageLayout || storeLayout || defaultLayout;

	const isFirstPage = pageIndex === 0;
	const { main, sidebar, fullWidth } = layout;

    const styles: React.CSSProperties = {
        '--page-primary-color': '#78909c', // Blue Grey (Rhyhorn)
        '--page-margin-x': '3rem',
        '--page-margin-y': '3rem',
        '--page-gap-y': '1.5rem',
        '--page-gap-x': '1.5rem',
    } as React.CSSProperties;

	return (
		<div style={styles} className="template-rhyhorn page-content space-y-[var(--page-gap-y)] px-[var(--page-margin-x)] pt-[var(--page-margin-y)] print:p-0 h-full bg-white text-gray-800">
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
	const basics = useArtboardStore((state) => state.resume.data.basics);

	return (
		<div className="page-header flex items-center gap-x-[var(--page-gap-x)]">
			<div className="page-basics grow space-y-[var(--page-gap-y)]">
				<div>
					<h2 className="basics-name text-3xl font-bold">{basics.name}</h2>
					<p className="basics-headline text-lg text-gray-600">{basics.headline}</p>
				</div>

				<div className="basics-items flex flex-wrap gap-x-2 gap-y-0.5 text-sm text-gray-600 *:flex *:items-center *:gap-x-1.5 *:border-[color:var(--page-primary-color)] *:border-r *:pr-2 *:last:border-r-0">
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

			<PagePicture />
		</div>
	);
}
