import type { NextAction } from "@/lib/chat/nextActions";

interface ChatNextActionsProps {
  actions: NextAction[];
  onAction: (prompt: string) => void;
  disabled?: boolean;
}

// One-click next steps under the latest answer. The first action is the
// agent's recommended step, so it gets the filled style.
export function ChatNextActions({ actions, onAction, disabled = false }: ChatNextActionsProps) {
  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Next steps">
      {actions.map((action, index) => (
        <button
          key={action.label}
          type="button"
          disabled={disabled}
          title={action.prompt}
          onClick={() => onAction(action.prompt)}
          className={`inline-flex min-h-9 items-center rounded-full px-4 py-1.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:pointer-events-none disabled:opacity-50 ${
            index === 0
              ? "bg-brand text-background hover:bg-brand/90"
              : "border border-border bg-card/75 text-foreground hover:border-brand/40 hover:bg-brand/10"
          }`}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
