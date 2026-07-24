import type React from "react";
import { cn } from "../../lib/utils";
import {
  getSafeExternalHref,
  sanitizeHtmlFragment,
} from "../../lib/inputSecurity";
import type { ResumeSectionItem } from "../../store/artboard";
import { PagePicture } from "../shared/page-picture";
import type { TemplateProps } from "../types";
import { useResumeTemplateData } from "../use-resume-template-data";

/**
 * Template: Kumar — Dark Bento Grid
 * Near-black page of rounded charcoal cards: photo beside an italic intro,
 * chip rows for interests/tools/languages, side-by-side experience cards,
 * stacked education entries, and portfolio/details chip bars.
 */

const PAGE_BG = "#050505";
const CARD_BG = "#171717";
const CHIP_BG = "#242424";
const PILL_BG = "#232323";
const DIVIDER = "#2C2C2C";
const TEXT_MUTED = "#9C9C9C";
const TEXT_SOFT = "#B5B5B5";

const BADGE_COLORS = [
  "#FF9A3D",
  "#31A8FF",
  "#FF3366",
  "#9B6DFF",
  "#2DD4BF",
  "#F5C542",
];

const cardClass = "rounded-[24px]";

const getItemHeading = (item: ResumeSectionItem) =>
  item.company ||
  item.organization ||
  item.degree ||
  item.title ||
  item.name ||
  item.label ||
  "Untitled";

const getItemSub = (item: ResumeSectionItem) => {
  const heading = getItemHeading(item);
  const candidates = [
    item.position,
    item.role,
    item.title,
    item.school,
    item.field,
    item.area,
    item.issuer,
  ].filter(Boolean) as string[];
  return candidates.find((value) => value !== heading) || "";
};

const getItemDate = (item: ResumeSectionItem) =>
  item.date ||
  item.period ||
  [item.startDate, item.endDate].filter(Boolean).join(" - ");

function DatePill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className='shrink-0 rounded-[14px] px-4 py-2 text-[12px] font-medium'
      style={{ backgroundColor: PILL_BG, color: TEXT_SOFT }}
    >
      {children}
    </span>
  );
}

function Chip({
  children,
  badge,
  badgeColor,
  href,
}: {
  children: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  href?: string;
}) {
  const content = (
    <>
      {badge && (
        <span
          className='flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[9px] font-bold'
          style={{
            backgroundColor: `${badgeColor}2E`,
            color: badgeColor,
          }}
        >
          {badge}
        </span>
      )}
      <span>{children}</span>
    </>
  );

  const className =
    "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[12.5px] font-medium";
  const style = { backgroundColor: CHIP_BG, color: "#E8E8E8" };

  if (href) {
    return (
      <a
        href={href}
        target='_blank'
        rel='noopener noreferrer'
        className={cn(className, "hover:opacity-80")}
        style={style}
      >
        {content}
      </a>
    );
  }

  return (
    <span className={className} style={style}>
      {content}
    </span>
  );
}

function LabelRowCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(cardClass, "flex items-center gap-5 px-6 py-5", className)}
      style={{ backgroundColor: CARD_BG }}
    >
      <span className='shrink-0 text-[15px] font-bold text-white'>{title}</span>
      <span
        className='h-8 w-px shrink-0 self-center'
        style={{ backgroundColor: DIVIDER }}
      />
      <div className='flex min-w-0 flex-wrap gap-2.5'>{children}</div>
    </div>
  );
}

export function KumarTemplate({ pageIndex = 0 }: TemplateProps) {
  const resumeData = useResumeTemplateData();
  const isFirstPage = pageIndex === 0;
  const { basics, sections } = resumeData;

  // Placement is by section role, not the layout arrays: the builder renders
  // each template as a single page, so a fixed arrangement keeps the signature
  // look regardless of the resume's main/sidebar configuration.
  const isVisible = (id: string) => {
    const section = sections[id];
    return Boolean(
      section && !section.hidden && section.items.some((item) => !item.hidden),
    );
  };
  const placed = new Set<string>(["summary", "interests", "experience"]);

  // Interests sits beside the intro; skills/languages become chip rows below.
  const headerChipSection =
    isFirstPage && isVisible("interests") ? "interests" : undefined;

  const bodyChipSections: string[] = [];
  for (const id of ["skills", "languages"]) {
    placed.add(id);
    if (isVisible(id)) bodyChipSections.push(id);
  }

  const experienceItems = isVisible("experience")
    ? sections["experience"].items.filter((item) => !item.hidden)
    : [];

  // Education and any remaining sections stack in the right column.
  const stackedIds: string[] = [];
  if (isVisible("education")) stackedIds.push("education");
  placed.add("education");
  for (const id of Object.keys(sections)) {
    if (!placed.has(id) && isVisible(id)) {
      placed.add(id);
      stackedIds.push(id);
    }
  }

  const hasProfiles =
    (basics.profiles || []).length > 0 || Boolean(basics.website?.url);
  const hasDetails = Boolean(
    basics.email ||
      basics.phone ||
      basics.location ||
      basics.customFields.length > 0,
  );

  return (
    <div
      // [&_*]:font-sans out-specifies the app-wide `* { font-family: Questrial }`
      // rule so cards can render at real bold weights.
      className='template-kumar h-full w-full overflow-hidden p-7 font-sans antialiased [&_*]:font-sans'
      style={{ backgroundColor: PAGE_BG, color: "#FFFFFF" }}
    >
      <div className='flex h-full flex-col gap-5'>
        {isFirstPage && (
          <div className='flex gap-5'>
            <PagePicture
              className={cn(
                cardClass,
                "h-[240px] w-[220px] shrink-0 object-cover",
              )}
            />
            <div className='flex min-w-0 flex-1 flex-col gap-5'>
              <IntroCard />
              {headerChipSection && (
                <ChipSectionCard id={headerChipSection} />
              )}
            </div>
          </div>
        )}

        {experienceItems.length > 0 && (
          <div className='grid grid-cols-2 gap-5'>
            {experienceItems.map((item) => (
              <ExperienceCard key={item.id} item={item} />
            ))}
          </div>
        )}

        <div className='flex gap-5'>
          <div className='flex min-w-0 flex-1 flex-col gap-5'>
            {bodyChipSections.map((id) => (
              <ChipSectionCard key={id} id={id} />
            ))}
          </div>
          <div className='flex min-w-0 flex-1 flex-col gap-5'>
            {stackedIds.map((id) => (
              <StackedItemsCard key={id} id={id} />
            ))}
          </div>
        </div>

        {isFirstPage && hasProfiles && <PortfolioCard />}
        {isFirstPage && hasDetails && <DetailsCard />}
      </div>
    </div>
  );
}

/* --------------------------------- header ---------------------------------- */

function IntroCard() {
  const resumeData = useResumeTemplateData();
  const { basics, summary } = resumeData;
  const hasSummary = Boolean(
    summary && !summary.hidden && (summary.content || "").trim(),
  );

  const fallback = [
    basics.name && `My name is ${basics.name}`,
    basics.headline,
  ]
    .filter(Boolean)
    .join(", ");

  if (!hasSummary && !fallback) return null;

  return (
    <div
      className={cn(cardClass, "flex flex-1 items-center px-8 py-7")}
      style={{ backgroundColor: CARD_BG }}
    >
      {hasSummary ? (
        <div
          // [&_*]:italic re-wins font-style against the global `* { font-style: normal }`
          className='text-[19px] font-medium italic leading-[1.5] text-white [&_*]:italic [&_p+p]:mt-[var(--resume-paragraph-spacing,0.5rem)] [&_a]:underline [&_strong]:font-bold'
          dangerouslySetInnerHTML={{
            __html: sanitizeHtmlFragment(summary.content || ""),
          }}
        />
      ) : (
        <p className='text-[19px] font-medium italic leading-[1.5] text-white'>
          {fallback}.
        </p>
      )}
    </div>
  );
}

/* -------------------------------- chip rows --------------------------------- */

function ChipSectionCard({ id }: { id: string }) {
  const section = useResumeTemplateData().sections[id];
  if (!section || section.hidden) return null;

  const visibleItems = section.items.filter((item) => !item.hidden);
  if (!visibleItems.length) return null;

  // Skills render as compact colored badge squares (like the Ai/Ps/Id/Xd
  // tool tiles); other list sections render as text chips.
  const asBadges = id === "skills";

  return (
    <LabelRowCard title={section.title}>
      {visibleItems.map((item, index) => {
        const name =
          item.name || item.title || item.label || "Untitled";
        const color = BADGE_COLORS[index % BADGE_COLORS.length];

        if (asBadges) {
          const abbr =
            name.slice(0, 1).toUpperCase() + name.slice(1, 2).toLowerCase();
          return (
            <span
              key={item.id}
              title={name}
              className='flex h-10 w-10 items-center justify-center rounded-[10px] text-[13px] font-bold'
              style={{ backgroundColor: `${color}2E`, color }}
            >
              {abbr}
            </span>
          );
        }

        return <Chip key={item.id}>{name}</Chip>;
      })}
    </LabelRowCard>
  );
}

/* ------------------------------ experience card ----------------------------- */

function ExperienceCard({ item }: { item: ResumeSectionItem }) {
  const heading = getItemHeading(item);
  const sub = getItemSub(item);
  const date = getItemDate(item);
  const description = sanitizeHtmlFragment(item.description || "");

  return (
    <div
      className={cn(cardClass, "px-7 py-6")}
      style={{ backgroundColor: CARD_BG }}
    >
      <div className='flex items-start justify-between gap-4'>
        <div className='min-w-0'>
          <h3 className='text-[24px] font-bold leading-tight tracking-[-0.01em] text-white'>
            {heading}
          </h3>
          {sub && (
            <p className='mt-1 text-[13px]' style={{ color: TEXT_MUTED }}>
              {sub}
            </p>
          )}
        </div>
        {date && <DatePill>{date}</DatePill>}
      </div>

      {description && (
        <>
          <div
            className='my-4 h-px w-full'
            style={{ backgroundColor: DIVIDER }}
          />
          <div
            className={cn(
              "text-[12.5px] leading-[1.75]",
              "[&_p+p]:mt-[var(--resume-paragraph-spacing,0.5rem)]",
              "[&_ul]:list-none [&_ul]:space-y-1.5 [&_ul]:pl-0",
              "[&_li]:relative [&_li]:pl-4",
              "[&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:content-['•']",
              "[&_a]:underline [&_strong]:font-semibold [&_strong]:text-white/85",
            )}
            style={{ color: TEXT_MUTED }}
            dangerouslySetInnerHTML={{ __html: description }}
          />
        </>
      )}
    </div>
  );
}

/* --------------------------- stacked entries card --------------------------- */

function StackedItemsCard({ id }: { id: string }) {
  const section = useResumeTemplateData().sections[id];
  if (!section || section.hidden) return null;

  const visibleItems = section.items.filter((item) => !item.hidden);
  if (!visibleItems.length) return null;

  return (
    <div
      className={cn(cardClass, "px-7 py-6")}
      style={{ backgroundColor: CARD_BG }}
    >
      {visibleItems.map((item, index) => {
        const heading = getItemHeading(item);
        const sub = getItemSub(item);
        const date = getItemDate(item);
        const description = sanitizeHtmlFragment(item.description || "");

        return (
          <div
            key={item.id}
            className={cn(index > 0 && "mt-5 border-t pt-5")}
            style={index > 0 ? { borderColor: DIVIDER } : undefined}
          >
            <div className='flex items-start justify-between gap-4'>
              <div className='min-w-0'>
                <h3 className='text-[24px] font-bold leading-tight tracking-[-0.01em] text-white'>
                  {heading}
                </h3>
                {sub && (
                  <p
                    className='mt-1.5 text-[13px] leading-snug'
                    style={{ color: TEXT_MUTED }}
                  >
                    {sub}
                  </p>
                )}
                {item.location && (
                  <p
                    className='text-[13px] leading-snug'
                    style={{ color: TEXT_MUTED }}
                  >
                    {item.location}
                  </p>
                )}
              </div>
              {date && <DatePill>{date}</DatePill>}
            </div>
            {description && (
              <div
                className='mt-2 text-[12.5px] leading-[1.7] [&_p+p]:mt-[var(--resume-paragraph-spacing,0.5rem)] [&_a]:underline'
                style={{ color: TEXT_MUTED }}
                dangerouslySetInnerHTML={{ __html: description }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ footer chip bars ---------------------------- */

function PortfolioCard() {
  const basics = useResumeTemplateData().basics;
  const profiles = basics.profiles || [];
  const website = basics.website;

  return (
    <LabelRowCard title='Portfolio'>
      {website?.url && (
        <Chip
          href={getSafeExternalHref(
            website.url.startsWith("http")
              ? website.url
              : `https://${website.url}`,
          ) || undefined}
        >
          {website.label || website.url}
        </Chip>
      )}
      {profiles.map((profile) => (
        <Chip
          key={`${profile.network}-${profile.username}`}
          href={
            getSafeExternalHref(
              profile.url.startsWith("http")
                ? profile.url
                : `https://${profile.url}`,
            ) || undefined
          }
        >
          {profile.network || profile.username}
        </Chip>
      ))}
    </LabelRowCard>
  );
}

function DetailsCard() {
  const basics = useResumeTemplateData().basics;

  return (
    <LabelRowCard title='Details'>
      {basics.customFields.map((field) => (
        <Chip key={field.id}>{field.text}</Chip>
      ))}
      {basics.email && <Chip>{basics.email}</Chip>}
      {basics.phone && <Chip>{basics.phone}</Chip>}
      {basics.location && <Chip>{basics.location}</Chip>}
    </LabelRowCard>
  );
}
