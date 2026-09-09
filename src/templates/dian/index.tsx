import { Minus, Square, X } from "lucide-react";
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
 * Template: Dian — Neo-Brutalist
 * A paper-beige page with thick black strokes, squared corners, solid accent
 * blocks (teal / magenta / yellow) and hard offset shadows. A window-chrome
 * header, an accent contact bar, dot-bullet experience/education, black
 * language bars, and a two-column skills list.
 */

const PAPER = "#F1EEDE";
const YELLOW = "#F7CE00";
const TEAL = "#00C2CB";
const MAGENTA = "#EC1FE0";
const BLACK = "#111111";
const WHITE = "#FFFFFF";
const BODY = "#2A2A28";

const CARD_SHADOW = "6px 6px 0 #111111";
const PILL_SHADOW = "4px 4px 0 #111111";

const ACCENT: Record<string, string> = {
  experience: YELLOW,
  education: TEAL,
  languages: MAGENTA,
  skills: YELLOW,
  interests: TEAL,
  references: MAGENTA,
  projects: TEAL,
  awards: MAGENTA,
  certifications: TEAL,
  publications: MAGENTA,
  volunteer: YELLOW,
};
const accentFor = (id: string) => ACCENT[id] || YELLOW;

const clampLevel = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) return null;
  return Math.max(1, Math.min(5, Math.round(value)));
};

const getPrimary = (item: ResumeSectionItem) =>
  item.position ||
  item.role ||
  item.title ||
  item.company ||
  item.school ||
  item.name ||
  "Untitled";

const getOrg = (item: ResumeSectionItem) =>
  item.company || item.organization || item.school || item.institution || "";

const getDate = (item: ResumeSectionItem) =>
  item.date ||
  item.period ||
  [item.startDate, item.endDate].filter(Boolean).join(" - ");

export function DianTemplate({ pageIndex = 0 }: TemplateProps) {
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

  const leftIds = ["experience", "projects", "awards", "education", "volunteer"].filter(
    isVisible,
  );
  const rightIds = ["languages", "skills", "interests", "references", "certifications", "publications"].filter(
    isVisible,
  );
  const known = new Set(["summary", ...leftIds, ...rightIds]);
  const unknownIds = Object.keys(sections).filter(
    (id) => !known.has(id) && isVisible(id),
  );

  return (
    <div
      // [&_*]:font-sans out-specifies the app-wide `* { font-family: Questrial }`
      // rule so the name and headings render at real heavy weights.
      className='template-dian h-full w-full overflow-hidden p-5 font-sans antialiased [&_*]:font-sans'
      style={{ backgroundColor: PAPER, color: BLACK }}
    >
      <div className='flex h-full flex-col gap-4'>
        {isFirstPage && <HeaderCard />}
        {isFirstPage && <ContactBar />}

        <div
          className='flex-1 border-[3px] p-6'
          style={{ borderColor: BLACK, backgroundColor: PAPER, boxShadow: CARD_SHADOW }}
        >
          <div className='grid grid-cols-2 gap-x-8 gap-y-6'>
            <div className='space-y-6'>
              {leftIds.map((id) => (
                <EntrySection key={id} id={id} />
              ))}
            </div>
            <div className='space-y-6'>
              {rightIds.map((id) =>
                id === "languages" ? (
                  <BarSection key={id} id={id} />
                ) : id === "skills" || id === "interests" ? (
                  <PillGridSection key={id} id={id} />
                ) : (
                  <EntrySection key={id} id={id} />
                ),
              )}
              {unknownIds.map((id) => (
                <EntrySection key={id} id={id} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- primitives ------------------------------- */

function AccentHeading({ id, title }: { id: string; title: string }) {
  return (
    <div
      className='mb-4 inline-block border-[3px] px-5 py-1.5 text-[15px] font-extrabold uppercase tracking-[0.04em]'
      style={{ borderColor: BLACK, backgroundColor: accentFor(id), boxShadow: PILL_SHADOW }}
    >
      {title}
    </div>
  );
}

function WindowChrome() {
  return (
    <div className='flex items-center gap-2'>
      <Minus className='h-4 w-4' strokeWidth={2.5} />
      <Square className='h-3.5 w-3.5' strokeWidth={2.5} />
      <X className='h-4 w-4' strokeWidth={2.5} />
    </div>
  );
}

/* --------------------------------- header ----------------------------------- */

function HeaderCard() {
  const { basics, summary } = useResumeTemplateData();
  const hasSummary = Boolean(
    summary && !summary.hidden && (summary.content || "").trim(),
  );

  return (
    <div
      className='relative border-[3px] p-6'
      style={{ borderColor: BLACK, backgroundColor: WHITE, boxShadow: CARD_SHADOW }}
    >
      <div className='absolute right-5 top-4'>
        <WindowChrome />
      </div>
      <div className='flex items-start gap-6'>
        <div
          className='h-[150px] w-[150px] shrink-0 overflow-hidden rounded-full border-[3px]'
          style={{ borderColor: BLACK, backgroundColor: PAPER }}
        >
          <PagePicture className='h-full w-full object-cover' />
        </div>
        <div className='min-w-0 flex-1 pt-2'>
          <h1 className='text-[46px] font-extrabold leading-[0.95] tracking-[-0.02em]'>
            {basics.name || "Your Name"}
          </h1>
          {hasSummary && (
            <div
              className='mt-3 text-[12.5px] leading-[1.55] [&_a]:underline [&_p+p]:mt-[var(--resume-paragraph-spacing,0.5rem)]'
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
  const websiteUrl = basics.website?.url || "";
  const websiteHref = getSafeExternalHref(
    websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`,
  );
  const items = [
    basics.phone
      ? { color: TEAL, text: basics.phone, href: `tel:${basics.phone.replace(/\s+/g, "")}` }
      : null,
    websiteUrl
      ? { color: MAGENTA, text: basics.website?.label || websiteUrl, href: websiteHref || undefined }
      : null,
    basics.email
      ? { color: YELLOW, text: basics.email, href: `mailto:${basics.email}` }
      : null,
    basics.location ? { color: TEAL, text: basics.location, href: undefined } : null,
  ].filter(Boolean) as Array<{ color: string; text: string; href?: string }>;

  if (!items.length) return null;

  return (
    <div
      className='flex flex-wrap items-center gap-x-6 gap-y-3 border-[3px] px-5 py-3'
      style={{ borderColor: BLACK, backgroundColor: WHITE, boxShadow: CARD_SHADOW }}
    >
      {items.map((item) => {
        const content = (
          <>
            <span
              className='h-6 w-6 shrink-0 border-2'
              style={{ borderColor: BLACK, backgroundColor: item.color }}
            />
            <span className='text-[13px] font-bold'>{item.text}</span>
          </>
        );
        return item.href ? (
          <a
            key={item.text}
            href={item.href}
            target={item.href.startsWith("http") ? "_blank" : undefined}
            rel='noopener noreferrer'
            className='flex items-center gap-2.5 hover:underline'
          >
            {content}
          </a>
        ) : (
          <div key={item.text} className='flex items-center gap-2.5'>
            {content}
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------- sections --------------------------------- */

function EntrySection({ id }: { id: string }) {
  const section = useResumeTemplateData().sections[id];
  if (!section || section.hidden) return null;
  const items = section.items.filter((item) => !item.hidden);
  if (!items.length) return null;

  const accent = accentFor(id);

  return (
    <div className={cn("section-content", `section-${id}`)}>
      <AccentHeading id={id} title={section.title} />
      <div className='space-y-4'>
        {items.map((item) => {
          const isEdu = id === "education";
          const primary = isEdu
            ? item.school || item.institution || item.degree || item.name || "Untitled"
            : getPrimary(item);
          const rawOrg = isEdu ? item.degree || "" : getOrg(item);
          const org = rawOrg && rawOrg !== primary ? rawOrg : "";
          const date = getDate(item);
          const extra = item.grade || item.gpa;
          const description = sanitizeHtmlFragment(item.description || "");

          return (
            <div key={item.id} className='flex gap-3'>
              <span
                className='mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2'
                style={{ borderColor: BLACK, backgroundColor: accent }}
              />
              <div className='min-w-0'>
                {date && (
                  <p className='text-[11.5px] italic' style={{ color: BODY }}>
                    {date}
                  </p>
                )}
                <h4 className='text-[16px] font-extrabold leading-tight'>
                  {primary}
                </h4>
                {org && (
                  <p className='text-[12.5px] font-bold' style={{ color: BLACK }}>
                    {org}
                  </p>
                )}
                {item.location && (
                  <p className='text-[12px]' style={{ color: BODY }}>
                    {item.location}
                  </p>
                )}
                {extra && (
                  <p className='text-[12px] font-bold' style={{ color: BLACK }}>
                    {String(extra).toLowerCase().startsWith("gpa") ? extra : `GPA ${extra}`}
                  </p>
                )}
                {description && (
                  <div
                    className={cn(
                      "mt-1 text-[11.5px] leading-[1.5]",
                      "[&_ul]:list-disc [&_ul]:space-y-0.5 [&_ul]:pl-4",
                      "[&_p+p]:mt-[var(--resume-paragraph-spacing,0.5rem)]",
                      "[&_a]:underline",
                    )}
                    style={{ color: BODY }}
                    dangerouslySetInnerHTML={{ __html: description }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BarSection({ id }: { id: string }) {
  const section = useResumeTemplateData().sections[id];
  if (!section || section.hidden) return null;
  const items = section.items.filter((item) => !item.hidden);
  if (!items.length) return null;

  return (
    <div className={cn("section-content", `section-${id}`)}>
      <AccentHeading id={id} title={section.title} />
      <div className='space-y-3'>
        {items.map((item) => {
          const level = clampLevel(item.level);
          const name = item.name || item.title || item.label || "Untitled";
          return (
            <div key={item.id} className='flex items-center gap-3'>
              <span className='min-w-[92px] text-[13px] font-extrabold'>
                {name}
              </span>
              {level !== null && (
                <span
                  className='relative h-5 flex-1 border-[3px]'
                  style={{ borderColor: BLACK, backgroundColor: WHITE }}
                >
                  <span
                    className='block h-full'
                    style={{ width: `${level * 20}%`, backgroundColor: BLACK }}
                  />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PillGridSection({ id }: { id: string }) {
  const section = useResumeTemplateData().sections[id];
  if (!section || section.hidden) return null;
  const items = section.items.filter((item) => !item.hidden);
  if (!items.length) return null;

  const accent = accentFor(id);

  return (
    <div className={cn("section-content", `section-${id}`)}>
      <AccentHeading id={id} title={section.title} />
      <div className='grid grid-cols-2 gap-x-5 gap-y-2'>
        {items.map((item) => {
          const name = item.name || item.title || item.label || "Untitled";
          return (
            <div key={item.id} className='flex items-center gap-2'>
              <span
                className='h-3 w-3 shrink-0 border-2'
                style={{ borderColor: BLACK, backgroundColor: accent }}
              />
              <span className='text-[12.5px] font-semibold leading-tight'>
                {name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
