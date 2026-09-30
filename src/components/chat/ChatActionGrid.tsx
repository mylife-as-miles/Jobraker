import React from "react";
import {
  BookOpen,
  CalendarCheck,
  FileText,
  Mail,
  MessageSquare,
  Search,
  Send,
  Target,
} from "lucide-react";
import {
  CHAT_ACTIONS,
  type ChatAction,
  type ChatActionIcon,
} from "@/lib/chat/chatActions";

const ICONS: Record<ChatActionIcon, React.ComponentType<{ className?: string }>> = {
  search: Search,
  send: Send,
  resume: FileText,
  letter: BookOpen,
  mail: Mail,
  "follow-up": CalendarCheck,
  interview: MessageSquare,
  tracker: Target,
};

interface ChatActionGridProps {
  onAction: (action: ChatAction) => void;
  disabled?: boolean;
  actions?: ChatAction[];
}

export const ChatActionGrid: React.FC<ChatActionGridProps> = ({
  onAction,
  disabled = false,
  actions = CHAT_ACTIONS,
}) => (
  <div className='grid w-full grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3'>
    {actions.map((action) => {
      const Icon = ICONS[action.icon];
      return (
        <button
          key={action.id}
          type='button'
          disabled={disabled}
          onClick={() => onAction(action)}
          className='suggestion-card glass-panel flex min-h-[92px] flex-col rounded-xl p-3 text-left transition-all disabled:pointer-events-none disabled:opacity-50 md:p-3.5'
        >
          <Icon className='mb-1.5 h-4 w-4 text-brand' />
          <span className='mb-1 text-xs font-semibold text-card-foreground'>
            {action.label}
          </span>
          <span className='text-[11px] leading-snug text-muted-foreground'>
            {action.description}
          </span>
        </button>
      );
    })}
  </div>
);
