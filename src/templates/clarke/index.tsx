import type React from "react";
import { Mail, MapPin, Phone, Send } from "lucide-react";
import { cn } from "../../lib/utils";
import { sanitizeHtmlFragment } from "../../lib/inputSecurity";
import type { ResumeSectionItem } from "../../store/artboard";
import { PagePicture } from "../shared/page-picture";
import type { TemplateProps } from "../types";
import { useResumeTemplateData } from "../use-resume-template-data";

/**
 * Template: Clarke — Lime Bento
 * Light warm-gray page with black-outlined rounded cards: a huge black name
 * beside a lime-framed photo, an outlined headline pill, a lime Profile card
 * (summary + contact), white Work Experience / Education cards, a lime
 * Reference card, and a Skills card of outlined pills.
 */

const LIME = "#C4EA2C";
const INK = "#141414";
const BODY = "#52525B";
const CARD_WHITE = "#FFFFFF";
const PAGE_BG = "#E8E7E2";

const LEFT_EXTRA_ORDER = ["languages", "interests"];
const RIGHT_EXTRA_ORDER = [
  "projects",
  "awards",
  "certifications",
  "publications",
  "volunteer",
];

const getPrimary = (item: ResumeSectionItem) =>
  item.company ||
  item.school ||
  item.organization ||
  item.institution ||
  item.name ||
  item.title ||
  item.label ||
  "Untitled";

const getSubtitle = (item: ResumeSectionItem) => {
  const primary = getPrimary(item);
  const candidates = [
    item.position,
    item.role,
    item.title,
    item.degree,
    item.area,
    item.field,
  ].filter(Boolean) as string[];
  return candidates.find((value) => value !== primary) || "";
};

const getDate = (item: ResumeSectionItem) =>
  item.date ||
  item.period ||
  [item.startDate, item.endDate].filter(Boolean).join(" - ");

export function ClarkeTemplate({ pageIndex = 0 }: TemplateProps) {
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

  const leftExtras = LEFT_EXTRA_ORDER.filter(isVisible);
  const rightExtras = RIGHT_EXTRA_ORDER.filter(isVisible);
  const known = new Set([
    "summary",
    "experience",
    "education",
    "references",
    "skills",
    ...leftExtras,
    ...rightExtras,
  ]);
  const unknownEntries = Object.keys(sections).filter(
    (id) => !known.has(id) && isVisible(id),
  );

  return (
    <div
      // [&_*]:font-sans out-specifies the app-wide `* { font-family: Questrial }`
      // rule so the name and headings render at real heavy weights.
      className='template-clarke h-full w-full overflow-hidden px-9 py-8 font-sans antialiased [&_*]:font-sans'
      style={{ backgroundColor: PAGE_BG, color: INK }}
    >
      {isFirstPage && <Header />}

      <div className='mt-5 grid grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] gap-5'>
        {/* Left column */}
        <div className='flex flex-col gap-5'>
          {isFirstPage && <ProfileCard />}
          {isVisible("education") && (
            <EntryCard id='education' variant='white' />
          )}
          {isVisible("references") && (
            <EntryCard id='references' variant='lime' />
          )}
          {leftExtras.map((id) => (
            <PillsCard key={id} id={id} />
          ))}
        </div>

        {/* Right column */}
        <div className='flex flex-col gap-5'>
          {isVisible("experience") && (
            <EntryCard id='experience' variant='white' />
          )}
          {rightExtras.map((id) => (
            <EntryCard key={id} id={id} variant='white' />
          ))}
          {unknownEntries.map((id) => (
            <EntryCard key={id} id={id} variant='white' />
          ))}
          {isVisible("skills") && <PillsCard id='skills' />}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- header ---------------------------------- */

function Header() {
  const basics = useResumeTemplateData().basics;
  const words = (basics.name || "Your Name").split(/\s+/).filter(Boolean);

  return (
    <div className='flex items-start justify-between gap-6'>
      <div className='min-w-0 pt-1'>
        <h1 className='text-[64px] uppercase leading-[0.86] tracking-[-0.02em]'>
          {words.map((word, index) => (
            <span key={`${word}-${index}`} className='block font-extrabold'>
              {word}
            </span>
          ))}
        </h1>
        <div className='mt-5 flex items-center gap-3'>
          {basics.headline && (
            <span
              className='inline-flex items-center rounded-[12px] border-2 bg-white px-5 py-2.5 text-[13px] font-bold uppercase tracking-[0.06em]'
              style={{ borderColor: INK, color: INK }}
            >
              {basics.headline}
            </span>
          )}
          <span
            className='inline-flex h-[42px] w-[42px] items-center justify-center rounded-[12px] border-2'
            style={{ borderColor: INK, backgroundColor: LIME }}
          >
            <Send className='h-4 w-4' strokeWidth={2.25} style={{ color: INK }} />
          </span>
        </div>
      </div>

      <div
        className='shrink-0 rounded-[20px] p-1.5'
        style={{ backgroundColor: LIME }}
      >
        <PagePicture className='h-[190px] w-[180px] rounded-[14px] object-cover' />
      </div>
    </div>
  );
}

/* --------------------------------- containers ------------------------------- */

function Card({
  variant = "white",
  className,
  children,
}: {
  variant?: "white" | "lime";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("rounded-[20px] border-2 p-5", className)}
      style={{
        borderColor: INK,
        backgroundColor: variant === "lime" ? LIME : CARD_WHITE,
      }}
    >
      {children}
    </div>
  );
}

function CardHeading({
  children,
  extra,
}: {
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div className='mb-3 flex items-center justify-between gap-2'>
      <h6
        className='text-[15px] font-extrabold uppercase tracking-[0.02em]'
        style={{ color: INK }}
      >
        {children}
      </h6>
      {extra}
    </div>
  );
}

/* -------------------------------- profile card ------------------------------ */

function ProfileCard() {
  const { basics, summary } = useResumeTemplateData();
  const hasSummary = Boolean(
    summary && !summary.hidden && (summary.content || "").trim(),
  );
  const contact = [
    basics.phone
      ? { icon: Phone, label: "Phone", value: basics.phone }
      : null,
    basics.email
      ? { icon: Mail, label: "E-Mail", value: basics.email }
      : null,
    basics.location
      ? { icon: MapPin, label: "Address", value: basics.location }
      : null,
  ].filter(Boolean) as Array<{
    icon: typeof Phone;
    label: string;
    value: string;
  }>;

  if (!hasSummary && !contact.length) return null;

  return (
    <Card variant='lime'>
      <CardHeading>Profile</CardHeading>
      {hasSummary && (
        <div
          className='text-[10.5px] leading-[1.7] [&_a]:underline [&_p+p]:mt-[var(--resume-paragraph-spacing,0.5rem)]'
          style={{ color: INK }}
          dangerouslySetInnerHTML={{
            __html: sanitizeHtmlFragment(summary.content || ""),
          }}
        />
      )}
      {contact.length > 0 && (
        <div className={cn("space-y-2.5", hasSummary && "mt-4")}>
          {contact.map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.label} className='flex items-center gap-2.5'>
                <span
                  className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full'
                  style={{ backgroundColor: INK, color: LIME }}
                >
                  <Icon className='h-3 w-3' strokeWidth={2.5} />
                </span>
                <div className='min-w-0 leading-tight'>
                  <p className='text-[11px] font-bold' style={{ color: INK }}>
                    {row.label}
                  </p>
                  <p
                    className='truncate text-[11px]'
                    style={{ color: INK }}
                    title={row.value}
                  >
                    {row.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* --------------------------------- entry card ------------------------------- */

function EntryCard({
  id,
  variant,
}: {
  id: string;
  variant: "white" | "lime";
}) {
  const section = useResumeTemplateData().sections[id];
  if (!section || section.hidden) return null;

  const visibleItems = section.items.filter((item) => !item.hidden);
  if (!visibleItems.length) return null;

  return (
    <Card variant={variant}>
      <CardHeading>{section.title}</CardHeading>
      <div className='space-y-4'>
        {visibleItems.map((item) => {
          const primary = getPrimary(item);
          const date = getDate(item);
          const subtitle = getSubtitle(item);
          const description = sanitizeHtmlFragment(item.description || "");

          return (
            <div key={item.id}>
              <p
                className='text-[12.5px] font-bold leading-snug'
                style={{ color: INK }}
              >
                {primary}
                {date ? ` (${date})` : ""}
              </p>
              {subtitle && (
                <p
                  className='text-[11.5px] leading-snug'
                  style={{ color: variant === "lime" ? INK : BODY }}
                >
                  {subtitle}
                </p>
              )}
              {description && (
                <div
                  className='mt-1 text-[10.5px] leading-[1.6] [&_a]:underline [&_p+p]:mt-[var(--resume-paragraph-spacing,0.5rem)]'
                  style={{ color: variant === "lime" ? INK : BODY }}
                  dangerouslySetInnerHTML={{ __html: description }}
                />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* --------------------------------- pills card ------------------------------- */

function PillsCard({ id }: { id: string }) {
  const section = useResumeTemplateData().sections[id];
  if (!section || section.hidden) return null;

  const visibleItems = section.items.filter((item) => !item.hidden);
  if (!visibleItems.length) return null;

  const isSkills = id === "skills";

  return (
    <Card variant='white'>
      <CardHeading
        extra={
          <span className='flex items-center gap-1'>
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className='h-1.5 w-1.5 rounded-full'
                style={{ backgroundColor: "#C7C7C2" }}
              />
            ))}
          </span>
        }
      >
        {section.title}
      </CardHeading>
      <div className='flex flex-wrap gap-2.5'>
        {visibleItems.map((item) => {
          const name = item.name || item.title || item.label || "Untitled";
          // Skills at level 4+ read as "primary" and get the lime fill.
          const highlighted =
            isSkills && typeof item.level === "number" && item.level >= 4;
          return (
            <span
              key={item.id}
              className='inline-flex items-center rounded-[10px] border-2 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.02em]'
              style={{
                borderColor: INK,
                backgroundColor: highlighted ? LIME : CARD_WHITE,
                color: INK,
              }}
            >
              {name}
            </span>
          );
        })}
      </div>
    </Card>
  );
}
