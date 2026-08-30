import {
  BriefcaseBusiness,
  Clock3,
  FileText,
  PenLine,
  Search,
  Send,
  Mail,
  Activity,
  Sparkles,
  HelpCircle,
  Compass,
} from "lucide-react";
import { getPrimarySkillAlias } from "@/lib/chatSkills/registry";
import type { JobrakerChatSkill, SkillTrigger } from "@/lib/chatSkills/types";

type Props = {
  open: boolean;
  mode: SkillTrigger;
  skills: JobrakerChatSkill[];
  activeIndex: number;
  onSelect: (skill: JobrakerChatSkill) => void;
};

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  send: Send,
  search: Search,
  pen: PenLine,
  mail: Mail,
  "file-text": FileText,
  clock: Clock3,
  activity: Activity,
  sparkles: Sparkles,
  help: HelpCircle,
  discovery: Compass,
};

export const ChatSkillCommandPalette = ({
  open,
  mode,
  skills,
  activeIndex,
  onSelect,
}: Props) => {
  if (!open || !skills.length) return null;

  return (
    <div
      role="listbox"
      aria-label="Available Chat Skills"
      className='relative z-50 mx-1 mb-2 overflow-hidden rounded-2xl border border-brand/35 bg-[#121316]/98 shadow-2xl shadow-black/80 backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-2 duration-150'
    >
      <div className='flex items-center justify-between border-b border-border/70 px-3.5 py-2.5 bg-black/40'>
        <div className='flex items-center gap-2'>
          <div className='flex h-7 w-7 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand'>
            <Sparkles className='h-3.5 w-3.5' />
          </div>
          <div>
            <p className='text-xs font-semibold text-foreground tracking-wide'>
              JobRaker Skills & Specialists
            </p>
            <p className='text-[10px] text-muted-foreground'>
              {mode === "mention" ? "Mention a specialist agent (@)" : "Run an automated command (/)"}
            </p>
          </div>
        </div>
        <span className='rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand'>
          {mode === "mention" ? "@ specialist" : "/ command"}
        </span>
      </div>

      <div className='max-h-72 overflow-y-auto p-1.5 custom-scrollbar space-y-1'>
        {skills.map((skill, index) => {
          const Icon = ICONS[skill.icon] || BriefcaseBusiness;
          const alias = getPrimarySkillAlias(skill, mode);
          const isSelected = index === activeIndex;

          return (
            <button
              key={skill.id}
              type='button'
              role="option"
              aria-selected={isSelected}
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(skill);
              }}
              className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                isSelected
                  ? "border-brand/40 bg-brand/15 shadow-[0_0_15px_rgba(47,217,104,0.08)]"
                  : "border-transparent hover:border-border/60 hover:bg-white/[0.04]"
              }`}
            >
              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                isSelected
                  ? "border-brand/40 bg-brand/20 text-brand"
                  : "border-border/60 bg-black/40 text-muted-foreground group-hover:text-brand"
              }`}>
                <Icon className='h-4 w-4' />
              </div>
              <div className='min-w-0 flex-1'>
                <div className='flex flex-wrap items-center gap-2'>
                  <p className={`text-xs font-bold font-mono ${isSelected ? "text-brand" : "text-foreground"}`}>
                    {alias}
                  </p>
                  <span className='rounded bg-muted/60 px-1.5 py-0.2 text-[9px] font-medium uppercase tracking-wider text-muted-foreground'>
                    {skill.category}
                  </span>
                </div>
                <p className='mt-0.5 text-[11px] leading-relaxed text-muted-foreground line-clamp-2'>
                  {skill.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className='flex items-center justify-between border-t border-border/40 px-3 py-1.5 bg-black/60 text-[10px] text-muted-foreground'>
        <span><kbd className='px-1 py-0.5 bg-white/10 rounded text-[9px] text-foreground'>↑</kbd> <kbd className='px-1 py-0.5 bg-white/10 rounded text-[9px] text-foreground'>↓</kbd> navigate</span>
        <span><kbd className='px-1.5 py-0.5 bg-white/10 rounded text-[9px] text-foreground'>↵ Enter</kbd> to select</span>
        <span><kbd className='px-1 py-0.5 bg-white/10 rounded text-[9px] text-foreground'>Esc</kbd> dismiss</span>
      </div>
    </div>
  );
};
