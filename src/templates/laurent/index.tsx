import type React from "react";
import { ArrowUpRight, Camera, PenTool, Shirt } from "lucide-react";
import { cn } from "../../lib/utils";
import { sanitizeHtmlFragment } from "../../lib/inputSecurity";
import type { ResumeSectionItem } from "../../store/artboard";
import { PagePicture } from "../shared/page-picture";
import type { TemplateProps } from "../types";
import { useResumeTemplateData } from "../use-resume-template-data";

/**
 * Template: Laurent — Vertical Editorial
 * A cream page with a giant rotated name running up the left edge, a "HELLO!"
 * greeting beside the photo with a circular text badge, a black contact bar,
 * and bold uppercase section headings with hamburger-line accents.
 */

const CREAM = "#F2EDE1";
const INK = "#0E0E0E";
const BODY = "#3A3A38";

const INTEREST_ICONS = [Shirt, Camera, PenTool];

const getEntryTitle = (item: ResumeSectionItem) =>
  item.position ||
  item.role ||
  item.title ||
  item.degree ||
  item.name ||
  item.label ||
  "Untitled";

const getEntryOrg = (item: ResumeSectionItem) =>
  item.company || item.organization || item.school || item.institution || "";

const getDate = (item: ResumeSectionItem) =>
  item.date ||
  item.period ||
  [item.startDate, item.endDate].filter(Boolean).join(" - ");

export function LaurentTemplate({ pageIndex = 0 }: TemplateProps) {
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

  const leftEntries = ["experience", "projects", "awards", "volunteer"].filter(
    isVisible,
  );
  const rightEntries = ["education", "references", "certifications", "publications"].filter(
    isVisible,
  );
  const hasSkills = isVisible("skills");
  const hasLanguages = isVisible("languages");
  const hasInterests = isVisible("interests");
  const known = new Set([
    "summary",
    "skills",
    "languages",
    "interests",
    ...leftEntries,
    ...rightEntries,
  ]);
  const unknownIds = Object.keys(sections).filter(
    (id) => !known.has(id) && isVisible(id),
  );

  return (
    <div
      // [&_*]:font-sans out-specifies the app-wide `* { font-family: Questrial }`
      // rule so the name and headings render at real heavy weights.
      className='template-laurent flex h-full w-full overflow-hidden font-sans antialiased [&_*]:font-sans'
      style={{ backgroundColor: CREAM, color: INK }}
    >
      {/* Vertical name rail */}
      <div className='relative w-[104px] shrink-0 border-r-2' style={{ borderColor: INK }}>
        <div className='absolute inset-0 flex items-center justify-center'>
          <h1
            className='whitespace-nowrap -rotate-90 text-[56px] font-extrabold uppercase leading-none tracking-[-0.03em]'
            style={{ color: INK }}
          >
            {resumeData.basics.name || "Your Name"}
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className='flex min-w-0 flex-1 flex-col'>
        {isFirstPage && <TopBlock />}
        {isFirstPage && <ContactBar />}

        <div className='grid flex-1 grid-cols-2 gap-x-10 px-8 py-6'>
          {/* Left column */}
          <div className='space-y-7'>
            {leftEntries.map((id) => (
              <Section key={id} title={sections[id].title}>
                <EntryList id={id} />
              </Section>
            ))}
            {unknownIds.map((id) => (
              <Section key={id} title={sections[id].title}>
                <EntryList id={id} />
              </Section>
            ))}
            {hasLanguages && (
              <Section title={sections["languages"].title} hamburger>
                <SimpleList id='languages' />
              </Section>
            )}
          </div>

          {/* Right column */}
          <div className='space-y-7'>
            {rightEntries.map((id) => (
              <Section key={id} title={sections[id].title}>
                <EntryList id={id} />
              </Section>
            ))}
            {hasSkills && (
              <Section title={sections["skills"].title} hamburger>
                <SimpleList id='skills' />
              </Section>
            )}
            {hasInterests && (
              <Section title={sections["interests"].title}>
                <InterestGrid id='interests' />
              </Section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- decorations ------------------------------- */

function Star({ className }: { className?: string }) {
  return (
    <svg viewBox='-50 -50 100 100' className={className} aria-hidden='true'>
      {Array.from({ length: 8 }).map((_, i) => (
        <polygon
          key={i}
          points='0,-46 8,-14 -8,-14'
          fill={INK}
          transform={`rotate(${i * 45})`}
        />
      ))}
      <circle r='14' fill={INK} />
    </svg>
  );
}

function CircularBadge({ label }: { label: string }) {
  const text = `${label} - `.repeat(4);
  return (
    <svg viewBox='0 0 100 100' className='h-24 w-24' aria-hidden='true'>
      <defs>
        <path
          id='laurent-badge'
          d='M 50,50 m -37,0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0'
          fill='none'
        />
      </defs>
      <text style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.5px" }} fill={INK}>
        <textPath href='#laurent-badge'>{text}</textPath>
      </text>
      <path
        d='M 44,56 L 56,44 M 56,44 L 48,44 M 56,44 L 56,52'
        stroke={INK}
        strokeWidth='3'
        strokeLinecap='round'
        strokeLinejoin='round'
        fill='none'
      />
    </svg>
  );
}

function Hamburger() {
  return (
    <div className='flex flex-col items-start gap-1.5'>
      <span className='h-[6px] w-11 rounded-full' style={{ backgroundColor: INK }} />
      <span className='h-[6px] w-8 rounded-full' style={{ backgroundColor: INK }} />
      <span className='h-[6px] w-12 rounded-full' style={{ backgroundColor: INK }} />
    </div>
  );
}

/* --------------------------------- top block -------------------------------- */

function TopBlock() {
  const { basics, summary } = useResumeTemplateData();
  const hasSummary = Boolean(
    summary && !summary.hidden && (summary.content || "").trim(),
  );

  return (
    <div className='relative px-8 pb-6 pt-8'>
      <div className='flex gap-7'>
        <div className='relative shrink-0'>
          <div
            className='overflow-hidden rounded-[6px] border'
            style={{ borderColor: INK }}
          >
            <PagePicture className='h-[320px] w-[236px] object-cover grayscale' />
          </div>
          <Star className='absolute -bottom-3 -left-3 h-11 w-11' />
        </div>

        <div className='relative flex flex-1 flex-col'>
          <div className='flex items-start justify-between'>
            {basics.headline ? (
              <CircularBadge label={basics.headline} />
            ) : (
              <span />
            )}
            <ArrowUpRight className='h-14 w-14' strokeWidth={3} style={{ color: INK }} />
          </div>
          <h2 className='mt-1 text-[68px] font-extrabold uppercase leading-[0.9] tracking-[-0.02em]'>
            Hello !
          </h2>
          {hasSummary && (
            <div
              className='mt-4 text-right text-[13px] leading-[1.6] [&_a]:underline [&_p+p]:mt-[var(--resume-paragraph-spacing,0.5rem)]'
              style={{ color: BODY }}
              dangerouslySetInnerHTML={{
                __html: sanitizeHtmlFragment(summary.content || ""),
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ContactBar() {
  const basics = useResumeTemplateData().basics;
  const handle = basics.website?.label || basics.website?.url;
  const items = [basics.phone, basics.email, handle].filter(Boolean) as string[];

  if (!items.length) return null;

  return (
    <div
      className='flex items-center gap-8 px-8 py-3.5 text-white'
      style={{ backgroundColor: INK }}
    >
      <span className='text-[22px] font-extrabold uppercase italic tracking-[0.02em]'>
        Contact
      </span>
      <div className='flex flex-1 items-center justify-around gap-4 text-[13px] font-medium'>
        {items.map((item) => (
          <span key={item} className='truncate'>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- sections --------------------------------- */

function Section({
  title,
  hamburger,
  children,
}: {
  title: string;
  hamburger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className='section-content'>
      <h3 className='mb-3 text-[24px] font-extrabold uppercase tracking-[-0.01em]'>
        {title}
      </h3>
      {hamburger ? (
        <div className='flex items-start justify-between gap-4'>
          <div className='min-w-0 flex-1'>{children}</div>
          <div className='mt-1 shrink-0'>
            <Hamburger />
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function EntryList({ id }: { id: string }) {
  const section = useResumeTemplateData().sections[id];
  const items = section.items.filter((item) => !item.hidden);

  return (
    <div className='space-y-4'>
      {items.map((item) => {
        const title = getEntryTitle(item);
        const org = getEntryOrg(item);
        const date = getDate(item);
        const description = sanitizeHtmlFragment(item.description || "");

        return (
          <div key={item.id}>
            <div className='flex items-start justify-between gap-3'>
              <h4 className='text-[14px] font-bold leading-snug' style={{ color: INK }}>
                {title}
                {org && <span className='block'>{org}</span>}
              </h4>
              {date && (
                <span
                  className='shrink-0 text-[12px] italic'
                  style={{ color: BODY }}
                >
                  {date}
                </span>
              )}
            </div>
            {description && (
              <div
                className={cn(
                  "mt-1.5 text-[12px] leading-[1.55]",
                  "[&_ul]:list-none [&_ul]:space-y-1 [&_ul]:pl-0",
                  "[&_p+p]:mt-[var(--resume-paragraph-spacing,0.5rem)]",
                  "[&_a]:underline",
                )}
                style={{ color: BODY }}
                dangerouslySetInnerHTML={{ __html: description }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SimpleList({ id }: { id: string }) {
  const section = useResumeTemplateData().sections[id];
  const items = section.items.filter((item) => !item.hidden);

  return (
    <div className='space-y-0.5 text-[13px]' style={{ color: BODY }}>
      {items.map((item) => (
        <p key={item.id}>{item.name || item.title || item.label}</p>
      ))}
    </div>
  );
}

function InterestGrid({ id }: { id: string }) {
  const section = useResumeTemplateData().sections[id];
  const items = section.items.filter((item) => !item.hidden);

  return (
    <div className='flex flex-wrap gap-x-5 gap-y-4'>
      {items.map((item, index) => {
        const Icon = INTEREST_ICONS[index % INTEREST_ICONS.length];
        return (
          <div key={item.id} className='flex w-[84px] flex-col items-center text-center'>
            <span
              className='flex h-11 w-11 items-center justify-center rounded-full'
              style={{ backgroundColor: "#E4DECF" }}
            >
              <Icon className='h-5 w-5' strokeWidth={2} style={{ color: INK }} />
            </span>
            <span className='mt-1.5 text-[11px] leading-tight' style={{ color: BODY }}>
              {item.name || item.title || item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
