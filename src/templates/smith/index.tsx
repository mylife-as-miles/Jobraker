import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  GraduationCap,
  Globe,
  Phone,
  Share2,
  Trophy,
  User,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { sanitizeHtmlFragment } from "../../lib/inputSecurity";
import type { ResumeSectionItem } from "../../store/artboard";
import { PagePicture } from "../shared/page-picture";
import type { TemplateProps } from "../types";
import { useResumeTemplateData } from "../use-resume-template-data";

/**
 * Template: Smith — Coral Classic
 * White page with a rounded dark sidebar (photo, skill/language bars,
 * contact, reference) and a right column with a split-color name and
 * coral-accented timeline sections (education, experience, achievements).
 */

const CORAL = "#EF6A5E";
const SIDEBAR_BG = "#262529";
const INK = "#1F2430";
const BODY = "#6B7280";
const DATE = "#8A8F99";
const SIDE_MUTED = "#CFCDD2";


const SECTION_ICONS: Record<
  string,
  LucideIcon
> = {
  education: GraduationCap,
  experience: Briefcase,
  awards: Trophy,
  skills: Briefcase,
  languages: Globe,
  references: Share2,
  interests: User,
};

const clampLevel = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) return null;
  return Math.max(1, Math.min(5, Math.round(value)));
};

const getItemTitle = (item: ResumeSectionItem) =>
  item.title ||
  item.position ||
  item.role ||
  item.degree ||
  item.company ||
  item.name ||
  item.label ||
  "Untitled";

const getItemDate = (item: ResumeSectionItem) =>
  item.date ||
  item.period ||
  [item.startDate, item.endDate].filter(Boolean).join(" - ");

export function SmithTemplate({ pageIndex = 0 }: TemplateProps) {
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

  // Sidebar: skill/language bars, then the reference block.
  const barSidebar: string[] = [];
  for (const id of ["skills", "languages"]) {
    if (claim(id)) barSidebar.push(id);
  }
  const otherSidebar: string[] = [];
  if (claim("references")) otherSidebar.push("references");

  // Main: education, experience, achievement timelines, then any extras.
  const mainSections: string[] = [];
  for (const id of ["education", "experience", "awards"]) {
    if (claim(id)) mainSections.push(id);
  }
  for (const id of Object.keys(sections)) {
    if (!placed.has(id) && isVisible(id)) {
      placed.add(id);
      mainSections.push(id);
    }
  }

  return (
    <div
      // [&_*]:font-sans out-specifies the app-wide `* { font-family: Questrial }`
      // rule so the name and headings render at real heavy weights.
      className='template-smith flex h-full w-full gap-6 overflow-hidden bg-white p-6 font-sans antialiased [&_*]:font-sans'
      style={{ color: INK }}
    >
      {/* ---------------- Sidebar ---------------- */}
      <aside
        className='flex w-[288px] shrink-0 flex-col rounded-[32px] px-7 pb-8'
        style={{ backgroundColor: SIDEBAR_BG, color: "#FFFFFF" }}
      >
        {isFirstPage && (
          <div className='-mt-10 mb-7'>
            <div
              className='overflow-hidden rounded-[42px] border-[3px]'
              style={{ borderColor: CORAL }}
            >
              <PagePicture className='h-[240px] w-full object-cover' />
            </div>
          </div>
        )}

        <div className='space-y-8'>
          {barSidebar.map((id) => (
            <SidebarBars key={id} id={id} />
          ))}
          {isFirstPage && <ContactBlock />}
          {otherSidebar.map((id) => (
            <SidebarOther key={id} id={id} />
          ))}
        </div>
      </aside>

      {/* ---------------- Main ---------------- */}
      <main className='flex min-w-0 flex-1 flex-col pt-2'>
        {isFirstPage && <Header />}
        <div className='mt-7 space-y-8'>
          {mainSections.map((id) => (
            <TimelineSection key={id} id={id} />
          ))}
        </div>
      </main>
    </div>
  );
}

/* ------------------------------ shared heading ------------------------------ */

function SectionHeading({
  icon: Icon,
  title,
}: {
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className='mb-4 flex items-center gap-3'>
      <span
        className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white'
        style={{ backgroundColor: CORAL }}
      >
        <Icon className='h-4 w-4' strokeWidth={2.25} />
      </span>
      <span
        className='text-[13px] font-extrabold uppercase tracking-[0.18em]'
        style={{ color: CORAL }}
      >
        {title}
      </span>
      <span
        className='h-[1.5px] flex-1 self-center'
        style={{ backgroundColor: `${CORAL}80` }}
      />
    </div>
  );
}

/* -------------------------------- name header ------------------------------- */

function Header() {
  const { basics, summary } = useResumeTemplateData();
  const words = (basics.name || "Your Name").split(/\s+/).filter(Boolean);
  const first = words[0] || "";
  const rest = words.slice(1).join(" ");
  const hasSummary = Boolean(
    summary && !summary.hidden && (summary.content || "").trim(),
  );

  return (
    <div>
      <h1 className='text-[42px] uppercase leading-[1] tracking-[-0.01em]'>
        <span className='font-extrabold' style={{ color: CORAL }}>
          {first}
        </span>
        {rest && (
          <span className='font-extrabold' style={{ color: INK }}>
            {" "}
            {rest}
          </span>
        )}
        <span className='font-extrabold' style={{ color: INK }}>
          .
        </span>
      </h1>
      {basics.headline && (
        <div className='mt-2 border-b-[2px] pb-3' style={{ borderColor: CORAL }}>
          <p
            className='text-[15px] font-semibold uppercase tracking-[0.22em]'
            style={{ color: INK }}
          >
            {basics.headline}
          </p>
        </div>
      )}
      {hasSummary && (
        <div
          className='mt-4 text-[11px] leading-[1.75] [&_a]:underline [&_p+p]:mt-[var(--resume-paragraph-spacing,0.5rem)]'
          style={{ color: BODY }}
          dangerouslySetInnerHTML={{
            __html: sanitizeHtmlFragment(summary.content || ""),
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------- timeline ---------------------------------- */

function TimelineSection({ id }: { id: string }) {
  const section = useResumeTemplateData().sections[id];
  if (!section || section.hidden) return null;

  const visibleItems = section.items.filter((item) => !item.hidden);
  if (!visibleItems.length) return null;

  const Icon = SECTION_ICONS[id] || Trophy;

  return (
    <div className={cn("section-content", `section-${id}`)}>
      <SectionHeading icon={Icon} title={section.title} />
      <div>
        {visibleItems.map((item, index) => (
          <TimelineItem
            key={item.id}
            item={item}
            isLast={index === visibleItems.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function TimelineItem({
  item,
  isLast,
}: {
  item: ResumeSectionItem;
  isLast: boolean;
}) {
  const date = getItemDate(item);
  const title = getItemTitle(item);
  const description = sanitizeHtmlFragment(item.description || "");

  return (
    <div className='grid grid-cols-[82px_20px_minmax(0,1fr)] gap-x-3'>
      <div
        className='pt-[1px] text-right text-[11px] font-medium'
        style={{ color: DATE }}
      >
        {date}
      </div>
      <div className='relative flex justify-center'>
        {!isLast && (
          <span
            className='absolute top-1 bottom-0 w-[1.5px]'
            style={{ backgroundColor: CORAL }}
          />
        )}
        <span
          className='absolute top-[3px] h-[11px] w-[11px] rounded-full border-2 bg-white'
          style={{ borderColor: CORAL }}
        />
      </div>
      <div className={cn(!isLast && "pb-5")}>
        <h4
          className='text-[12px] font-bold uppercase tracking-[0.04em]'
          style={{ color: INK }}
        >
          {title}
        </h4>
        {description && (
          <div
            className='mt-1 text-[10.5px] leading-[1.7] [&_a]:underline [&_p+p]:mt-[var(--resume-paragraph-spacing,0.5rem)]'
            style={{ color: BODY }}
            dangerouslySetInnerHTML={{ __html: description }}
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------- sidebar bars ------------------------------ */

function SidebarBars({ id }: { id: string }) {
  const section = useResumeTemplateData().sections[id];
  if (!section || section.hidden) return null;

  const visibleItems = section.items.filter((item) => !item.hidden);
  if (!visibleItems.length) return null;

  const Icon = SECTION_ICONS[id] || Briefcase;

  return (
    <div>
      <SectionHeading icon={Icon} title={section.title} />
      <div className='space-y-3.5'>
        {visibleItems.map((item) => {
          const level = clampLevel(item.level);
          const pct = level * 20;
          const name = item.name || item.title || item.label || "Untitled";
          return (
            <div key={item.id} className='flex items-center gap-3'>
              <span className='min-w-[104px] text-[11.5px] font-medium text-white'>
                {name}
              </span>
              {level !== null && (
                <>
                  <span
                    className='h-[5px] flex-1 overflow-hidden rounded-full'
                    style={{ backgroundColor: "rgba(255,255,255,0.28)" }}
                  >
                    <span
                      className='block h-full rounded-full'
                      style={{ width: `${pct}%`, backgroundColor: CORAL }}
                    />
                  </span>
                  <span
                    className='w-[34px] shrink-0 text-right text-[11px] font-semibold'
                    style={{ color: SIDE_MUTED }}
                  >
                    {pct}%
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------- contact ----------------------------------- */

function ContactBlock() {
  const basics = useResumeTemplateData().basics;
  const rows = [
    basics.phone ? { label: "Phone:", value: basics.phone } : null,
    basics.email ? { label: "Email:", value: basics.email } : null,
    basics.location ? { label: "Address:", value: basics.location } : null,
    ...basics.customFields.map((field) => ({
      label: `${field.text.split(":")[0]}:`,
      value: field.text,
    })),
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  if (!rows.length) return null;

  return (
    <div>
      <SectionHeading icon={Phone} title='Contact' />
      <div className='space-y-2.5'>
        {rows.map((row) => (
          <div key={row.label}>
            <p
              className='text-[11px] font-bold uppercase tracking-[0.08em]'
              style={{ color: CORAL }}
            >
              {row.label}
            </p>
            <p
              className='text-[11.5px] leading-snug'
              style={{ color: SIDE_MUTED }}
            >
              {row.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- reference --------------------------------- */

function SidebarOther({ id }: { id: string }) {
  const section = useResumeTemplateData().sections[id];
  if (!section || section.hidden) return null;

  const visibleItems = section.items.filter((item) => !item.hidden);
  if (!visibleItems.length) return null;

  const Icon = SECTION_ICONS[id] || Share2;

  return (
    <div>
      <SectionHeading icon={Icon} title={section.title} />
      <div className='space-y-4'>
        {visibleItems.map((item) => {
          const name = item.name || item.title || "Untitled";
          const subtitle = [
            item.position || item.role || item.title,
            item.company || item.organization,
          ]
            .filter((value) => value && value !== name)
            .join(" - ");
          return (
            <div key={item.id}>
              <p className='text-[12.5px] font-bold text-white'>{name}</p>
              {subtitle && (
                <p
                  className='mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]'
                  style={{ color: CORAL }}
                >
                  {subtitle}
                </p>
              )}
              {item.phone && (
                <p
                  className='mt-1 text-[11px]'
                  style={{ color: SIDE_MUTED }}
                >
                  P: {item.phone}
                </p>
              )}
              {item.email && (
                <p className='text-[11px]' style={{ color: SIDE_MUTED }}>
                  E: {item.email}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
