import { Envelope, Globe, MapPin, Phone } from "@phosphor-icons/react";
import { useMemo } from "react";
import { cn } from "../../lib/utils";
import { getSectionComponent } from "../shared/get-section-component";
import { PageIcon } from "../shared/page-icon";
import { PageLink } from "../shared/page-link";
import { PagePicture } from "../shared/page-picture";
import { useArtboardStore } from "../../store/artboard";
import type { TemplateProps } from "../azurill/types";

const sectionClassName = cn(
	// Container
	"rounded-[var(--container-border-radius)] border border-[color:var(--page-text-color)]/10 bg-[color:var(--page-background-color)] p-4",

	// Section Heading
	"[&>h6]:-mt-[var(--heading-negative-margin)] [&>h6]:max-w-fit [&>h6]:bg-[color:var(--page-background-color)] [&>h6]:px-4",

	// Push the first section of a page down, to avoid clipping the header
	"group-data-[layout=main]:first-of-type:mt-4",
);

/**
 * Template: Lapras
 */
export function LaprasTemplate({ pageIndex = 0, pageLayout }: TemplateProps) {
	const defaultLayout = {
        fullWidth: false,
        main: ['summary', 'experience', 'education', 'projects'],
        sidebar: ['skills']
    };
    const storeLayout = useArtboardStore((state) => state.resume.data.metadata.layout.pages[pageIndex]);
    const layout = pageLayout || storeLayout || defaultLayout;

	const isFirstPage = pageIndex === 0;
	const { main, sidebar, fullWidth } = layout;

	const containerBorderRadius = useArtboardStore((state) => Math.min(state.resume.data.basics.picture?.borderRadius || 0, 30));
	const headingNegativeMargin = useArtboardStore((state) => (state.resume.data.metadata.typography.font.size || 16) + 6);

	const style = useMemo(() => {
		return {
            '--page-primary-color': '#0277bd', // Light Blue (Lapras)
            '--page-text-color': '#111827',
            '--page-background-color': '#ffffff',
            '--page-margin-x': '2rem',
            '--page-margin-y': '2rem',
            '--page-gap-y': '1.5rem',
            '--picture-border-radius': `${containerBorderRadius}px`,
			"--container-border-radius": `${containerBorderRadius}px`,
			"--heading-negative-margin": `${headingNegativeMargin}px`,
		} as React.CSSProperties;
	}, [containerBorderRadius, headingNegativeMargin]);

	return (
		<div
			style={style}
			className="template-lapras page-content space-y-6 px-[var(--page-margin-x)] pt-[var(--page-margin-y)] print:p-0 h-full bg-white text-gray-800"
		>
			{isFirstPage && <Header />}

			<div className="flex gap-6 h-full">
                <main data-layout="main" className="group page-main flex-1 space-y-6">
                    {main.map((section: string) => {
                        const Component = getSectionComponent(section, { sectionClassName });
                        return <Component key={section} id={section} />;
                    })}
                </main>

                {!fullWidth && (
                    <aside data-layout="sidebar" className="group page-sidebar w-[30%] shrink-0 space-y-6">
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
		<div
			className={cn(
				"page-header flex items-center gap-x-[var(--page-margin-x)] mb-6",
				"rounded-[var(--picture-border-radius)] border border-[color:var(--page-text-color)]/10 bg-[color:var(--page-background-color)] p-4",
			)}
		>
			<PagePicture />

			<div className="page-basics space-y-[var(--page-gap-y)]">
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
		</div>
	);
}
