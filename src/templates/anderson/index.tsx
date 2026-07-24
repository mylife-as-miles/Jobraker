import type React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Home,
  Mail,
  Maximize2,
  Minus,
  MousePointer2,
  PenTool,
  Phone,
  Ruler,
  Search,
  Type as TypeIcon,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { sanitizeHtmlFragment } from "../../lib/inputSecurity";
import type { ResumeSectionItem } from "../../store/artboard";
import { PagePicture } from "../shared/page-picture";
import type { TemplateProps } from "../types";
import { useResumeTemplateData } from "../use-resume-template-data";

/**
 * Template: Anderson — Retro Desktop
 * A pixel/OS-window styled CV: mint background, cream and tan window panels
 * with title-bar chrome, a monospace face, a floating tool palette, green
 * dot-rated skills, and windowed Experience / Education / Reference panels.
 */

const MINT = "#A9D6B9";
const MINT_CARD = "#A2D2B2";
const CREAM = "#F4EFDF";
const CREAM_BAR = "#E9E2CB";
const TAN = "#F0CE84";
const INK = "#1B1B1B";
const GREEN_DOT = "#5AA88A";
const DOT_EMPTY = "#DFD5B7";

const SHADOW = "3px 3px 0 #1B1B1B";

const DOT_SECTIONS = new Set(["skills", "languages"]);
const RIGHT_EXTRA_ORDER = [
  "projects",
  "awards",
  "certifications",
  "publications",
  "volunteer",
];

const clampLevel = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 4;
  return Math.max(1, Math.min(5, Math.round(value)));
};

const yearOf = (item: ResumeSectionItem) => {
  const raw =
    item.date ||
    item.period ||
    item.endDate ||
    item.startDate ||
    "";
  const match = String(raw).match(/\d{4}/g);
  return match ? match[match.length - 1] : "";
};

const dateOf = (item: ResumeSectionItem) =>
  item.date ||
  item.period ||
  [item.startDate, item.endDate].filter(Boolean).join(" - ");

export function AndersonTemplate({ pageIndex = 0 }: TemplateProps) {
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

  const rightExtras = RIGHT_EXTRA_ORDER.filter(isVisible);
  const known = new Set([
    "summary",
    "experience",
    "education",
    "skills",
    "languages",
    "references",
    ...rightExtras,
  ]);
  const unknownEntries = Object.keys(sections).filter(
    (id) => !known.has(id) && isVisible(id),
  );

  return (
    <div
      className='template-anderson h-full w-full overflow-hidden p-4 font-mono antialiased [&_*]:font-mono'
      style={{ backgroundColor: MINT, color: INK }}
    >
      <TitleBar />

      <div className='mt-3 flex gap-2' style={{ height: "calc(100% - 3.5rem)" }}>
        <div
          className='relative flex-1 overflow-hidden border-[2.5px] p-4'
          style={{ borderColor: INK, backgroundColor: MINT }}
        >
          {isFirstPage && <SectionBar title='Profile' />}

          {isFirstPage && <HeaderBlock />}

          <div className='mt-4 grid grid-cols-2 gap-4'>
            {/* Left column */}
            <div className='flex flex-col gap-4'>
              {isVisible("skills") && <DotWindow id='skills' tail />}
              {isVisible("languages") && <DotWindow id='languages' />}
              {isVisible("education") && <EducationWindow />}
              {isFirstPage && <PortfolioLine />}
            </div>

            {/* Right column */}
            <div className='flex flex-col gap-4'>
              {isVisible("experience") && (
                <WindowCard id='experience' chrome='os' />
              )}
              {rightExtras.map((id) => (
                <WindowCard key={id} id={id} chrome='os' />
              ))}
              {unknownEntries.map((id) => (
                <WindowCard key={id} id={id} chrome='os' />
              ))}
              {isFirstPage && <ReferenceBlock />}
            </div>
          </div>
        </div>

        <Scrollbar />
      </div>
    </div>
  );
}

/* -------------------------------- window chrome ----------------------------- */

function TitleBar() {
  return (
    <div
      className='flex items-center justify-between rounded-[4px] border-[2.5px] px-4 py-2'
      style={{ borderColor: INK, backgroundColor: CREAM, boxShadow: SHADOW }}
    >
      <div className='flex items-center gap-2'>
        {[0, 1].map((i) => (
          <span
            key={i}
            className='h-4 w-4 rounded-full border-2'
            style={{ borderColor: INK }}
          />
        ))}
      </div>
      <span className='text-[16px] font-extrabold uppercase tracking-[0.14em]'>
        Curriculum Vitae
      </span>
      <div className='flex items-center gap-2'>
        <Minus className='h-4 w-4' strokeWidth={2.5} />
        <Copy className='h-3.5 w-3.5' strokeWidth={2.5} />
        <X className='h-4 w-4' strokeWidth={2.75} />
      </div>
    </div>
  );
}

function SectionBar({ title }: { title: string }) {
  return (
    <div
      className='relative flex items-center justify-center rounded-[4px] border-[2px] px-5 py-2.5'
      style={{ borderColor: INK, backgroundColor: CREAM_BAR }}
    >
      <span className='text-[15px] font-extrabold uppercase tracking-[0.16em]'>
        {title}
      </span>
      <Maximize2
        className='absolute right-4 h-4 w-4'
        strokeWidth={2.5}
      />
    </div>
  );
}

function Scrollbar() {
  return (
    <div
      className='flex w-8 shrink-0 flex-col border-[2.5px]'
      style={{ borderColor: INK, backgroundColor: CREAM }}
    >
      <div className='flex h-7 items-center justify-center border-b-[2px]' style={{ borderColor: INK }}>
        <ChevronRight className='h-4 w-4 -rotate-90' strokeWidth={3} />
      </div>
      <div className='relative flex-1'>
        <div
          className='absolute left-1/2 top-6 h-24 w-3 -translate-x-1/2 rounded-[2px] border-2'
          style={{ borderColor: INK, backgroundColor: CREAM_BAR }}
        />
        <div
          className='absolute bottom-16 left-1/2 h-16 w-3 -translate-x-1/2 rounded-[2px] border-2'
          style={{ borderColor: INK, backgroundColor: CREAM_BAR }}
        />
      </div>
      <div className='flex h-7 items-center justify-center border-t-[2px]' style={{ borderColor: INK }}>
        <ChevronRight className='h-4 w-4 rotate-90' strokeWidth={3} />
      </div>
    </div>
  );
}

/* --------------------------------- header ----------------------------------- */

function Toolbar() {
  const tools = [MousePointer2, PenTool, TypeIcon, Search, Ruler, Copy];
  return (
    <div
      className='absolute -left-1 top-1 z-20 w-[92px] rounded-[6px] border-[2.5px] px-2 pb-3 pt-2'
      style={{ borderColor: INK, backgroundColor: TAN, boxShadow: SHADOW }}
    >
      <div className='mb-2 flex justify-end'>
        <X className='h-3 w-3' strokeWidth={3} />
      </div>
      <div className='grid grid-cols-2 gap-y-3 gap-x-2 place-items-center'>
        {tools.map((Icon, i) => (
          <Icon key={i} className='h-5 w-5' strokeWidth={2} />
        ))}
      </div>
    </div>
  );
}

function HeaderBlock() {
  const basics = useResumeTemplateData().basics;
  const contact = [
    basics.location ? { icon: Home, text: basics.location } : null,
    basics.email ? { icon: Mail, text: basics.email } : null,
    basics.phone ? { icon: Phone, text: basics.phone } : null,
  ].filter(Boolean) as Array<{ icon: typeof Home; text: string }>;

  return (
    <div className='relative mt-4'>
      <Toolbar />
      <div className='flex items-start justify-between gap-4 pl-[104px]'>
        <div className='min-w-0 pt-1'>
          <h1 className='text-[34px] font-extrabold uppercase leading-none tracking-[0.01em]'>
            {basics.name || "Your Name"}
          </h1>
          {basics.headline && (
            <p className='mt-2 text-[20px] font-bold'>{basics.headline}</p>
          )}
          <div className='mt-5 space-y-3'>
            {contact.map((row) => {
              const Icon = row.icon;
              return (
                <div key={row.text} className='flex items-center gap-3'>
                  <Icon className='h-5 w-5 shrink-0' strokeWidth={2.25} />
                  <span className='text-[13px] font-medium'>{row.text}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div
          className='h-[150px] w-[150px] shrink-0 overflow-hidden rounded-full border-[2.5px]'
          style={{ borderColor: INK, backgroundColor: CREAM }}
        >
          <PagePicture className='h-full w-full object-cover' />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- dot window -------------------------------- */

function DotWindow({ id, tail }: { id: string; tail?: boolean }) {
  const section = useResumeTemplateData().sections[id];
  if (!section || section.hidden) return null;
  const items = section.items.filter((item) => !item.hidden);
  if (!items.length) return null;

  return (
    <div
      className='relative rounded-[10px] border-[2.5px] p-4'
      style={{ borderColor: INK, backgroundColor: CREAM, boxShadow: SHADOW }}
    >
      {tail && (
        <div
          className='absolute -top-[10px] left-10 h-4 w-4 rotate-45 border-l-[2.5px] border-t-[2.5px]'
          style={{ borderColor: INK, backgroundColor: CREAM }}
        />
      )}
      <div className='space-y-2'>
        {items.map((item) => {
          const level = clampLevel(item.level);
          const name = item.name || item.title || item.label || "Untitled";
          return (
            <div key={item.id} className='flex items-center justify-between gap-3'>
              <span className='text-[12.5px] font-bold'>{name}</span>
              <span className='flex gap-1'>
                {[1, 2, 3, 4, 5].map((dot) => (
                  <span
                    key={dot}
                    className='h-[9px] w-[9px] rounded-full'
                    style={{
                      backgroundColor: dot <= level ? GREEN_DOT : DOT_EMPTY,
                    }}
                  />
                ))}
              </span>
            </div>
          );
        })}
      </div>
      <div className='mt-4 flex items-center gap-2'>
        <div
          className='flex-1 rounded-[4px] border-[2px] py-2 text-center text-[13px] font-extrabold uppercase tracking-[0.14em]'
          style={{ borderColor: INK, backgroundColor: CREAM_BAR }}
        >
          {section.title}
        </div>
        <div
          className='flex h-9 w-9 items-center justify-center rounded-[4px] border-[2px]'
          style={{ borderColor: INK, backgroundColor: CREAM_BAR }}
        >
          <PenTool className='h-4 w-4' strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ education window ---------------------------- */

function EducationWindow() {
  const section = useResumeTemplateData().sections["education"];
  if (!section || section.hidden) return null;
  const items = section.items.filter((item) => !item.hidden);
  if (!items.length) return null;

  return (
    <div
      className='overflow-hidden rounded-[8px] border-[2.5px]'
      style={{ borderColor: INK, backgroundColor: MINT_CARD, boxShadow: SHADOW }}
    >
      <div
        className='flex items-center justify-between border-b-[2.5px] px-3 py-2'
        style={{ borderColor: INK }}
      >
        <ChevronLeft className='h-4 w-4' strokeWidth={3} />
        <span className='text-[13px] font-extrabold uppercase tracking-[0.16em]'>
          {section.title}
        </span>
        <ChevronRight className='h-4 w-4' strokeWidth={3} />
      </div>
      <div className='space-y-3 p-4'>
        {items.map((item) => {
          const degree = item.degree || item.title || item.name || "Untitled";
          const year = yearOf(item);
          const school = item.school || item.institution || item.organization;
          return (
            <div key={item.id}>
              <p className='text-[14px] font-extrabold leading-snug'>
                {degree}
                {year ? ` (${year})` : ""}
              </p>
              {school && <p className='text-[12.5px]'>{school}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------- window card -------------------------------- */

function WindowCard({ id }: { id: string; chrome?: "os" }) {
  const section = useResumeTemplateData().sections[id];
  if (!section || section.hidden) return null;
  const items = section.items.filter((item) => !item.hidden);
  if (!items.length) return null;

  return (
    <div
      className='overflow-hidden rounded-[6px] border-[2.5px]'
      style={{ borderColor: INK, backgroundColor: TAN, boxShadow: SHADOW }}
    >
      <div
        className='flex items-center justify-between border-b-[2.5px] px-4 py-2'
        style={{ borderColor: INK }}
      >
        <span className='text-[14px] font-extrabold uppercase tracking-[0.12em]'>
          {section.title}
        </span>
        <div className='flex items-center gap-2'>
          <Minus className='h-3.5 w-3.5' strokeWidth={2.5} />
          <Copy className='h-3 w-3' strokeWidth={2.5} />
          <span
            className='flex h-5 w-5 items-center justify-center rounded-[3px] border-2'
            style={{ borderColor: INK, backgroundColor: INK }}
          >
            <X className='h-3 w-3 text-white' strokeWidth={3} />
          </span>
        </div>
      </div>
      <div className='space-y-4 p-4'>
        {items.map((item) => {
          const title =
            item.position || item.role || item.title || item.name || "Untitled";
          const company =
            item.company || item.organization || item.institution || "";
          const date = dateOf(item);
          const metaLine = [company, date].filter(Boolean).join(" | ");
          const description = sanitizeHtmlFragment(item.description || "");

          return (
            <div key={item.id}>
              <h4 className='text-[15px] font-extrabold leading-snug'>
                {title}
              </h4>
              {metaLine && (
                <p className='mt-0.5 text-[12.5px] font-medium leading-snug'>
                  {metaLine}
                </p>
              )}
              {description && (
                <div
                  className={cn(
                    "mt-2 text-[12px] leading-[1.6]",
                    "[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
                    "[&_p+p]:mt-[var(--resume-paragraph-spacing,0.5rem)]",
                    "[&_a]:underline [&_strong]:font-bold",
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

/* --------------------------- portfolio + reference -------------------------- */

function PortfolioLine() {
  const basics = useResumeTemplateData().basics;
  const site = basics.website?.label || basics.website?.url;
  if (!site) return null;
  return (
    <p className='mt-1 text-[14px] font-extrabold'>
      Portfolio: <span className='font-bold'>{site}</span>
    </p>
  );
}

function ReferenceBlock() {
  const section = useResumeTemplateData().sections["references"];
  if (!section || section.hidden) return null;
  const items = section.items.filter((item) => !item.hidden);
  if (!items.length) return null;

  return (
    <div className='mt-1'>
      <h4 className='mb-2 text-[16px] font-extrabold uppercase tracking-[0.1em]'>
        Reference
      </h4>
      <div className='space-y-3'>
        {items.map((item) => {
          const name = item.name || item.title || "Untitled";
          const role = [
            item.position || item.role || item.title,
            item.company || item.organization,
          ]
            .filter((value) => value && value !== name)
            .join(", ");
          return (
            <div key={item.id}>
              <p className='text-[15px] font-extrabold'>{name}</p>
              {role && <p className='text-[13px] font-bold'>{role}</p>}
              {item.email && (
                <p className='text-[12.5px]'>Email: {item.email}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
