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
	"[&>h6]:border-b [&>h6]:border-[color:var(--page-primary-color)]/30 [&>h6]:pb-1.5",

	// Light headings in sidebar
	"group-data-[layout=sidebar]:[&>h6]:text-foreground/90",
	"group-data-[layout=sidebar]:[&>h6]:border-foreground/20",

	// Section Item Header in Sidebar Layout
	"group-data-[layout=sidebar]:[&_.section-item-header>div]:flex-col",
	"group-data-[layout=sidebar]:[&_.section-item-header>div]:items-start",
);

/**
 * Template: Chikorita — Right Sidebar Accent
 * A modern template with main content on the left and a teal-colored right sidebar.
 */
export function ChikoritaTemplate({ pageIndex = 0, pageLayout }: TemplateProps) {
	const defaultLayout = {
		fullWidth: false,
		main: ['summary', 'experience', 'education', 'projects'],
		sidebar: ['skills']
	};
	const storeLayout = useArtboardStore((state) => state.resume.data.metadata.layout.pages[pageIndex]);
	const themePrimary = useArtboardStore((state) => state.resume.data.metadata.theme?.primary) || '#0d9488';
	const layout = pageLayout || storeLayout || defaultLayout;

	const isFirstPage = pageIndex === 0;
	const { main, sidebar, fullWidth } = layout;

	const styles: React.CSSProperties = {
		'--page-primary-color': themePrimary,
		'--page-background-color': '#ffffff',
		'--page-sidebar-width': '30%',
		'--page-margin-x': '2.5rem',
		'--page-margin-y': '2.5rem',
	} as React.CSSProperties;

	return (
		<div style={styles} className="template-chikorita page-content relative h-full bg-white text-gray-800">
			{/* Sidebar Background */}
			{!fullWidth && (
				<div className="page-sidebar-background pointer-events-none absolute inset-y-0 z-0 w-[var(--page-sidebar-width)] shrink-0 bg-[var(--page-primary-color)] right-0" />
			)}

			<div className="flex h-full">
				<main
					data-layout="main"
					className="group page-main z-10 flex-1 space-y-5 px-[var(--page-margin-x)] pt-[var(--page-margin-y)]"
				>
					{isFirstPage && <Header />}

					{main.map((section: string) => {
						const Component = getSectionComponent(section, { sectionClassName });
						return <Component key={section} id={section} />;
					})}
				</main>

				{!fullWidth && (
					<aside
						data-layout="sidebar"
						className="group page-sidebar z-10 w-[var(--page-sidebar-width)] shrink-0 space-y-5 overflow-x-hidden px-6 pt-[var(--page-margin-y)] text-white"
					>
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
		<div className="page-header relative flex mb-5 pb-5 border-b border-gray-100">
			<div className="flex flex-1 items-start gap-x-5">
				<PagePicture className="w-24 h-24 rounded-2xl border-[3px] border-[var(--page-primary-color)]/30 bg-white p-1 shadow-lg shrink-0" />

				<div className="page-basics space-y-2 min-w-0">
					<div>
						<h2 className="basics-name text-2xl font-extrabold tracking-tight text-gray-900">{basics.name}</h2>
						<p className="basics-headline text-sm text-[var(--page-primary-color)] font-semibold mt-0.5">{basics.headline}</p>
					</div>

					<div className="basics-items flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] text-gray-500 *:flex *:items-center *:gap-x-1.5">
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
		</div>
	);
}
