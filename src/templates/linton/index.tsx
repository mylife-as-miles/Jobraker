import { cn } from "../../lib/utils";
import {
  getSafeExternalHref,
  sanitizeHtmlFragment,
} from "../../lib/inputSecurity";
import type { ResumeSectionItem } from "../../store/artboard";
import { PageLink } from "../shared/page-link";
import { PagePicture } from "../shared/page-picture";
import type { TemplateProps } from "../types";
import { useResumeTemplateData } from "../use-resume-template-data";

/**
 * Template: Linton — Editorial Charcoal
 * Cream editorial layout with an oversized display name, a charcoal quote
 * panel and contact card, dot-rated skills, and a vertical RESUME wordmark.
 */

const CREAM = "#EFEAE3";
const INK = "#232320";
const CHARCOAL = "#2B2A27";
const PEACH = "#EFA872";
const MUTED_ON_DARK = "rgba(255,255,255,0.55)";

const clampLevel = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.max(1, Math.min(5, Math.round(value)));
};

const LEVEL_LABELS = ["Novice", "Competent", "Proficient", "Expert", "Master"];

const getItemTitle = (item: ResumeSectionItem) =>
  item.title ||
  item.position ||
  item.role ||
  item.degree ||
  item.name ||
  item.label ||
  "Untitled";

const getItemSubtitle = (item: ResumeSectionItem) => {
  const org =
    item.company ||
    item.school ||
    item.organization ||
    item.institution ||
    item.issuer;
  return [org, item.location].filter(Boolean).join(", ");
};

const getItemDate = (item: ResumeSectionItem) =>
  item.date ||
  item.period ||
  [item.startDate, item.endDate].filter(Boolean).join(" - ");

export function LintonTemplate({ pageIndex = 0 }: TemplateProps) {
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

  // Left rail: skill/language/interest lists with level dots.
  const sidebarSections: string[] = [];
  for (const id of ["skills", "languages", "interests"]) {
    if (claim(id)) sidebarSections.push(id);
  }

  // Right side is two editorial columns: Experience gets its own (columnB),
  // Award + Education + any extras stack in columnA.
  const columnB: string[] = [];
  if (claim("experience")) columnB.push("experience");

  const columnA: string[] = [];
  if (claim("awards")) columnA.push("awards");
  if (claim("education")) columnA.push("education");
  for (const id of Object.keys(sections)) {
    if (!placed.has(id) && isVisible(id)) {
      placed.add(id);
      columnA.push(id);
    }
  }

  return (
    <div
      // [&_*]:font-sans out-specifies the app-wide `* { font-family: Questrial }`
      // rule so headings can render at real heavy weights.
      className='template-linton relative h-full w-full overflow-hidden font-sans antialiased [&_*]:font-sans'
      style={{ backgroundColor: CREAM, color: INK }}
    >
      {/* Soft pink wash, bottom-left */}
      <div
        className='pointer-events-none absolute inset-0'
        style={{
          background:
            "radial-gradient(90% 55% at 0% 100%, #F6DCCF 0%, rgba(246,220,207,0) 60%)",
        }}
      />

      <div className='relative flex h-full'>
        {/* ---------- Left rail ---------- */}
        <div className='flex w-[37%] shrink-0 flex-col pl-9 pt-9'>
          {isFirstPage && (
            <PagePicture className='h-[250px] w-full rounded-[1.25rem] rounded-br-[3.25rem] object-cover' />
          )}

          {isFirstPage && <QuotePanel />}

          <div className='mt-7 space-y-7 pr-6'>
            {sidebarSections.map((sectionId) => (
              <SidebarSection key={sectionId} id={sectionId} />
            ))}
          </div>

          {/* Vertical wordmark */}
          <div className='mt-auto flex items-end pb-6'>
            <span
              className='block rotate-180 text-[64px] font-extrabold uppercase leading-none tracking-[0.01em] [writing-mode:vertical-rl]'
              style={{ color: INK }}
            >
              Resume
            </span>
          </div>
        </div>

        {/* ---------- Right side ---------- */}
        <div className='flex min-w-0 flex-1 flex-col pb-10 pl-6 pr-9 pt-9'>
          {isFirstPage && <DisplayName />}
          {isFirstPage && <ContactCard />}

          <div
            className={cn(
              "mt-8 grid gap-x-8 gap-y-8",
              columnB.length > 0 ? "grid-cols-2" : "grid-cols-1",
            )}
          >
            <div className='min-w-0 space-y-8'>
              {columnA.map((sectionId) => (
                <EntrySection key={sectionId} id={sectionId} />
              ))}
            </div>
            {columnB.length > 0 && (
              <div className='min-w-0 space-y-8'>
                {columnB.map((sectionId) => (
                  <EntrySection key={sectionId} id={sectionId} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- header --------------------------------- */

function DisplayName() {
  const basics = useResumeTemplateData().basics;
  const words = (basics.name || "Your Name").split(/\s+/).filter(Boolean);

  return (
    <h1
      className='basics-name text-[58px] font-extrabold leading-[0.98] tracking-[-0.035em]'
      style={{ color: INK }}
    >
      {words.map((word, index) => (
        <span key={`${word}-${index}`} className='block'>
          {word}
        </span>
      ))}
    </h1>
  );
}

function ContactCard() {
  const basics = useResumeTemplateData().basics;
  const websiteUrl = basics.website?.url || "";
  const websiteHref = getSafeExternalHref(
    websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`,
  );

  return (
    <div
      className='mt-6 rounded-[1.75rem] rounded-tl-[2.75rem] px-7 py-6'
      style={{ backgroundColor: CHARCOAL }}
    >
      <div className='flex flex-wrap items-center gap-3'>
        {/* Long arrow */}
        <svg
          width='46'
          height='12'
          viewBox='0 0 46 12'
          fill='none'
          aria-hidden='true'
          className='shrink-0'
        >
          <path
            d='M0 6h43M38 1l6 5-6 5'
            stroke={PEACH}
            strokeWidth='1.6'
            strokeLinecap='round'
            strokeLinejoin='round'
            fill='none'
          />
        </svg>
        <span
          className='inline-flex items-center rounded-full border px-4 py-1 text-[12px] font-semibold'
          style={{ borderColor: PEACH, color: PEACH }}
        >
          Contact
        </span>
        {basics.email && (
          <PageLink
            type='email'
            value={basics.email}
            className='text-[13px] font-bold text-white'
          />
        )}
      </div>

      <div
        className='mt-4 space-y-1 text-[11px] leading-relaxed'
        style={{ color: MUTED_ON_DARK }}
      >
        {basics.phone && (
          <p className='basics-item-phone'>
            <span className='font-semibold text-white/75'>Tel.</span>{" "}
            {basics.phone}
          </p>
        )}
        {basics.location && (
          <p className='basics-item-location'>
            <span className='font-semibold text-white/75'>Address:</span>{" "}
            {basics.location}
          </p>
        )}
        {websiteUrl && (
          <p className='basics-item-website'>
            <span className='font-semibold text-white/75'>Website:</span>{" "}
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
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- quote panel -------------------------------- */

function QuotePanel() {
  const resumeData = useResumeTemplateData();
  const { basics, summary } = resumeData;
  const hasSummary = Boolean(
    summary && !summary.hidden && (summary.content || "").trim(),
  );
  const heading = basics.headline || (hasSummary ? summary.title : "");

  if (!hasSummary && !heading) return null;

  return (
    <div
      className='-mt-5 rounded-[1.75rem] rounded-tr-[0.75rem] px-6 pb-7 pt-5'
      style={{ backgroundColor: CHARCOAL }}
    >
      <span
        className='block font-serif text-[58px] leading-[0.7]'
        style={{ color: PEACH }}
      >
        &ldquo;
      </span>
      {heading && (
        <p className='mt-1 text-[15px] font-bold leading-snug text-white'>
          {heading}
        </p>
      )}
      {hasSummary && (
        <div
          className='section-summary-copy mt-3 text-[10.5px] leading-[1.8] [&_a]:underline [&_p+p]:mt-[var(--resume-paragraph-spacing,0.5rem)] [&_strong]:font-semibold [&_strong]:text-white/85'
          style={{ color: "rgba(255,255,255,0.5)" }}
          dangerouslySetInnerHTML={{
            __html: sanitizeHtmlFragment(summary.content || ""),
          }}
        />
      )}
    </div>
  );
}

/* ----------------------------- sidebar sections ----------------------------- */

function SidebarSection({ id }: { id: string }) {
  const section = useResumeTemplateData().sections[id];
  if (!section || section.hidden) return null;

  const visibleItems = section.items.filter((item) => !item.hidden);
  if (!visibleItems.length) return null;

  return (
    <div className={cn("section-content", `section-${id}`)}>
      <h6
        className='mb-4 text-[15px] font-extrabold tracking-tight'
        style={{ color: INK }}
      >
        {section.title}
      </h6>
      <div className='space-y-3.5'>
        {visibleItems.map((item) => {
          const level = clampLevel(item.level);
          const levelLabel = level ? LEVEL_LABELS[level - 1] : "";

          return (
            <div
              key={item.id}
              className='flex items-center justify-between gap-3'
            >
              <div className='min-w-0'>
                <div
                  className='truncate text-[12px] font-semibold'
                  style={{ color: INK }}
                >
                  {getItemTitle(item)}
                </div>
                {levelLabel && (
                  <div className='text-[10px] italic text-[#8B8880]'>
                    ({levelLabel})
                  </div>
                )}
              </div>
              {level && (
                <div className='flex shrink-0 gap-[5px]'>
                  {[1, 2, 3, 4, 5].map((dot) => (
                    <span
                      key={dot}
                      className='h-[7px] w-[7px] rounded-full'
                      style={{
                        backgroundColor:
                          dot <= level ? INK : "rgba(35,35,32,0.18)",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ entry sections ------------------------------ */

function EntrySection({ id }: { id: string }) {
  const section = useResumeTemplateData().sections[id];
  if (!section || section.hidden) return null;

  const visibleItems = section.items.filter((item) => !item.hidden);
  if (!visibleItems.length) return null;

  return (
    <div className={cn("section-content", `section-${id}`)}>
      <h6
        className='mb-4 text-[15px] font-extrabold tracking-tight'
        style={{ color: INK }}
      >
        {section.title}
      </h6>
      <div className='space-y-5'>
        {visibleItems.map((item) => {
          const date = getItemDate(item);
          const title = getItemTitle(item);
          const subtitle = getItemSubtitle(item);
          const description = sanitizeHtmlFragment(item.description || "");

          return (
            <div key={item.id} className='section-item'>
              {date && (
                <div
                  className='text-[12px] font-bold tracking-tight'
                  style={{ color: INK }}
                >
                  {date}
                </div>
              )}
              <div
                className='mt-0.5 text-[13px] font-semibold'
                style={{ color: INK }}
              >
                {title}
              </div>
              {subtitle && (
                <div className='text-[11px] font-medium text-[#8B8880]'>
                  {subtitle}
                </div>
              )}
              {description && (
                <div
                  className={cn(
                    "section-item-description mt-1.5 text-[10.5px] leading-[1.7] text-[#7A776F]",
                    "[&_p+p]:mt-[var(--resume-paragraph-spacing,0.5rem)]",
                    "[&_ul]:mt-1 [&_ul]:list-none [&_ul]:space-y-1 [&_ul]:pl-0",
                    "[&_li]:relative [&_li]:pl-3.5",
                    "[&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:content-['–']",
                    "[&_a]:underline [&_strong]:font-semibold [&_strong]:text-[#4A4842]",
                  )}
                  dangerouslySetInnerHTML={{ __html: description }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
