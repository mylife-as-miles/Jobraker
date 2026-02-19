import { cn } from "../../lib/utils";
import { getSectionComponent } from "../shared/get-section-component";
import { PageIcon } from "../shared/page-icon";
import { PageLink } from "../shared/page-link";
import { PagePicture } from "../shared/page-picture";
import { useArtboardStore } from "../../store/artboard";
import type { TemplateProps } from "../azurill/types";

const sectionClassName = cn(
	// Section Heading with bottom accent
	"[&>h6]:border-b [&>h6]:border-[color:var(--page-primary-color)]/30 [&>h6]:pb-1.5",

	// Section Item Header in Sidebar Layout
	"group-data-[layout=sidebar]:[&_.section-item-header>div]:flex-col",
	"group-data-[layout=sidebar]:[&_.section-item-header>div]:items-start",

	// Left border accent on section items in main layout
	"group-data-[layout=main]:[&_.group\\/item]:pl-3",
	"group-data-[layout=main]:[&_.group\\/item]:border-l-2",
	"group-data-[layout=main]:[&_.group\\/item]:border-[color:var(--page-primary-color)]/20",
);

/**
 * Template: Ditgar — Accent Left Sidebar
 * A polished template with a violet left sidebar and bordered section items.
 */
export function DitgarTemplate({ pageIndex = 0, pageLayout, metadataOverride }: TemplateProps) {
	const defaultLayout = {
		fullWidth: false,
		main: ['summary', 'experience', 'education', 'projects'],
		sidebar: ['skills']
	};
	const storeLayout = useArtboardStore((state) => state.resume.data.metadata.layout.pages[pageIndex]);
	const storeMetadata = useArtboardStore((state) => state.resume.data.metadata);

	const metadata = metadataOverride || storeMetadata;
	const themePrimary = metadata.theme?.primary || '#7c3aed';
	const typography = metadata.typography.font;

	const layout = pageLayout || storeLayout || defaultLayout;

	const isFirstPage = pageIndex === 0;
	const { main, sidebar, fullWidth } = layout;

	const SummaryComponent = getSectionComponent("summary", {
		sectionClassName: cn(sectionClassName, "px-[var(--page-margin-x)] py-5 bg-[color:var(--page-primary-color)]/5 [&>h6]:hidden"),
	});

	const styles: React.CSSProperties = {
		'--page-primary-color': themePrimary,
		'--page-background-color': '#ffffff',
		'--page-sidebar-width': '34%',
		'--page-margin-x': '2.5rem',
		'--page-margin-y': '2.5rem',
		fontFamily: typography.family,
	} as React.CSSProperties;

	return (
		<div style={styles} className="template-ditgar page-content relative h-full bg-white text-gray-800">
			{/* Sidebar Background */}
			{(!fullWidth || isFirstPage) && (
				<div className="page-sidebar-background pointer-events-none absolute inset-y-0 z-0 w-[var(--page-sidebar-width)] shrink-0 bg-[color:var(--page-primary-color)]/8 left-0" />
			)}

			<div className="flex h-full">
				{(!fullWidth || isFirstPage) && (
					<aside data-layout="sidebar" className="sidebar group z-10 flex w-[var(--page-sidebar-width)] shrink-0 flex-col">
						{isFirstPage && <Header />}

						<div className="flex-1 space-y-5 px-[var(--page-margin-x)] pt-5">
							{sidebar.map((section: string) => {
								const Component = getSectionComponent(section, { sectionClassName });
								return <Component key={section} id={section} />;
							})}
						</div>
					</aside>
				)}

				<main data-layout="main" className="main group z-10 flex-1">
					{isFirstPage && <SummaryComponent id="summary" />}

					<div className="space-y-5 px-[var(--page-margin-x)] pt-5">
						{main
							.filter((section: string) => section !== "summary")
							.map((section: string) => {
								const Component = getSectionComponent(section, { sectionClassName });
								return <Component key={section} id={section} />;
							})}
					</div>
				</main>
			</div>
		</div>
	);
}

function Header() {
	const basics = useArtboardStore((state) => state.resume.data.basics);

	return (
		<div className="page-header space-y-4 bg-[color:var(--page-primary-color)] px-[var(--page-margin-x)] py-[var(--page-margin-y)] text-white">
			<PagePicture className="w-20 h-20 rounded-full border-2 border-white/30 shadow-lg" />

			<div>
				<h2 className="font-extrabold text-xl tracking-tight">{basics.name}</h2>
				<p className="text-sm opacity-80 mt-0.5">{basics.headline}</p>
			</div>

			<div className="flex flex-col items-start gap-y-1.5 text-[0.7rem] text-white/80">
				{basics.location && (
					<div className="flex items-center gap-x-1.5">
						<PageIcon name="MapPin" />
						<div>{basics.location}</div>
					</div>
				)}
				{basics.phone && (
					<div className="flex items-center gap-x-1.5">
						<PageIcon name="Phone" />
						<PageLink type="phone" value={basics.phone} />
					</div>
				)}
				{basics.email && (
					<div className="flex items-center gap-x-1.5">
						<PageIcon name="Envelope" />
						<PageLink type="email" value={basics.email} />
					</div>
				)}
				{basics.website && basics.website.url && (
					<div className="flex items-center gap-x-1.5">
						<PageIcon name="Globe" />
						<PageLink type="url" value={basics.website.url} label={basics.website.label} />
					</div>
				)}
			</div>
		</div>
	);
}
