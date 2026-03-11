import { Envelope, Globe, MapPin, Phone } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { getSectionComponent } from "../shared/get-section-component";
import { PageIcon } from "../shared/page-icon";
import { PageLink } from "../shared/page-link";
import { PagePicture } from "../shared/page-picture";
import { useArtboardStore } from "../../store/artboard";
import type { TemplateProps } from "../azurill/types";

const sectionClassName = cn(
	// Section Heading — centered with accent underline
	"[&>h6]:border-[color:var(--page-primary-color)] [&>h6]:border-b-2 [&>h6]:pb-1.5 [&>h6]:text-center [&>h6]:mx-auto [&>h6]:max-w-fit [&>h6]:px-4",
);

/**
 * Template: Kakuna — Centered Elegance
 * A refined centered template with an amber accent and symmetrical headings.
 */
export function KakunaTemplate({ pageIndex = 0, pageLayout }: TemplateProps) {
	const defaultLayout = {
		fullWidth: false,
		main: ['summary', 'experience', 'education', 'projects'],
		sidebar: ['skills']
	};
	const storeLayout = useArtboardStore((state) => state.resume.data.metadata.layout.pages[pageIndex]);
	const themePrimary = useArtboardStore((state) => state.resume.data.metadata.theme?.primary) || '#d97706';
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
		<div style={styles} className="template-kakuna page-content space-y-[var(--page-gap-y)] px-[var(--page-margin-x)] pt-[var(--page-margin-y)] print:p-8 h-full bg-white text-gray-800">
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
		<div className="page-header flex flex-col items-center gap-y-3 pb-5 border-b-2 border-[color:var(--page-primary-color)]/20">
			<PagePicture className="w-28 h-28 rounded-full border-[3px] border-[color:var(--page-primary-color)]/25 bg-white p-1 shadow-lg" />

			<div className="page-basics space-y-2.5 text-center">
				<div>
					<h2 className="basics-name text-2xl font-extrabold tracking-tight text-gray-900">{basics.name}</h2>
					<p className="basics-headline text-sm text-[color:var(--page-primary-color)] font-medium mt-0.5">{basics.headline}</p>
				</div>

				<div className="basics-items flex flex-wrap justify-center gap-x-4 gap-y-1 text-[0.7rem] text-gray-500 *:flex *:items-center *:gap-x-1.5">
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
