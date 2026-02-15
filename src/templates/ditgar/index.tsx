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

	// Section Item Header in Sidebar Layout
	"group-data-[layout=sidebar]:[&_.section-item-header>div]:flex-col",
	"group-data-[layout=sidebar]:[&_.section-item-header>div]:items-start",

	// Decoration Line in Section Item Header
	"group-data-[layout=main]:[&_.section-item-header]:ps-2",
	"group-data-[layout=main]:[&_.section-item-header]:py-0.5",
	"group-data-[layout=main]:[&_.section-item-header]:-ms-2.5",
	"group-data-[layout=main]:[&_.section-item-header]:border-s-2",
	"group-data-[layout=main]:[&_.section-item-header]:border-[color:var(--page-primary-color)]",
);

/**
 * Template: Ditgar
 */
export function DitgarTemplate({ pageIndex = 0, pageLayout }: TemplateProps) {
	const defaultLayout = {
        fullWidth: false,
        main: ['summary', 'experience', 'education', 'projects'],
        sidebar: ['skills']
    };
    const storeLayout = useArtboardStore((state) => state.resume.data.metadata.layout.pages[pageIndex]);
    const layout = pageLayout || storeLayout || defaultLayout;

	const isFirstPage = pageIndex === 0;
	const { main, sidebar, fullWidth } = layout;

	const SummaryComponent = getSectionComponent("summary", {
		sectionClassName: cn(sectionClassName, "px-[var(--page-margin-x)] pt-[var(--page-margin-y)]"),
	});

    const styles: React.CSSProperties = {
        '--page-primary-color': '#7c4dff', // Deep Purple
        '--page-background-color': '#ffffff',
        '--page-sidebar-width': '35%',
        '--page-margin-x': '2.5rem',
        '--page-margin-y': '2.5rem',
    } as React.CSSProperties;

	return (
		<div style={styles} className="template-ditgar page-content relative h-full bg-white text-gray-800">
			{/* Sidebar Background */}
			{(!fullWidth || isFirstPage) && (
				<div className="page-sidebar-background pointer-events-none absolute inset-y-0 z-0 w-[var(--page-sidebar-width)] shrink-0 bg-[color:var(--page-primary-color)] opacity-20 left-0" />
			)}

			<div className="flex h-full">
				{(!fullWidth || isFirstPage) && (
					<aside data-layout="sidebar" className="sidebar group z-10 flex w-[var(--page-sidebar-width)] shrink-0 flex-col">
						{isFirstPage && <Header />}

						<div className="flex-1 space-y-4 px-[var(--page-margin-x)] pt-[var(--page-margin-y)]">
							{sidebar.map((section: string) => {
								const Component = getSectionComponent(section, { sectionClassName });
								return <Component key={section} id={section} />;
							})}
						</div>
					</aside>
				)}

				<main data-layout="main" className={cn("main group z-10 flex-1", !fullWidth ? "" : "")}>
					{isFirstPage && <SummaryComponent id="summary" />}

					<div className="space-y-4 px-[var(--page-margin-x)] pt-[var(--page-margin-y)]">
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
		<div className="page-header space-y-4 bg-[color:var(--page-primary-color)] px-[var(--page-margin-x)] py-[var(--page-margin-y)] text-[var(--page-background-color)]">
			<PagePicture />

			<div>
				<h2 className="font-bold text-2xl">{basics.name}</h2>
				<p>{basics.headline}</p>
			</div>

			<div className="flex flex-col items-start gap-y-2 text-sm [&>div>i]:text-[var(--page-background-color)]!">
				{basics.location && (
					<div className="flex items-center gap-x-1.5">
						<PageIcon name="MapPin" className="ph-bold" />
						<div>{basics.location}</div>
					</div>
				)}
				{basics.phone && (
					<div className="flex items-center gap-x-1.5">
						<PageIcon name="Phone" className="ph-bold" />
						<PageLink type="phone" value={basics.phone} />
					</div>
				)}
				{basics.email && (
					<div className="flex items-center gap-x-1.5">
						<PageIcon name="Envelope" className="ph-bold" />
						<PageLink type="email" value={basics.email} />
					</div>
				)}
				{basics.website && basics.website.url && (
					<div className="flex items-center gap-x-1.5">
						<PageIcon name="Globe" className="ph-bold" />
						<PageLink type="url" value={basics.website.url} label={basics.website.label} />
					</div>
				)}
			</div>
		</div>
	);
}
