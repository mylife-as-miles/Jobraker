import type React from "react";
import { Globe, Mail, MapPin, Phone, User } from "lucide-react";
import {
  getSafeExternalHref,
  sanitizeHtmlFragment,
} from "../../lib/inputSecurity";
import type { ResumeSectionItem } from "../../store/artboard";
import { PagePicture } from "../shared/page-picture";
import type { TemplateProps } from "../types";
import { useResumeTemplateData } from "../use-resume-template-data";

/**
 * Template: Mercado — Memphis Pop
 * A pink-framed cream card with a black border, traffic-light dots and a
 * "CURRICULUM VITAE" header. Colored pill section headings (green / pink /
 * orange), dot-rating skills, colored bullet entries, an orange sunburst
 * behind the photo, and a green zigzag by the name.
 */

const PINK = "#EE6D99";
const GREEN = "#37A94C";
const ORANGE = "#F5921F";
const FRAME = "#FAF2E2";
const CARD = "#FFFDF8";
const INK = "#141414";
const BODY = "#4B4B4B";

const SHADOW = "3px 4px 0 #141414";
const PILL_SHADOW = "2px 2px 0 #141414";
const CYCLE = [GREEN, ORANGE, PINK];

const RIGHT_EXTRA_ORDER = [
  "projects",
  "awards",
  "certifications",
  "publications",
  "volunteer",
  "references",
];

const clampLevel = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) return null;
  return Math.max(1, Math.min(5, Math.round(value)));
};

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
    item.degree,
    item.area,
    item.field,
    item.title,
  ].filter(Boolean) as string[];
  return candidates.find((value) => value !== primary) || "";
};

const getMeta = (item: ResumeSectionItem) => {
  const date =
    item.date ||
    item.period ||
    [item.startDate, item.endDate].filter(Boolean).join(" - ");
  return [item.location, date].filter(Boolean).join(", ");
};

export function MercadoTemplate({ pageIndex = 0 }: TemplateProps) {
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
    ...rightExtras,
  ]);
  const unknownEntries = Object.keys(sections).filter(
    (id) => !known.has(id) && isVisible(id),
  );

  return (
    <div
      // [&_*]:font-sans out-specifies the app-wide `* { font-family: Questrial }`
      // rule so the name and headings render at real heavy weights.
      className='template-mercado relative h-full w-full overflow-hidden p-4 font-sans antialiased [&_*]:font-sans'
      style={{ backgroundColor: PINK, color: INK }}
    >
      {/* Grid corner + sparkle on the pink frame */}
      <div
        className='pointer-events-none absolute bottom-3 left-3 h-24 w-24 opacity-70'
        style={{
          backgroundImage:
            "linear-gradient(#ffffff88 1px, transparent 1px), linear-gradient(90deg, #ffffff88 1px, transparent 1px)",
          backgroundSize: "12px 12px",
        }}
      />

      <div
        className='relative flex h-full flex-col rounded-[26px] border-[3px] px-7 py-5'
        style={{ backgroundColor: FRAME, borderColor: INK }}
      >
        {/* Top bar */}
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            {[ORANGE, PINK, GREEN].map((c) => (
              <span
                key={c}
                className='h-3 w-3 rounded-full border-2'
                style={{ backgroundColor: c, borderColor: INK }}
              />
            ))}
          </div>
          <span className='text-[12px] font-bold uppercase tracking-[0.16em]'>
            Curriculum Vitae
          </span>
        </div>
        <div
          className='mt-3 h-[2px] w-full'
          style={{ backgroundColor: INK }}
        />

        {/* Body */}
        <div className='mt-5 grid grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] gap-6'>
          {/* Left column */}
          <div className='flex flex-col gap-5'>
            {isFirstPage && <PhotoBlock />}
            {isFirstPage && <ProfileBlock />}
            {isVisible("skills") && <SkillsCard />}
            {isFirstPage && <ContactBlock />}
          </div>

          {/* Right column */}
          <div className='flex flex-col gap-5'>
            {isFirstPage && <NameBlock />}
            {isVisible("education") && (
              <EntryCard id='education' pillColor={PINK} />
            )}
            {isVisible("experience") && (
              <EntryCard id='experience' pillColor={ORANGE} />
            )}
            {rightExtras.map((id, index) => (
              <EntryCard
                key={id}
                id={id}
                pillColor={CYCLE[index % CYCLE.length]}
              />
            ))}
            {unknownEntries.map((id, index) => (
              <EntryCard
                key={id}
                id={id}
                pillColor={CYCLE[index % CYCLE.length]}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- decorations ------------------------------- */

function Sunburst({ className }: { className?: string }) {
  return (
    <svg viewBox='-50 -50 100 100' className={className} aria-hidden='true'>
      {Array.from({ length: 12 }).map((_, i) => (
        <polygon
          key={i}
          points='0,-48 7,-28 -7,-28'
          fill={ORANGE}
          transform={`rotate(${i * 30})`}
        />
      ))}
      <circle r='27' fill={ORANGE} />
    </svg>
  );
}

function Zigzag({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 48 22' className={className} aria-hidden='true'>
      <polyline
        points='2,16 11,4 20,16 29,4 38,16 46,6'
        fill='none'
        stroke={GREEN}
        strokeWidth='4'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

/* ---------------------------------- left ------------------------------------ */

function PhotoBlock() {
  return (
    <div className='relative'>
      <Sunburst className='absolute -left-4 -top-5 z-0 h-20 w-20' />
      <div
        className='relative z-10 overflow-hidden rounded-[22px] border-[2.5px]'
        style={{ borderColor: INK, boxShadow: SHADOW }}
      >
        <PagePicture className='h-[210px] w-full object-cover' />
      </div>
    </div>
  );
}

function ProfileBlock() {
  const { basics, summary } = useResumeTemplateData();
  const hasSummary = Boolean(
    summary && !summary.hidden && (summary.content || "").trim(),
  );
  if (!hasSummary) return null;

  return (
    <div>
      <div className='mb-2 flex items-center gap-2'>
        <span
          className='flex h-6 w-6 items-center justify-center rounded-full border-2 text-white'
          style={{ backgroundColor: ORANGE, borderColor: INK }}
        >
          <User className='h-3 w-3' strokeWidth={2.5} />
        </span>
        <h6 className='text-[14px] font-extrabold' style={{ color: INK }}>
          {basics.headline ? "My Profile" : summary.title}
        </h6>
      </div>
      <div
        className='text-[10.5px] leading-[1.75] [&_a]:underline [&_p+p]:mt-[var(--resume-paragraph-spacing,0.5rem)]'
        style={{ color: BODY }}
        dangerouslySetInnerHTML={{
          __html: sanitizeHtmlFragment(summary.content || ""),
        }}
      />
    </div>
  );
}

function SkillsCard() {
  const section = useResumeTemplateData().sections["skills"];
  if (!section || section.hidden) return null;
  const items = section.items.filter((item) => !item.hidden);
  if (!items.length) return null;

  return (
    <StickerCard pillTitle={section.title} pillColor={GREEN}>
      <div className='space-y-2.5'>
        {items.map((item, index) => {
          const level = clampLevel(item.level);
          const color = CYCLE[index % CYCLE.length];
          const name = item.name || item.title || item.label || "Untitled";
          return (
            <div key={item.id} className='flex items-center justify-between gap-3'>
              <span
                className='text-[11.5px] font-bold'
                style={{ color: INK }}
              >
                {name}
              </span>
              {level !== null && (
                <span className='flex gap-1.5'>
                  {[1, 2, 3, 4, 5].map((dot) => (
                    <span
                      key={dot}
                      className='h-[11px] w-[11px] rounded-full border-2'
                      style={{
                        borderColor: INK,
                        backgroundColor: dot <= level ? color : "#FFFFFF",
                      }}
                    />
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </StickerCard>
  );
}

function ContactBlock() {
  const basics = useResumeTemplateData().basics;
  const websiteUrl = basics.website?.url || "";
  const websiteHref = getSafeExternalHref(
    websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`,
  );
  const rows = [
    basics.phone
      ? { icon: Phone, text: basics.phone, href: `tel:${basics.phone.replace(/\s+/g, "")}` }
      : null,
    basics.email
      ? { icon: Mail, text: basics.email, href: `mailto:${basics.email}` }
      : null,
    websiteUrl
      ? { icon: Globe, text: basics.website?.label || websiteUrl, href: websiteHref || undefined }
      : null,
    basics.location ? { icon: MapPin, text: basics.location, href: undefined } : null,
  ].filter(Boolean) as Array<{
    icon: typeof Phone;
    text: string;
    href?: string;
  }>;

  if (!rows.length) return null;

  return (
    <div className='mt-1 space-y-2.5'>
      {rows.map((row, index) => {
        const Icon = row.icon;
        const color = CYCLE[index % CYCLE.length];
        const content = (
          <>
            <span
              className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-white'
              style={{ backgroundColor: color, borderColor: INK }}
            >
              <Icon className='h-3 w-3' strokeWidth={2.5} />
            </span>
            <span className='text-[10.5px]' style={{ color: INK }}>
              {row.text}
            </span>
          </>
        );
        return row.href ? (
          <a
            key={row.text}
            href={row.href}
            target={row.href.startsWith("http") ? "_blank" : undefined}
            rel='noopener noreferrer'
            className='flex items-center gap-2.5 hover:underline'
          >
            {content}
          </a>
        ) : (
          <div key={row.text} className='flex items-center gap-2.5'>
            {content}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------- right ----------------------------------- */

function NameBlock() {
  const basics = useResumeTemplateData().basics;
  const words = (basics.name || "Your Name").split(/\s+/).filter(Boolean);

  return (
    <div className='relative'>
      <Zigzag className='absolute -top-1 right-1 h-6 w-12' />
      <h1 className='text-[52px] leading-[0.92] tracking-[-0.02em]'>
        {words.map((word, index) => (
          <span key={`${word}-${index}`} className='block font-extrabold'>
            {word}
          </span>
        ))}
      </h1>
      {basics.headline && (
        <span
          className='mt-3 inline-flex rounded-full border-[2.5px] px-6 py-2 text-[13px] font-extrabold uppercase tracking-[0.1em] text-white'
          style={{ backgroundColor: GREEN, borderColor: INK, boxShadow: PILL_SHADOW }}
        >
          {basics.headline}
        </span>
      )}
    </div>
  );
}

/* -------------------------------- containers -------------------------------- */

function StickerCard({
  pillTitle,
  pillColor,
  children,
}: {
  pillTitle: string;
  pillColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className='relative'>
      <div className='absolute -top-3.5 left-5 z-10'>
        <span
          className='inline-flex rounded-full border-[2.5px] px-5 py-1.5 text-[12.5px] font-extrabold uppercase tracking-[0.04em] text-white'
          style={{
            backgroundColor: pillColor,
            borderColor: INK,
            boxShadow: PILL_SHADOW,
          }}
        >
          {pillTitle}
        </span>
      </div>
      <div
        className='rounded-[22px] border-[2.5px] px-5 pb-5 pt-7'
        style={{ backgroundColor: CARD, borderColor: INK, boxShadow: SHADOW }}
      >
        {children}
      </div>
    </div>
  );
}

function EntryCard({ id, pillColor }: { id: string; pillColor: string }) {
  const section = useResumeTemplateData().sections[id];
  if (!section || section.hidden) return null;
  const items = section.items.filter((item) => !item.hidden);
  if (!items.length) return null;

  return (
    <StickerCard pillTitle={section.title} pillColor={pillColor}>
      <div className='space-y-3.5'>
        {items.map((item, index) => {
          const primary = getPrimary(item);
          const subtitle = getSubtitle(item);
          const meta = getMeta(item);
          const description = sanitizeHtmlFragment(item.description || "");
          const color = CYCLE[index % CYCLE.length];

          return (
            <div key={item.id} className='flex gap-2.5'>
              <span
                className='mt-[5px] h-3 w-3 shrink-0 rounded-full border-2'
                style={{ backgroundColor: color, borderColor: INK }}
              />
              <div className='min-w-0'>
                <p
                  className='text-[13px] font-extrabold leading-snug'
                  style={{ color: INK }}
                >
                  {primary}
                </p>
                {subtitle && (
                  <p
                    className='text-[11px] font-medium leading-snug'
                    style={{ color: BODY }}
                  >
                    {subtitle}
                  </p>
                )}
                {meta && (
                  <p
                    className='text-[11px] leading-snug'
                    style={{ color: BODY }}
                  >
                    {meta}
                  </p>
                )}
                {description && (
                  <div
                    className='mt-1 text-[10.5px] leading-[1.6] [&_a]:underline [&_p+p]:mt-[var(--resume-paragraph-spacing,0.5rem)]'
                    style={{ color: BODY }}
                    dangerouslySetInnerHTML={{ __html: description }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </StickerCard>
  );
}
