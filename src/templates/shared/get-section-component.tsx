import type { ResumeSectionItem } from '../../store/artboard';
import { cn } from '../../lib/utils';
import { getSafeExternalHref, sanitizeHtmlFragment } from '../../lib/inputSecurity';
import { useResumeTemplateValue } from '../use-resume-template-data';

const sectionHeadingClass =
  'text-[0.68rem] font-black uppercase tracking-[0.24em] text-gray-900 mb-3 pb-1.5 group-data-[layout=sidebar]:text-white/95';

const itemSurfaceClass = cn(
  'rounded-[1rem] border px-3.5 py-3',
  'border-gray-100/80 bg-white/90 shadow-[0_10px_24px_rgba(15,23,42,0.04)]',
  'group-data-[layout=sidebar]:border-white/10 group-data-[layout=sidebar]:bg-white/10 group-data-[layout=sidebar]:shadow-none',
);

const clampLevel = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.max(1, Math.min(5, Math.round(value)));
};

const stripHtml = (value?: string) =>
  value
    ? value.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : '';

const getItemTitle = (item: ResumeSectionItem) =>
  item.title || item.position || item.role || item.degree || item.name || item.label || 'Untitled';

const getItemSubtitle = (item: ResumeSectionItem) => {
  const org = item.company || item.school || item.organization || item.institution || item.issuer;
  const location = item.location;
  const extra = item.subtitle || item.field || item.area;
  return [org, location || extra].filter(Boolean).join(' - ');
};

const getItemDate = (item: ResumeSectionItem) =>
  item.date || item.period || [item.startDate, item.endDate].filter(Boolean).join(' - ');

const getItemUrl = (item: ResumeSectionItem) => item.website?.url || item.url || '';

const getItemUrlLabel = (item: ResumeSectionItem) =>
  item.website?.label || item.linkLabel || 'View details';

const getItemKeywords = (item: ResumeSectionItem) =>
  Array.isArray(item.keywords) ? item.keywords.filter(Boolean).slice(0, 6) : [];

const getLevelLabel = (sectionId: string, level: number | null) => {
  if (!level) return '';

  const labels =
    sectionId === 'languages'
      ? ['Basic', 'Conversational', 'Professional', 'Fluent', 'Native']
      : ['Beginner', 'Working', 'Advanced', 'Expert', 'Mastery'];

  return labels[level - 1] || '';
};

const SummarySection = ({
  title,
  content,
  className,
}: {
  title: string;
  content: string;
  className?: string;
}) => {
  if (!content) return null;
  const safeContent = sanitizeHtmlFragment(content);

  return (
    <div className={cn('section-content section-summary', className)}>
      <h6 className={sectionHeadingClass}>{title}</h6>
      <div
        className={cn(
          'section-summary-body rounded-[1rem] border px-4 py-3.5',
          'border-gray-100/80 bg-white/90 shadow-[0_10px_24px_rgba(15,23,42,0.04)]',
          'group-data-[layout=sidebar]:border-white/10 group-data-[layout=sidebar]:bg-white/10 group-data-[layout=sidebar]:shadow-none',
        )}
      >
        <div
          className={cn(
            'section-summary-copy text-[0.8rem] leading-[1.85] tracking-[0.01em]',
            'text-gray-600 [&_a]:text-[color:var(--page-primary-color,#3b82f6)] [&_a]:underline',
            '[&_strong]:font-semibold [&_strong]:text-gray-800',
            '[&_p+p]:mt-[var(--resume-paragraph-spacing,0.5rem)]',
            'group-data-[layout=sidebar]:text-white/85 group-data-[layout=sidebar]:[&_strong]:text-white',
          )}
          dangerouslySetInnerHTML={{ __html: safeContent }}
        />
      </div>
    </div>
  );
};

function TokenSection({
  items,
  sectionId,
}: {
  items: ResumeSectionItem[];
  sectionId: string;
}) {
  const visibleItems = items.filter((item) => !item.hidden);
  if (!visibleItems.length) return null;

  if (sectionId === 'languages') {
    return (
      <div className="space-y-3">
        {visibleItems.map((item) => {
          const level = clampLevel(item.level) || 3;
          const levelLabel = getLevelLabel(sectionId, level);
          const note = stripHtml(item.description);

          return (
            <div key={item.id} className={cn('section-language-item', itemSurfaceClass)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[0.78rem] font-semibold text-gray-800 group-data-[layout=sidebar]:text-white">
                    {getItemTitle(item)}
                  </div>
                  {note && (
                    <div className="mt-0.5 text-[0.65rem] leading-5 text-gray-400 group-data-[layout=sidebar]:text-white/65">
                      {note}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-gray-400 group-data-[layout=sidebar]:text-white/70">
                  {levelLabel}
                </div>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-gray-200/90 group-data-[layout=sidebar]:bg-white/15">
                <div
                  className="h-full rounded-full bg-[color:var(--page-primary-color,#3b82f6)] group-data-[layout=sidebar]:bg-white/85"
                  style={{ width: `${level * 20}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {visibleItems.map((item) => {
        const level = clampLevel(item.level);
        return (
          <span
            key={item.id}
            className={cn(
              'section-token inline-flex items-center gap-2 rounded-full border px-3 py-1.5',
              'border-gray-200/80 bg-white/90 text-[0.68rem] font-semibold text-gray-700 shadow-[0_4px_14px_rgba(15,23,42,0.05)]',
              'group-data-[layout=sidebar]:border-white/10 group-data-[layout=sidebar]:bg-white/10 group-data-[layout=sidebar]:text-white group-data-[layout=sidebar]:shadow-none',
            )}
          >
            {level && (
              <span className="flex gap-1">
                {[1, 2, 3, 4, 5].map((dot) => (
                  <span
                    key={dot}
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      dot <= level
                        ? 'bg-[color:var(--page-primary-color,#3b82f6)] group-data-[layout=sidebar]:bg-white/90'
                        : 'bg-gray-200 group-data-[layout=sidebar]:bg-white/20',
                    )}
                  />
                ))}
              </span>
            )}
            <span>{getItemTitle(item)}</span>
          </span>
        );
      })}
    </div>
  );
}

function ItemsSection({
  items,
  sectionId,
}: {
  items: ResumeSectionItem[];
  sectionId: string;
}) {
  const visibleItems = items.filter((item) => !item.hidden);
  if (!visibleItems.length) return null;

  return (
    <div className="space-y-3.5">
      {visibleItems.map((item) => {
        const title = getItemTitle(item);
        const subtitle = getItemSubtitle(item);
        const date = getItemDate(item);
        const url = getSafeExternalHref(getItemUrl(item));
        const description = sanitizeHtmlFragment(item.description);
        const keywords = getItemKeywords(item);
        const detailNote =
          sectionId === 'references'
            ? [stripHtml(item.description), item.email || item.phone].filter(Boolean).join(' - ')
            : '';

        return (
          <div key={item.id} className={cn('group/item section-item', itemSurfaceClass)}>
            <div className="section-item-header flex items-start justify-between gap-3 mb-1.5">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="section-item-title text-[0.84rem] font-bold leading-tight text-gray-900 group-data-[layout=sidebar]:text-white">
                  {title}
                </div>
                {subtitle && (
                  <div className="section-item-subtitle text-[0.74rem] font-semibold text-[color:var(--page-primary-color,#3b82f6)] group-data-[layout=sidebar]:text-white/88">
                    {subtitle}
                  </div>
                )}
                {detailNote && (
                  <div className="section-item-note text-[0.66rem] text-gray-400 group-data-[layout=sidebar]:text-white/65">
                    {detailNote}
                  </div>
                )}
              </div>
              {date && (
                <div className="section-item-date inline-flex shrink-0 items-center rounded-full border border-[color:var(--page-primary-color,#3b82f6)]/15 bg-[color:var(--page-primary-color,#3b82f6)]/8 px-2.5 py-1 text-[0.64rem] font-semibold text-gray-500 group-data-[layout=sidebar]:border-white/10 group-data-[layout=sidebar]:bg-white/10 group-data-[layout=sidebar]:text-white/80">
                  {date}
                </div>
              )}
            </div>

            {description && sectionId !== 'references' && (
              <div
                className={cn(
                  'section-item-description mt-2 text-[0.75rem] leading-[1.72] text-gray-600',
                  '[&_p+p]:mt-[var(--resume-paragraph-spacing,0.5rem)]',
                  '[&_ul]:mt-[var(--resume-paragraph-spacing,0.5rem)] [&_ul]:space-y-1',
                  '[&_ul]:list-none [&_ul]:pl-0',
                  '[&_li]:relative [&_li]:pl-4',
                  '[&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:top-[0.6em]',
                  '[&_li]:before:h-1.5 [&_li]:before:w-1.5 [&_li]:before:rounded-full [&_li]:before:content-[""]',
                  '[&_li]:before:bg-[color:var(--page-primary-color,#3b82f6)]',
                  '[&_a]:text-[color:var(--page-primary-color,#3b82f6)] [&_a]:underline',
                  '[&_strong]:font-semibold [&_strong]:text-gray-800',
                  'group-data-[layout=sidebar]:text-white/82 group-data-[layout=sidebar]:[&_strong]:text-white group-data-[layout=sidebar]:[&_a]:text-white',
                )}
                dangerouslySetInnerHTML={{ __html: description }}
              />
            )}

            {(keywords.length > 0 || url) && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="inline-flex items-center rounded-full border border-gray-200/80 bg-gray-50 px-2.5 py-1 text-[0.64rem] font-medium text-gray-500 group-data-[layout=sidebar]:border-white/10 group-data-[layout=sidebar]:bg-white/10 group-data-[layout=sidebar]:text-white/75"
                  >
                    {keyword}
                  </span>
                ))}
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-full border border-[color:var(--page-primary-color,#3b82f6)]/15 bg-[color:var(--page-primary-color,#3b82f6)]/8 px-2.5 py-1 text-[0.64rem] font-semibold text-[color:var(--page-primary-color,#3b82f6)] hover:underline group-data-[layout=sidebar]:border-white/10 group-data-[layout=sidebar]:bg-white/10 group-data-[layout=sidebar]:text-white"
                  >
                    {getItemUrlLabel(item)}
                  </a>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const SectionPlaceholder = ({
  id,
  className,
}: {
  id: string;
  className?: string;
}) => {
  const summary = useResumeTemplateValue((resumeData) => resumeData.summary);
  const section = useResumeTemplateValue((resumeData) => resumeData.sections[id]);

  if (id === 'summary') {
    if (!summary || !summary.content || summary.hidden) return null;
    return (
      <SummarySection
        title={summary.title}
        content={summary.content}
        className={className}
      />
    );
  }

  if (!section || section.hidden) return null;

  const visibleItems = section.items.filter((item) => !item.hidden);
  if (!visibleItems.length) return null;

  const isTokenSection =
    section.type === 'list' || id === 'skills' || id === 'languages' || id === 'interests';

  return (
    <div className={cn('section-content', className, `section-${id}`)}>
      <h6 className={sectionHeadingClass}>{section.title}</h6>

      <div className="section-body text-sm">
        {isTokenSection ? (
          <TokenSection items={visibleItems} sectionId={id} />
        ) : (
          <ItemsSection items={visibleItems} sectionId={id} />
        )}
      </div>
    </div>
  );
};

export const getSectionComponent = (sectionId: string, options?: any) => {
  return (props: any) => (
    <SectionPlaceholder id={sectionId} className={options?.sectionClassName} {...props} />
  );
};
