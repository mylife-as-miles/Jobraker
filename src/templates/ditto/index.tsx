import { Envelope, Globe, MapPin, Phone } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { getSectionComponent } from "../shared/get-section-component";
import { PageIcon } from "../shared/page-icon";
import { PageLink } from "../shared/page-link";
import { PagePicture } from "../shared/page-picture";
import { useArtboardStore } from "../../store/artboard";
import type { TemplateProps } from "../azurill/types";

const sectionClassName = cn(
	// Section Item Header in Sidebar Layout
	"group-data-[layout=sidebar]:[&_.section-item-header>div]:flex-col",
	"group-data-[layout=sidebar]:[&_.section-item-header>div]:items-start",
);

/**
 * Template: Ditto — Overlapping Portrait
 * A striking template with a rose-colored banner and an overlapping profile picture.
 */
export function DittoTemplate({ pageIndex = 0, pageLayout }: TemplateProps) {
	const defaultLayout = {
		fullWidth: false,
		main: ['summary', 'experience', 'education', 'projects'],
		sidebar: ['skills']
	};
	const storeLayout = useArtboardStore((state) => state.resume.data.metadata.layout.pages[pageIndex]);
	const themePrimary = useArtboardStore((state) => state.resume.data.metadata.theme?.primary) || '#e11d48';
	const layout = pageLayout || storeLayout || defaultLayout;

	const isFirstPage = pageIndex === 0;
	const { main, sidebar, fullWidth } = layout;

	const styles: React.CSSProperties = {
		'--page-primary-color': themePrimary,
		'--page-background-color': '#ffffff',
		'--page-sidebar-width': '170px',
		'--page-margin-x': '2.5rem',
		'--page-margin-y': '2rem',
	} as React.CSSProperties;

	return (
		<div style={styles} className="template-ditto page-content relative h-full bg-white text-gray-800">
			{isFirstPage && <Header />}

			<div className="flex pt-5">
				{!fullWidth && (
					<aside
						data-layout="sidebar"
						className="group page-sidebar w-[var(--page-sidebar-width)] shrink-0 space-y-5 overflow-x-hidden ps-[var(--page-margin-x)]"
					>
						{sidebar.map((section: string) => {
							const Component = getSectionComponent(section, { sectionClassName });
							return <Component key={section} id={section} />;
						})}
					</aside>
				)}

				<main data-layout="main" className="group page-main flex-1 space-y-5 px-[var(--page-margin-x)]">
					{main.map((section: string) => {
						const Component = getSectionComponent(section, { sectionClassName });
						return <Component key={section} id={section} />;
					})}
				</main>
			</div>
		</div>
	);
}

function Header() {
	const basics = useArtboardStore((state) => state.resume.data.basics);

	return (
		<div className="page-header relative">
			<div className="page-basics bg-[color:var(--page-primary-color)] text-white">
				<div className="basics-header flex items-center">
					<div className="flex w-[var(--page-sidebar-width)] shrink-0 justify-center ps-[var(--page-margin-x)] relative">
						<div className="absolute top-6 left-[var(--page-margin-x)] z-10">
							<PagePicture className="w-32 h-32 rounded-full border-4 border-white shadow-xl object-cover bg-white p-1" />
						</div>
					</div>

					<div className="px-[var(--page-margin-x)] py-6 pl-8 min-h-[120px] flex flex-col justify-center">
						<h2 className="basics-name text-2xl font-extrabold tracking-tight">{basics.name}</h2>
						<p className="basics-headline text-sm opacity-80 mt-0.5">{basics.headline}</p>
					</div>
				</div>
			</div>

			<div className="flex items-start mt-6">
				<div className="w-[var(--page-sidebar-width)] shrink-0" />

				<div className="basics-items flex flex-wrap gap-x-4 gap-y-1.5 px-[var(--page-margin-x)] text-[0.7rem] text-gray-500 *:flex *:items-center *:gap-x-1.5">
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
