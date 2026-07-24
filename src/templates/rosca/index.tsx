import type React from "react";
import { Search } from "lucide-react";
import { cn } from "../../lib/utils";
import { sanitizeHtmlFragment } from "../../lib/inputSecurity";
import type { ResumeSectionItem } from "../../store/artboard";
import { PagePicture } from "../shared/page-picture";
import type { TemplateProps } from "../types";
import { useResumeTemplateData } from "../use-resume-template-data";

/**
 * Template: Rosca — Editorial Fashion
 * A near-black page with green glows and a cream card: a dark header contact
 * bar with flower motifs, a huge black name with a rotated green tag, folder-
 * tab dark section cards, outlined date/GPA pills, and gradient green skill
 * pills.
 */

const PAGE_BG = "#0E0F0D";
const CREAM = "#F1ECE0";
const DARK_CARD = "#1D1D1B";
const GREEN = "#2E9E5B";
const INK = "#141414";
const CARD_TEXT = "#EDEBE4";
const CARD_MUTED = "#B4B2AA";
const PILL_INK = "#123021";

const ENTRY_LEFT = ["experience", "projects", "awards", "volunteer"];
const PILL_SECTIONS = new Set(["skills", "languages", "interests"]);

const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
const pillColor = (index: number, total: number) => {
  const t = total <= 1 ? 0 : index / (total - 1);
  // dark green (#2E9E5B) -> cream (#EFECE0)
  const r = lerp(46, 239, t);
  const g = lerp(158, 236, t);
  const b = lerp(91, 224, t);
  return `rgb(${r}, ${g}, ${b})`;
};

const getEntryTitle = (item: ResumeSectionItem) =>
  item.position ||
  item.role ||
  item.title ||
  item.name ||
  item.label ||
  "Untitled";

const getEntryOrg = (item: ResumeSectionItem) =>
  item.company || item.organization || item.institution || "";

const getDate = (item: ResumeSectionItem) =>
  item.date ||
  item.period ||
  [item.startDate, item.endDate].filter(Boolean).join(" - ");

export function RoscaTemplate({ pageIndex = 0 }: TemplateProps) {
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

  const leftIds = ENTRY_LEFT.filter(isVisible);
  const rightOrder = ["education", "skills", "languages", "references", "interests"];
  const rightIds = rightOrder.filter(isVisible);
  const known = new Set(["summary", ...leftIds, ...rightIds]);
  const unknownIds = Object.keys(sections).filter(
    (id) => !known.has(id) && isVisible(id),
  );

  return (
    <div
      // [&_*]:font-sans out-specifies the app-wide `* { font-family: Questrial }`
      // rule so the name and headings render at real heavy weights.
      className='template-rosca relative h-full w-full overflow-hidden p-4 font-sans antialiased [&_*]:font-sans'
      style={{
        backgroundColor: PAGE_BG,
        backgroundImage:
          "radial-gradient(60% 40% at 100% 0%, rgba(46,158,91,0.35), transparent 60%), radial-gradient(55% 45% at 0% 100%, rgba(46,158,91,0.30), transparent 60%)",
        color: INK,
      }}
    >
      <div
        className='relative flex h-full flex-col overflow-hidden rounded-[34px]'
        style={{ backgroundColor: CREAM }}
      >
        {/* Header contact bar */}
        {isFirstPage && <ContactBar />}

        <div className='flex-1 px-8 pb-8 pt-5'>
          {isFirstPage && <HeaderBlock />}

          <div className='mt-7 grid grid-cols-2 gap-5'>
            {/* Left column */}
            <div className='flex flex-col gap-5'>
              {leftIds.map((id) => (
                <FolderCard key={id} title={sections[id].title}>
                  <ExperienceEntries id={id} />
                </FolderCard>
              ))}
              {unknownIds.map((id) => (
                <FolderCard key={id} title={sections[id].title}>
                  <ExperienceEntries id={id} />
                </FolderCard>
              ))}
            </div>

            {/* Right column */}
            <div className='flex flex-col gap-5'>
              {rightIds.map((id) => (
                <FolderCard key={id} title={sections[id].title}>
                  {id === "education" ? (
                    <EducationEntries id={id} />
                  ) : PILL_SECTIONS.has(id) ? (
                    <SkillPills id={id} />
                  ) : (
                    <ExperienceEntries id={id} />
                  )}
                </FolderCard>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- decorations ------------------------------- */

function Flower({ className }: { className?: string }) {
  return (
    <svg viewBox='-50 -50 100 100' className={className} aria-hidden='true'>
      {Array.from({ length: 6 }).map((_, i) => (
        <ellipse
          key={i}
          rx='15'
          ry='30'
          cy='-20'
          fill={INK}
          transform={`rotate(${i * 60})`}
        />
      ))}
      <circle r='11' fill={CREAM} />
    </svg>
  );
}

/* --------------------------------- header ----------------------------------- */

function ContactBar() {
  const basics = useResumeTemplateData().basics;
  const handle = basics.website?.label || basics.website?.url || basics.email;
  const items = [basics.phone, handle, basics.location].filter(
    Boolean,
  ) as string[];

  return (
    <div className='relative'>
      <Flower className='absolute left-5 top-1 z-10 h-9 w-9' />
      <Flower className='absolute right-5 top-1 z-10 h-9 w-9' />
      <div
        className='mx-12 flex items-center justify-around gap-4 rounded-b-[22px] px-8 py-3.5 text-[13px] font-medium text-white'
        style={{ backgroundColor: DARK_CARD }}
      >
        {items.map((item) => (
          <span key={item} className='truncate'>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function HeaderBlock() {
  const { basics, summary } = useResumeTemplateData();
  const words = (basics.name || "Your Name").split(/\s+/).filter(Boolean);
  const hasSummary = Boolean(
    summary && !summary.hidden && (summary.content || "").trim(),
  );

  return (
    <div className='relative mt-4'>
      <div
        className='absolute right-0 top-0 z-10 overflow-hidden rounded-[20px] border-[5px]'
        style={{ borderColor: INK, backgroundColor: INK }}
      >
        <PagePicture className='h-[260px] w-[280px] rounded-[14px] object-cover' />
      </div>

      <div className='relative z-0 max-w-[60%]'>
        <div className='relative inline-block'>
          <h1 className='text-[74px] uppercase leading-[0.82] tracking-[-0.03em]'>
            {words.map((word, index) => (
              <span key={`${word}-${index}`} className='block font-extrabold'>
                {word}
              </span>
            ))}
          </h1>
          {basics.headline && words.length > 1 && (
            <span
              className='absolute left-6 top-[38%] -rotate-[4deg] px-4 py-1.5 text-[17px] font-extrabold uppercase italic tracking-[0.02em] text-white'
              style={{ backgroundColor: GREEN }}
            >
              {basics.headline}
            </span>
          )}
        </div>
      </div>

      {hasSummary && (
        <div
          className='mt-5 max-w-[58%] text-[13px] leading-[1.65] [&_a]:underline [&_p+p]:mt-[var(--resume-paragraph-spacing,0.5rem)]'
          style={{ color: "#33322D" }}
          dangerouslySetInnerHTML={{
            __html: sanitizeHtmlFragment(summary.content || ""),
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------- folder card ------------------------------- */

function FolderCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className='-mb-px inline-block rounded-t-[16px] px-6 py-2'
        style={{ backgroundColor: DARK_CARD }}
      >
        <h3 className='text-[19px] font-bold' style={{ color: CARD_TEXT }}>
          {title}
        </h3>
      </div>
      <div
        className='rounded-[24px] rounded-tl-none px-6 py-6'
        style={{ backgroundColor: DARK_CARD }}
      >
        {children}
      </div>
    </div>
  );
}

function DatePill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className='shrink-0 rounded-full border px-3.5 py-1 text-[11.5px]'
      style={{ borderColor: "rgba(255,255,255,0.4)", color: CARD_MUTED }}
    >
      {children}
    </span>
  );
}

/* --------------------------------- entries ---------------------------------- */

function ExperienceEntries({ id }: { id: string }) {
  const section = useResumeTemplateData().sections[id];
  const items = section.items.filter((item) => !item.hidden);

  return (
    <div className='space-y-6'>
      {items.map((item) => {
        const title = getEntryTitle(item);
        const org = getEntryOrg(item);
        const date = getDate(item);
        const description = sanitizeHtmlFragment(item.description || "");

        return (
          <div key={item.id}>
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0'>
                <h4
                  className='text-[15px] font-bold leading-snug'
                  style={{ color: CARD_TEXT }}
                >
                  {title}
                </h4>
                {org && (
                  <p
                    className='text-[13px] font-semibold italic'
                    style={{ color: CARD_TEXT }}
                  >
                    {org}
                  </p>
                )}
              </div>
              {date && <DatePill>{date}</DatePill>}
            </div>
            {description && (
              <div
                className={cn(
                  "mt-2.5 text-[12px] leading-[1.55]",
                  "[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-4",
                  "[&_p+p]:mt-[var(--resume-paragraph-spacing,0.5rem)]",
                  "[&_a]:underline [&_strong]:font-semibold",
                )}
                style={{ color: CARD_MUTED }}
                dangerouslySetInnerHTML={{ __html: description }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function EducationEntries({ id }: { id: string }) {
  const section = useResumeTemplateData().sections[id];
  const items = section.items.filter((item) => !item.hidden);

  return (
    <div className='space-y-6'>
      {items.map((item) => {
        const degree = item.degree || item.title || item.name || "Untitled";
        const school = item.school || item.institution || item.organization;
        const date = getDate(item);
        const metaLine = [school, date].filter(Boolean).join(" | ");
        const gpa = item.grade || item.gpa;

        return (
          <div key={item.id}>
            <h4
              className='text-[16px] font-bold leading-snug'
              style={{ color: CARD_TEXT }}
            >
              {degree}
            </h4>
            {metaLine && (
              <p
                className='mt-1.5 text-[13px] italic'
                style={{ color: CARD_MUTED }}
              >
                {metaLine}
              </p>
            )}
            {gpa && (
              <span
                className='mt-3 inline-block rounded-full border px-3.5 py-1 text-[12px] italic'
                style={{ borderColor: "rgba(255,255,255,0.4)", color: CARD_MUTED }}
              >
                {String(gpa).toLowerCase().startsWith("gpa") ? gpa : `GPA: ${gpa}`}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SkillPills({ id }: { id: string }) {
  const section = useResumeTemplateData().sections[id];
  const items = section.items.filter((item) => !item.hidden);

  return (
    <div className='space-y-2.5'>
      {items.map((item, index) => {
        const name = item.name || item.title || item.label || "Untitled";
        return (
          <div
            key={item.id}
            className='flex items-center justify-between gap-3 rounded-full px-4 py-2'
            style={{ backgroundColor: pillColor(index, items.length) }}
          >
            <span className='text-[13px] font-medium' style={{ color: PILL_INK }}>
              {name}
            </span>
            <Search className='h-4 w-4 shrink-0' strokeWidth={2.25} style={{ color: PILL_INK }} />
          </div>
        );
      })}
    </div>
  );
}
