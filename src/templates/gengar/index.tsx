import { cn } from "../../lib/utils";
import { getSectionComponent } from "../shared/get-section-component";
import { PageIcon } from "../shared/page-icon";
import { PageLink } from "../shared/page-link";
import { PagePicture } from "../shared/page-picture";
import type { TemplateProps } from "../azurill/types";
import { useResumeTemplateData } from "../use-resume-template-data";

const sectionClassName = cn(
	// Section Heading with bottom accent
	"[&>h6]:border-b [&>h6]:border-[color:var(--page-primary-color)]/30 [&>h6]:pb-1.5",

	// Sidebar section headings in light color
	"group-data-[layout=sidebar]:[&>h6]:text-foreground/90",
	"group-data-[layout=sidebar]:[&>h6]:border-foreground/20",

	// Section Item Header in Sidebar Layout
	"group-data-[layout=sidebar]:[&_.section-item-header>div]:flex-col",
	"group-data-[layout=sidebar]:[&_.section-item-header>div]:items-start",
);

/**
 * Template: Gengar Ã¢â‚¬â€ Dark Sidebar
 * A dramatic template with a deep purple sidebar and white-on-dark header.
 */
export function GengarTemplate({ pageIndex = 0, pageLayout }: TemplateProps) {
	const defaultLayout = {
		fullWidth: false,
		main: ['summary', 'experience', 'education', 'projects'],
		sidebar: ['skills']
	};
	const resumeData = useResumeTemplateData();
	const storeLayout = resumeData.metadata.layout.pages[pageIndex];
	const themePrimary = resumeData.metadata.theme?.primary || '#7c3aed';
	const layout = pageLayout || storeLayout || defaultLayout;

	const isFirstPage = pageIndex === 0;
	const { main, sidebar, fullWidth } = layout;

	const styles: React.CSSProperties = {
		'--page-primary-color': themePrimary,
		'--page-background-color': '#ffffff',
		'--page-sidebar-width': '32%',
		'--page-margin-x': '2rem',
		'--page-margin-y': '2rem',
	} as React.CSSProperties;

	const PageSummary = getSectionComponent("summary", {
		sectionClassName: cn(
			sectionClassName,
			"bg-[color:var(--page-primary-color)]/10 px-[var(--page-margin-x)] py-5 [&>h6]:hidden"
		),
	});

	return (
		<div style={styles} className="template-gengar page-content relative h-full bg-white text-gray-800">
			{/* Sidebar Background */}
			{(!fullWidth || isFirstPage) && (
				<div className="page-sidebar-background pointer-events-none absolute inset-y-0 z-0 w-[var(--page-sidebar-width)] shrink-0 bg-[color:var(--page-primary-color)] left-0" />
			)}

			<div className="flex h-full">
				{(!fullWidth || isFirstPage) && (
					<aside
						data-layout="sidebar"
						className="group page-sidebar z-10 flex w-[var(--page-sidebar-width)] shrink-0 flex-col"
					>
						{isFirstPage && <Header />}

						{!fullWidth && (
							<div className="shrink-0 space-y-5 overflow-x-hidden px-[var(--page-margin-x)] pt-5 text-foreground/90">
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
	const basics = useResumeTemplateData().basics;

	return (
		<div className="page-header relative flex">
			<div className="flex w-full shrink-0 flex-col justify-center gap-y-3 bg-[color:var(--page-primary-color)] px-[var(--page-margin-x)] py-[var(--page-margin-y)] text-white">
				<PagePicture className="w-28 h-28 rounded-[2rem] border-[4px] border-white/85 bg-white/10 p-1.5 shadow-[0_20px_36px_rgba(15,23,42,0.22)]" />

				<div>
					<h2 className="basics-name text-xl font-extrabold tracking-tight">{basics.name}</h2>
					<p className="basics-headline text-sm opacity-80 mt-0.5">{basics.headline}</p>
				</div>

				<div className="basics-items flex flex-col gap-y-2 text-[0.68rem] text-white/85 *:flex *:items-center *:gap-x-1.5 *:rounded-full *:border *:border-white/10 *:bg-white/10 *:px-3 *:py-1.5">
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
