import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ContextChatAction } from "@/lib/chat/chatActions";

interface AskAiMenuProps {
  actions: ContextChatAction[];
  className?: string;
  label?: string;
}

// "Ask AI" button for any page: picking an item opens the chat and runs the
// task straight away (ChatPage submits location.state.autoPrompt once).
export function AskAiMenu({ actions, className = "", label = "Ask AI" }: AskAiMenuProps) {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-brand/50 bg-brand/10 px-3 py-2 text-[13px] font-semibold text-brand transition hover:bg-brand/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${className}`}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="z-[70] w-64">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.id}
            onSelect={() => navigate("/dashboard/chat", { state: { autoPrompt: action.prompt } })}
            className="px-3 py-2 text-sm"
          >
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
