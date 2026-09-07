import { sanitizeHtmlFragment } from "@/lib/inputSecurity";
import type { ResumeSection, ResumeSectionItem } from "@/store/artboard";
import type { TemplateProps } from "../types";
import { useResumeTemplateData } from "../use-resume-template-data";

const decodeTextEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");

const toPlainText = (value?: string) => {
  if (!value) return "";

  return decodeTextEntities(
    sanitizeHtmlFragment(value)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>|<\/div>|<\/li>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const getItemTitle = (item: ResumeSectionItem) =>
  item.position || item.title || item.role || item.degree || item.name || item.label || "";

const getItemOrganization = (item: ResumeSectionItem) =>
  item.company || item.school || item.organization || item.institution || item.issuer || "";

const getItemDate = (item: ResumeSectionItem) =>
  item.date || item.period || [item.startDate, item.endDate].filter(Boolean).join(" - ");

function PlainTextSection({ section }: { section: ResumeSection }) {
  const items = section.items.filter((item) => !item.hidden);
  if (section.hidden || items.length === 0) return null;

  if (section.type === "list") {
    return (
      <section className='section-content space-y-2'>
        <h2 className='text-[13px] font-bold uppercase tracking-[0.12em]'>
          {section.title}
        </h2>
        <p className='whitespace-pre-wrap text-[12px] leading-5'>
          {items.map((item) => getItemTitle(item)).filter(Boolean).join(", ")}
        </p>
      </section>
    );
  }

  return (
    <section className='section-content space-y-3'>
      <h2 className='text-[13px] font-bold uppercase tracking-[0.12em]'>
        {section.title}
      </h2>
      {items.map((item) => {
        const title = getItemTitle(item);
        const organization = getItemOrganization(item);
        const date = getItemDate(item);
        const location = item.location || "";
        const description = toPlainText(item.description);

        return (
          <div key={item.id} className='section-item text-[12px] leading-5'>
            {(title || date) && (
              <div className='flex items-baseline justify-between gap-5'>
                <h3 className='font-bold'>{title}</h3>
                {date && <span className='shrink-0'>{date}</span>}
              </div>
            )}
            {(organization || location) && (
              <p>{[organization, location].filter(Boolean).join(" | ")}</p>
            )}
            {description && <p className='mt-1 whitespace-pre-wrap'>{description}</p>}
          </div>
        );
      })}
    </section>
  );
}

export function PlainTextTemplate({ pageLayout }: TemplateProps) {
  const resumeData = useResumeTemplateData();
  const { basics, summary, sections } = resumeData;
  const orderedIds = [
    ...(pageLayout?.main || []),
    ...(pageLayout?.sidebar || []),
    ...Object.keys(sections),
  ].filter((id, index, ids) => id !== "summary" && ids.indexOf(id) === index);
  const contact = [
    basics.email,
    basics.phone,
    basics.location,
    basics.website?.url,
  ].filter(Boolean);

  return (
    <article
      role='document'
      aria-label='Plain text resume'
      className='template-plain-text min-h-full w-full bg-white px-14 py-12 font-sans text-black'
    >
      <header className='space-y-1 text-center'>
        <h1 className='text-[25px] font-bold'>{basics.name || "Your Name"}</h1>
        {basics.headline && <p className='text-[14px]'>{basics.headline}</p>}
        {contact.length > 0 && (
          <p className='text-[11px] leading-5'>{contact.join(" | ")}</p>
        )}
      </header>

      <div className='mt-7 space-y-6'>
        {!summary.hidden && toPlainText(summary.content) && (
          <section className='section-content section-summary space-y-2'>
            <h2 className='text-[13px] font-bold uppercase tracking-[0.12em]'>
              {summary.title || "Summary"}
            </h2>
            <p className='whitespace-pre-wrap text-[12px] leading-5'>
              {toPlainText(summary.content)}
            </p>
          </section>
        )}

        {orderedIds.map((sectionId) => {
          const section = sections[sectionId];
          return section ? (
            <PlainTextSection key={sectionId} section={section} />
          ) : null;
        })}
      </div>
    </article>
  );
}
