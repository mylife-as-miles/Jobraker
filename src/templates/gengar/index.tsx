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
);

/**
 * Template: Gengar
 */
export function GengarTemplate({ pageIndex = 0, pageLayout }: TemplateProps) {
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
        '--page-primary-color': '#512da8', // Deep Purple (Gengar)
        '--page-background-color': '#ffffff',
        '--page-sidebar-width': '30%',
        '--page-margin-x': '2rem',
        '--page-margin-y': '2rem',
    } as React.CSSProperties;

    // Use getSectionComponent to get the Summary implementation
    const PageSummary = getSectionComponent("summary", {
        sectionClassName: cn(
            sectionClassName,
            "bg-[color:var(--page-primary-color)] bg-opacity-20 px-[var(--page-margin-x)] py-[var(--page-margin-y)] [&>h6]:hidden"
        ),
    });

	return (
		<div style={styles} className="template-gengar page-content relative h-full bg-white text-gray-800">
			{/* Sidebar Background */}
			{(!fullWidth || isFirstPage) && (
				<div className="page-sidebar-background pointer-events-none absolute inset-y-0 z-0 w-[var(--page-sidebar-width)] shrink-0 bg-[color:var(--page-primary-color)] opacity-20 left-0" />
			)}

			<div className="flex h-full">
				{(!fullWidth || isFirstPage) && (
					<aside
						data-layout="sidebar"
						className="group page-sidebar z-10 flex w-[var(--page-sidebar-width)] shrink-0 flex-col"
					>
						{isFirstPage && <Header />}

						{!fullWidth && (
							<div className="shrink-0 space-y-4 overflow-x-hidden px-[var(--page-margin-x)] pt-[var(--page-margin-y)]">
								{sidebar
									.filter((section: string) => section !== "summary")
									.map((section: string) => {
										const Component = getSectionComponent(section, { sectionClassName });
										return <Component key={section} id={section} />;
									})}
							</div>
						)}
					</aside>
				)}

				<main data-layout="main" className="group page-main z-10 flex-1">
					{isFirstPage && (
                        <PageSummary id="summary" />
					)}

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
		<div className="page-header relative flex">
			<div className="flex w-full shrink-0 flex-col justify-center gap-y-2 bg-[color:var(--page-primary-color)] px-[var(--page-margin-x)] py-[var(--page-margin-y)] text-[var(--page-background-color)]">
				<PagePicture />

				<div>
					<h2 className="basics-name text-2xl font-bold">{basics.name}</h2>
					<p className="basics-headline text-lg opacity-90">{basics.headline}</p>
				</div>

				<div
					className="basics-items flex flex-col gap-y-1 *:flex *:items-center *:gap-x-1.5 text-sm"
					style={{ "--page-primary-color": "var(--page-background-color)" } as React.CSSProperties}
				>
					{basics.email && (
						<div className="basics-item-email">
							<PageIcon name="Envelope" />
							<PageLink type="email" value={basics.email} />
						</div>
					)}

					{basics.phone && (
						<div className="basics-item-phone">
							<PageIcon name="Phone" />
							<PageLink type="phone" value={basics.phone} />
						</div>
					)}

					{basics.location && (
						<div className="basics-item-location">
							<PageIcon name="MapPin" />
							<span>{basics.location}</span>
						</div>
					)}

					{basics.website && basics.website.url && (
						<div className="basics-item-website">
							<PageIcon name="Globe" />
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
