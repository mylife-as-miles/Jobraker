import type { ComponentType } from "react";
import {
  BriefcaseBusiness,
  Clock3,
  FileText,
  PenLine,
  Search,
  Send,
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
  "file-text": FileText,
  clock: Clock3,
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
    <div className='relative z-30 mx-2 mt-2 overflow-hidden rounded-2xl border border-brand/25 bg-card/95 shadow-2xl shadow-black/35 backdrop-blur-xl'>
      <div className='flex items-center justify-between border-b border-border/70 px-3 py-2'>
        <div className='flex items-center gap-2'>
          <div className='flex h-7 w-7 items-center justify-center rounded-lg border border-brand/20 bg-brand/10 text-brand'>
            <BriefcaseBusiness className='h-3.5 w-3.5' />
          </div>
          <div>
            <p className='text-xs font-semibold text-foreground'>
              Chat Skills
            </p>
            <p className='text-[10px] text-muted-foreground'>
              {mode === "mention" ? "Mention a specialist" : "Run a command"}
            </p>
          </div>
        </div>
        <span className='rounded-full border border-border bg-background/70 px-2 py-1 text-[10px] font-medium text-muted-foreground'>
          {mode === "mention" ? "@ skill" : "/ command"}
        </span>
      </div>

      <div className='max-h-72 overflow-y-auto p-2 custom-scrollbar'>
        {skills.map((skill, index) => {
          const Icon = ICONS[skill.icon] || BriefcaseBusiness;
          const alias = getPrimarySkillAlias(skill, mode);

          return (
            <button
              key={skill.id}
              type='button'
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(skill);
              }}
              className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                index === activeIndex
                  ? "border-brand/35 bg-brand/10"
                  : "border-transparent hover:border-border hover:bg-accent/35"
              }`}
            >
              <div className='mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand/20 bg-brand/10 text-brand'>
                <Icon className='h-4 w-4' />
              </div>
              <div className='min-w-0 flex-1'>
                <div className='flex flex-wrap items-center gap-2'>
                  <p className='text-sm font-semibold text-foreground'>
                    {alias}
                  </p>
                  <span className='rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground'>
                    {skill.category}
                  </span>
                </div>
                <p className='mt-1 text-xs leading-relaxed text-muted-foreground'>
                  {skill.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
