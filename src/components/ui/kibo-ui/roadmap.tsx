import * as React from 'react';
// Local lightweight cn helper (fallback) to avoid unresolved alias if '@/utils/cn' does not exist yet.
// Replace with your project utility if already defined.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Roadmap design system primitives (fallback local implementation)
 * Mirrors the style direction of Kibo UI / shadcn style components so it can be swapped
 * later with the official generator once the remote registry endpoint is available again.
 *
 * Components:
 *  <Roadmap columns={[{id:'now', label:'Now'}, ...]}> children </Roadmap>
 *  <RoadmapColumn id label>
 *    <RoadmapGroup label>
 *      <RoadmapItem title description status progress tags />
 *    </RoadmapGroup>
 *  </RoadmapColumn>
 *
 * Accessibility:
 *  - columns are rendered as list -> list items
 *  - groups are nested lists
 *  - items expose status via data-status attribute & aria-label additions
 */

export interface RoadmapColumnDef {
  id: string;
  label: string;
  description?: string;
  accentClass?: string; // Tailwind utility override
}

export type RoadmapStatus = 'planned' | 'in-progress' | 'done' | 'blocked';

const STATUS_META: Record<RoadmapStatus, { label: string; color: string; dot: string; ring: string } > = {
  planned: { label: 'Planned', color: 'text-white/70', dot: 'bg-zinc-400', ring: 'ring-zinc-400/30' },
  'in-progress': { label: 'In Progress', color: 'text-amber-200', dot: 'bg-amber-400 animate-pulse', ring: 'ring-amber-400/40' },
  done: { label: 'Done', color: 'text-emerald-200', dot: 'bg-emerald-400', ring: 'ring-emerald-400/40' },
  blocked: { label: 'Blocked', color: 'text-rose-200', dot: 'bg-rose-500', ring: 'ring-rose-500/40' },
};

/* Root */
export interface RoadmapProps extends React.HTMLAttributes<HTMLDivElement> {
  columns: RoadmapColumnDef[];
  condensed?: boolean;
  gap?: string; // tailwind gap override e.g. 'gap-6'
}

export const Roadmap = React.forwardRef<HTMLDivElement, RoadmapProps>(function Roadmap(
  { columns, children, className, condensed, gap = 'gap-6', ...rest }, ref
) {
  return (
    <div ref={ref} className={cn('w-full', className)} {...rest}>
      <div className={cn('grid w-full', condensed ? 'md:grid-cols-3 grid-cols-1' : 'lg:grid-cols-3 md:grid-cols-2 grid-cols-1', gap)}>
        {children}
      </div>
    </div>
  );
});

/* Column */
export interface RoadmapColumnProps extends React.HTMLAttributes<HTMLDivElement> {
  id: string;
  label: string;
  description?: string;
  accentClass?: string;
  headerExtra?: React.ReactNode;
}

export const RoadmapColumn = React.forwardRef<HTMLDivElement, RoadmapColumnProps>(function RoadmapColumn(
  { id, label, description, accentClass, headerExtra, className, children, ...rest }, ref
) {
  return (
    <div ref={ref} className={cn('flex flex-col min-h-0', className)} data-roadmap-column={id} {...rest}>
      <div className={cn('mb-3 flex items-start justify-between')}
        aria-label={`Roadmap column ${label}`}
      >
        <div className='flex flex-col'>
          <div className={cn('text-sm font-medium tracking-wide inline-flex items-center gap-2', accentClass || 'text-white')}> 
            <span className='relative px-2 py-1 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm text-[11px] uppercase'>{label}</span>
          </div>
          {description && <p className='mt-1 text-[11px] text-white/50 leading-snug'>{description}</p>}
        </div>
        {headerExtra && <div className='ml-2'>{headerExtra}</div>}
      </div>
      <div className='flex flex-col gap-3' role='list'>
        {children}
      </div>
    </div>
  );
});

/* Group */
export interface RoadmapGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export const RoadmapGroup: React.FC<RoadmapGroupProps> = ({ label, collapsible, defaultOpen = true, className, children, ...rest }) => {
  const [open, setOpen] = React.useState(defaultOpen);
  const Wrapper: any = 'div';
  return (
    <Wrapper className={cn('rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-sm', className)} {...rest}>
      {(label || collapsible) && (
        <button
          type='button'
          onClick={() => collapsible && setOpen(o => !o)}
          className='group mb-2 flex w-full items-center justify-between text-left'
          aria-expanded={open}
        >
          <span className='text-[11px] font-semibold tracking-wide text-white/60 group-hover:text-white/80 transition-colors'>{label}</span>
          {collapsible && (
            <span className={cn('h-4 w-4 rounded-md grid place-items-center text-white/50 text-[10px] border border-white/10', open ? 'rotate-0' : '-rotate-90 transition-transform')}>⌃</span>
          )}
        </button>
      )}
      <div className={cn('flex flex-col gap-2', !open && 'hidden')} role='list'>
        {children}
      </div>
    </Wrapper>
  );
};

/* Item */
export interface RoadmapItemProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  status?: RoadmapStatus;
  progress?: number; // 0-100
  tags?: string[];
  meta?: React.ReactNode;
  icon?: React.ReactNode;
}

export const RoadmapItem = React.forwardRef<HTMLDivElement, RoadmapItemProps>(function RoadmapItem(
  { title, description, status = 'planned', progress, tags, meta, icon, className, ...rest }, ref
) {
  const s = STATUS_META[status];
  const pct = typeof progress === 'number' ? Math.min(100, Math.max(0, progress)) : undefined;
  return (
    <div
      ref={ref}
      className={cn('group relative rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-3 shadow-sm hover:border-[#1dff00]/40 transition-colors',
        'hover:shadow-[0_0_0_1px_rgba(29,255,0,0.25),0_4px_18px_-6px_rgba(29,255,0,0.45)]',
        className
      )}
      data-status={status}
      aria-label={`${title} (${s.label}${pct != null ? ` ${pct}%` : ''})`}
      {...rest}
    >
      <div className='flex items-start gap-3'>
        <div className='mt-0.5 flex flex-col items-center'>
          <span className={cn('h-2 w-2 rounded-full', s.dot)} aria-hidden />
          {pct != null && (
            <span className='relative mt-2 block h-8 w-1 rounded-full bg-white/10 overflow-hidden'>
              <span className='absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#1dff00] to-emerald-400' style={{ height: pct + '%' }} />
            </span>
          )}
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex items-start gap-2'>
            {icon && <div className='mt-0.5 h-5 w-5 text-[#1dff00]'>{icon}</div>}
            <h4 className='text-sm font-medium text-white leading-tight truncate'>{title}</h4>
            {meta && <div className='ml-auto text-[11px] text-white/50 flex-shrink-0'>{meta}</div>}
          </div>
          {description && <p className='mt-1 text-[11px] leading-snug text-white/55 line-clamp-3'>{description}</p>}
          {tags && tags.length > 0 && (
            <div className='mt-2 flex flex-wrap gap-1.5'>
              {tags.map(t => (
                <span
                  key={t}
                  className='inline-flex items-center rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-medium text-white/60 hover:text-white/80 hover:border-white/25 transition-colors'
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          <div className='mt-2 flex items-center gap-2 text-[10px]'>
            <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 border text-[10px] font-medium backdrop-blur-sm', s.color, s.ring, 'border-white/10')}>{s.label}</span>
            {pct != null && (
              <span className='text-white/40'>{pct.toFixed(0)}%</span>
            )}
          </div>
        </div>
      </div>
      <div className='pointer-events-none absolute inset-0 rounded-xl border border-transparent group-hover:border-[#1dff00]/30 transition-colors' />
    </div>
  );
});

/* Convenience aggregate export */
export const RoadmapPrimitiveSet = { Roadmap, RoadmapColumn, RoadmapGroup, RoadmapItem };

export default Roadmap;
