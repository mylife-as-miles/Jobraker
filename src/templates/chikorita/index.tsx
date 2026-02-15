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
	"[&>h6]:border-b [&>h6]:border-[color:var(--page-primary-color)]",

	// Section Heading in Sidebar Layout
	"group-data-[layout=sidebar]:[&>h6]:text-[var(--page-background-color)]",
	"group-data-[layout=sidebar]:[&>h6]:border-[var(--page-background-color)]",

	// Icon Colors in Sidebar Layout
	"group-data-[layout=sidebar]:[&_.section-item_i]:text-[var(--page-background-color)]!",

	// Level Display in Sidebar Layout
	"group-data-[layout=sidebar]:[&_.section-item-level>div]:border-[var(--page-background-color)]",
	"group-data-[layout=sidebar]:[&_.section-item-level>div]:data-[active=true]:bg-[var(--page-background-color)]",

	// Section Item Header in Sidebar Layout
	"group-data-[layout=sidebar]:[&_.section-item-header>div]:flex-col",
	"group-data-[layout=sidebar]:[&_.section-item-header>div]:items-start",
);

/**
 * Template: Chikorita
 */
export function ChikoritaTemplate({ pageIndex = 0, pageLayout }: TemplateProps) {
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
        '--page-primary-color': '#26a69a', // Teal/Greenish like Chikorita
        '--page-background-color': '#ffffff',
        '--page-sidebar-width': '30%',
        '--page-margin-x': '3rem',
        '--page-margin-y': '3rem',
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
					className="group page-main z-10 flex-1 space-y-4 px-[var(--page-margin-x)] pt-[var(--page-margin-y)]"
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
						className="group page-sidebar z-10 w-[var(--page-sidebar-width)] shrink-0 space-y-4 overflow-x-hidden px-8 pt-[var(--page-margin-y)] text-white"
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
		<div className="page-header relative flex mb-6">
			<div className="flex flex-1 items-center gap-x-6">
				<PagePicture />

				<div className="page-basics space-y-2">
					<div>
						<h2 className="basics-name text-3xl font-bold">{basics.name}</h2>
						<p className="basics-headline text-lg text-[var(--page-primary-color)] font-medium">{basics.headline}</p>
					</div>

					<div className="basics-items flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 *:flex *:items-center *:gap-x-1.5">
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
