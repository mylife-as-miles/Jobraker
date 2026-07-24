import type React from "react";
import { Globe, Mail } from "lucide-react";
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
 * Template: Micah — Charcoal & Gold
 * Dark charcoal page with a gold accent: a top contact bar, an oversized
 * stacked name beside an arch-topped photo, white cards for experience and
 * achievements floating on the dark ground, and dark education / skill-bar
 * sections.
 */

const PAGE_BG = "#2A2926";
const GOLD = "#CBA36B";
const CARD_BG = "#FDFDFB";
const CARD_HEADING = "#2A2926";
const CARD_MUTED = "#6B6A66";
const DARK_MUTED = "#A9A6A0";
const HAIRLINE_DARK = "rgba(255,255,255,0.18)";

// Sections that render as white cards vs. directly on the dark ground.
const WHITE_CARD_SECTIONS = new Set([
  "experience",
  "awards",
  "projects",
  "certifications",
  "publications",
  "volunteer",
  "references",
]);
const BAR_SECTIONS = new Set(["skills", "languages"]);

const clampLevel = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 3;
  return Math.max(1, Math.min(5, Math.round(value)));
};

const getItemHeading = (item: ResumeSectionItem) =>
  item.company ||
  item.organization ||
  item.school ||
  item.institution ||
  item.title ||
  item.degree ||
  item.name ||
  item.label ||
  "Untitled";

const getItemSubtitle = (item: ResumeSectionItem) => {
  const heading = getItemHeading(item);
  const candidates = [
    item.position,
    item.role,
    item.title,
    item.degree,
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

export function MicahTemplate({ pageIndex = 0 }: TemplateProps) {
  const resumeData = useResumeTemplateData();
  const sections = resumeData.sections;
  const isFirstPage = pageIndex === 0;

  // Placement is by section role, not the layout arrays: the builder renders
  // each template as a single page, so a fixed arrangement keeps the signature
  // look regardless of the resume's main/sidebar configuration.
  const isVisible = (id: string) => {
    const section = sections[id];
    return Boolean(
      section && !section.hidden && section.items.some((item) => !item.hidden),
    );
  };
  const placed = new Set<string>(["summary"]);
  const claim = (id: string) => {
    placed.add(id);
    return isVisible(id);
  };

  // Left (narrow): experience white card, then skill/language bars.
  const leftSections: string[] = [];
  if (claim("experience")) leftSections.push("experience");
  for (const id of ["skills", "languages"]) {
    if (claim(id)) leftSections.push(id);
  }

  // Right (wide): education, any extras, then the achievement card last.
  const rightSections: string[] = [];
  if (claim("education")) rightSections.push("education");
  const showAwards = claim("awards");
  for (const id of Object.keys(sections)) {
    if (!placed.has(id) && isVisible(id)) {
      placed.add(id);
      rightSections.push(id);
    }
  }
  if (showAwards) rightSections.push("awards");

  return (
    <div
      // [&_*]:font-sans out-specifies the app-wide `* { font-family: Questrial }`
      // rule so the name and headings render at real heavy weights.
      className='template-micah h-full w-full overflow-hidden px-10 py-9 font-sans antialiased [&_*]:font-sans'
      style={{ backgroundColor: PAGE_BG, color: "#FFFFFF" }}
    >
      {isFirstPage && <ContactBar />}

      <div className='mt-8 grid grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] gap-x-9'>
        {/* Left column */}
        <div className='flex flex-col gap-7'>
          {isFirstPage && (
            <PagePicture className='h-[220px] w-full rounded-t-[110px] rounded-b-[26px] object-cover' />
          )}
          {leftSections.map((id) => (
            <SectionBlock key={id} id={id} />
          ))}
        </div>

        {/* Right column */}
        <div className='flex flex-col gap-7'>
          {isFirstPage && <NameBlock />}
          {rightSections.map((id) => (
            <SectionBlock key={id} id={id} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- contact bar ------------------------------- */

function ContactBar() {
  const basics = useResumeTemplateData().basics;
  const websiteUrl = basics.website?.url || "";
  const websiteHref = getSafeExternalHref(
    websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`,
  );

  return (
    <div
      className='border-b pb-4'
      style={{ borderColor: "rgba(255,255,255,0.55)" }}
    >
      <div className='flex items-center justify-between gap-4 text-[12px] font-medium text-white/90'>
        {basics.email && (
          <span className='inline-flex items-center gap-2.5'>
            <IconBadge>
              <Mail className='h-3 w-3' strokeWidth={2.5} />
            </IconBadge>
            <a href={`mailto:${basics.email}`} className='hover:underline'>
              {basics.email}
            </a>
          </span>
        )}
        {websiteUrl && (
          <span className='inline-flex items-center gap-2.5'>
            <IconBadge>
              <Globe className='h-3 w-3' strokeWidth={2.5} />
            </IconBadge>
            {websiteHref ? (
              <a
                href={websiteHref}
                target='_blank'
                rel='noopener noreferrer'
                className='hover:underline'
              >
                {basics.website?.label || websiteUrl}
              </a>
            ) : (
              <span>{basics.website?.label || websiteUrl}</span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

function IconBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className='flex h-6 w-6 items-center justify-center rounded-md text-[#2A2926]'
      style={{ backgroundColor: GOLD }}
    >
      {children}
    </span>
  );
}

/* --------------------------------- name block ------------------------------- */

function NameBlock() {
  const basics = useResumeTemplateData().basics;
  const words = (basics.name || "Your Name").split(/\s+/).filter(Boolean);

  return (
    <div className='pt-1'>
      {/* font-weight lives on the spans: the global `* { font-weight: 400 }`
          rule hits child elements directly, so a weight on the h1 alone loses. */}
      <h1 className='text-[54px] uppercase leading-[0.9] tracking-[-0.02em] text-white'>
        {words.map((word, index) => (
          <span key={`${word}-${index}`} className='block font-extrabold'>
            {word}
          </span>
        ))}
      </h1>
      {basics.headline && (
        <p
          className='mt-3 text-[15px] font-semibold uppercase tracking-[0.28em]'
          style={{ color: GOLD }}
        >
          {basics.headline}
        </p>
      )}
    </div>
  );
}

/* ------------------------------- section router ----------------------------- */

function SectionBlock({ id }: { id: string }) {
  const section = useResumeTemplateData().sections[id];
  if (!section || section.hidden) return null;

  const visibleItems = section.items.filter((item) => !item.hidden);
  if (!visibleItems.length) return null;

  if (BAR_SECTIONS.has(id)) {
    return <BarSection title={section.title} items={visibleItems} />;
  }

  if (WHITE_CARD_SECTIONS.has(id)) {
    return (
      <WhiteCard title={section.title} notch={id === "experience" ? "br" : "tl"}>
        {visibleItems.map((item, index) => (
          <EntryItem
            key={item.id}
            item={item}
            variant='light'
            withDivider={index > 0}
          />
        ))}
      </WhiteCard>
    );
  }

  return (
    <DarkSection title={section.title}>
      {visibleItems.map((item, index) => (
        <EntryItem
          key={item.id}
          item={item}
          variant='dark'
          withDivider={index > 0}
        />
      ))}
    </DarkSection>
  );
}

/* -------------------------------- containers -------------------------------- */

function WhiteCard({
  title,
  notch,
  children,
}: {
  title: string;
  notch?: "tl" | "br";
  children: React.ReactNode;
}) {
  return (
    <div className='relative'>
      {/* Speech-bubble notch: a page-colored circle biting the card corner */}
      {notch === "tl" && (
        <span
          className='absolute -left-3 -top-3 z-10 h-11 w-11 rounded-full'
          style={{ backgroundColor: PAGE_BG }}
        />
      )}
      {notch === "br" && (
        <span
          className='absolute -bottom-3 -right-3 z-10 h-11 w-11 rounded-full'
          style={{ backgroundColor: PAGE_BG }}
        />
      )}
      <div
        className='rounded-[26px] px-6 py-6'
        style={{ backgroundColor: CARD_BG }}
      >
        <h6
          className='mb-4 border-b-[1.5px] pb-2.5 text-[12px] font-extrabold uppercase tracking-[0.22em]'
          style={{ color: CARD_HEADING, borderColor: CARD_HEADING }}
        >
          {title}
        </h6>
        <div>{children}</div>
      </div>
    </div>
  );
}

function DarkSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h6
        className='mb-4 border-b pb-2.5 text-[13px] font-extrabold uppercase tracking-[0.22em] text-white'
        style={{ borderColor: "rgba(255,255,255,0.6)" }}
      >
        {title}
      </h6>
      <div>{children}</div>
    </div>
  );
}

/* --------------------------------- entries ---------------------------------- */

function EntryItem({
  item,
  variant,
  withDivider,
}: {
  item: ResumeSectionItem;
  variant: "light" | "dark";
  withDivider: boolean;
}) {
  const heading = getItemHeading(item);
  const subtitle = getItemSubtitle(item);
  const date = getItemDate(item);
  const description = sanitizeHtmlFragment(item.description || "");
  const isLight = variant === "light";

  return (
    <div
      className={cn(withDivider && "mt-4 border-t pt-4")}
      style={
        withDivider
          ? { borderColor: isLight ? "#ECEAE4" : HAIRLINE_DARK }
          : undefined
      }
    >
      <div className='flex items-baseline justify-between gap-3'>
        <h3
          className='text-[13.5px] font-bold leading-snug'
          style={{ color: isLight ? CARD_HEADING : "#FFFFFF" }}
        >
          {heading}
        </h3>
        {date && (
          <span
            className='shrink-0 text-[11px] font-bold'
            style={{ color: isLight ? CARD_HEADING : "#FFFFFF" }}
          >
            {date}
          </span>
        )}
      </div>
      {subtitle && (
        <p
          className='mt-0.5 text-[12px] font-medium'
          style={{ color: isLight ? CARD_MUTED : DARK_MUTED }}
        >
          {subtitle}
        </p>
      )}
      {description && (
        <div
          className={cn(
            "mt-1.5 text-[10.5px] leading-[1.7]",
            "[&_p+p]:mt-[var(--resume-paragraph-spacing,0.5rem)]",
            "[&_ul]:list-none [&_ul]:space-y-1 [&_ul]:pl-0",
            "[&_li]:relative [&_li]:pl-3.5",
            "[&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:content-['•']",
            "[&_a]:underline",
          )}
          style={{ color: isLight ? CARD_MUTED : DARK_MUTED }}
          dangerouslySetInnerHTML={{ __html: description }}
        />
      )}
    </div>
  );
}

/* ------------------------------- skill bars --------------------------------- */

function BarSection({
  title,
  items,
}: {
  title: string;
  items: ResumeSectionItem[];
}) {
  return (
    <div>
      <h6
        className='mb-4 border-b pb-2.5 text-[13px] font-extrabold uppercase tracking-[0.22em] text-white'
        style={{ borderColor: "rgba(255,255,255,0.6)" }}
      >
        {title}
      </h6>
      <div className='space-y-3.5'>
        {items.map((item) => {
          const level = clampLevel(item.level);
          const name = item.name || item.title || item.label || "Untitled";
          return (
            <div key={item.id} className='flex items-center gap-3'>
              <span className='w-[84px] shrink-0 text-[11px] text-white/90'>
                {name}
              </span>
              <span
                className='h-[5px] flex-1 overflow-hidden rounded-[2px]'
                style={{ backgroundColor: "rgba(255,255,255,0.30)" }}
              >
                <span
                  className='block h-full rounded-[2px]'
                  style={{
                    width: `${level * 20}%`,
                    backgroundColor: GOLD,
                  }}
                />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
