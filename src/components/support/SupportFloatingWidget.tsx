import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowUpRight,
  Bot,
  Briefcase,
  CreditCard,
  FileText,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabaseClient";

type SupportMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type SupportAction = {
  label: string;
  route?: string | null;
  kind?: "navigate" | "human" | "reply";
  prompt?: string | null;
};

type SupportResponse = {
  response?: string;
  suggestedActions?: SupportAction[];
};

type SupportFloatingWidgetProps = {
  currentPageId: string;
  currentPageLabel: string;
};

const QUICK_ACTIONS: Array<{
  label: string;
  prompt: string;
  icon: typeof CreditCard;
}> = [
  {
    label: "Billing help",
    prompt:
      "Help me understand my subscription, credits, and what plan makes sense for me.",
    icon: CreditCard,
  },
  {
    label: "Job search help",
    prompt:
      "Help me use Jobraker to find better-fit jobs and organize them faster.",
    icon: Briefcase,
  },
  {
    label: "Resume help",
    prompt:
      "Help me get the most out of resume tailoring and explain what to do next.",
    icon: FileText,
  },
  {
    label: "Report a problem",
    prompt:
      "I think something is broken. Help me capture the issue clearly and tell me what to try next.",
    icon: AlertCircle,
  },
];

const pageWelcome = (pageLabel: string) =>
  `Hi, I’m Jobraker Support. I can help with ${pageLabel.toLowerCase()}, billing, AI tools, and where to go next inside the app.`;

const makeId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function SupportFloatingWidget({
  currentPageId,
  currentPageLabel,
}: SupportFloatingWidgetProps) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [suggestedActions, setSuggestedActions] = useState<SupportAction[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([
    {
      id: makeId(),
      role: "assistant",
      content: pageWelcome(currentPageLabel),
    },
  ]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSuggestedActions([]);
    setMessages((prev) => {
      const hasUserMessages = prev.some((item) => item.role === "user");
      if (hasUserMessages) return prev;
      return [
        {
          id: makeId(),
          role: "assistant",
          content: pageWelcome(currentPageLabel),
        },
      ];
    });
  }, [currentPageId, currentPageLabel]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, isSending, open]);

  if (currentPageId === "chat") {
    return null;
  }

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;

    const nextUserMessage: SupportMessage = {
      id: makeId(),
      role: "user",
      content: trimmed,
    };

    const nextMessages = [...messages, nextUserMessage];
    setMessages(nextMessages);
    setSuggestedActions([]);
    setDraft("");
    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke<SupportResponse>(
        "customer-support-chat",
        {
          body: {
            message: trimmed,
            pageId: currentPageId,
            pageTitle: currentPageLabel,
            conversation: nextMessages.slice(-6).map((item) => ({
              role: item.role,
              content: item.content,
            })),
          },
        },
      );

      if (error) {
        throw error;
      }

      const assistantReply =
        data?.response?.trim() ||
        "I hit a snag while preparing that answer. Please try again in a moment.";

      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "assistant",
          content: assistantReply,
        },
      ]);
      setSuggestedActions(Array.isArray(data?.suggestedActions) ? data!.suggestedActions! : []);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Support is temporarily unavailable.";
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "assistant",
          content: `I couldn't complete that just now. ${detail} You can also email support@jobraker.com.`,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[90] flex flex-col items-end gap-3 sm:bottom-5 sm:right-5">
      {open ? (
        <div className="flex w-[min(calc(100vw-2rem),420px)] max-h-[min(760px,calc(100dvh-7rem))] flex-col overflow-hidden rounded-3xl border border-foreground/10 bg-background/95 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.75)] backdrop-blur-xl">
          <div className="shrink-0 border-b border-foreground/10 bg-gradient-to-r from-brand/12 via-background to-background px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand/12 text-brand">
                    <LifeBuoy className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Customer care
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Help for {currentPageLabel.toLowerCase()} and the rest of Jobraker
                    </p>
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 rounded-full p-0 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                onClick={() => setOpen(false)}
                aria-label="Close support"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="shrink-0 border-b border-foreground/10 px-4 py-3">
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => void sendMessage(action.prompt)}
                    className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-3 py-2 text-left transition-colors hover:border-brand/30 hover:bg-brand/10"
                  >
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-foreground/5 text-brand">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-xs font-medium text-foreground">{action.label}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            ref={scrollRef}
            className="custom-scrollbar flex min-h-[180px] flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "bg-brand text-black"
                      : "border border-foreground/10 bg-foreground/[0.03] text-foreground"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <div className="mb-1 flex items-center gap-2 text-[11px] font-medium text-brand">
                      <Bot className="h-3.5 w-3.5" />
                      <span>Support AI</span>
                    </div>
                  ) : null}
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}

            {isSending ? (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Thinking through the best next step...</span>
                </div>
              </div>
            ) : null}
          </div>

          {suggestedActions.length > 0 ? (
            <div className="shrink-0 border-t border-foreground/10 px-4 py-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Next actions
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedActions.slice(0, 3).map((action, index) => {
                  if (action.kind === "human") {
                    return (
                      <a
                        key={`${action.label}-${index}`}
                        href="mailto:support@jobraker.com"
                        className="inline-flex items-center gap-1 rounded-full border border-foreground/10 px-3 py-1.5 text-xs text-foreground transition-colors hover:border-brand/30 hover:text-brand"
                      >
                        {action.label}
                        <ArrowUpRight className="h-3 w-3" />
                      </a>
                    );
                  }

                  if (action.route) {
                    return (
                      <Link
                        key={`${action.label}-${index}`}
                        to={action.route}
                        className="inline-flex items-center gap-1 rounded-full border border-foreground/10 px-3 py-1.5 text-xs text-foreground transition-colors hover:border-brand/30 hover:text-brand"
                      >
                        {action.label}
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={`${action.label}-${index}`}
                      type="button"
                      onClick={() => action.prompt && void sendMessage(action.prompt)}
                      className="inline-flex items-center gap-1 rounded-full border border-foreground/10 px-3 py-1.5 text-xs text-foreground transition-colors hover:border-brand/30 hover:text-brand"
                    >
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="shrink-0 border-t border-foreground/10 px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Ask support
              </p>
              <a
                href="mailto:support@jobraker.com"
                className="text-xs text-brand transition-colors hover:text-brand/80"
              >
                Talk to a person
              </a>
            </div>

            <div className="space-y-2">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage(draft);
                  }
                }}
                rows={3}
                placeholder="Ask about billing, job search, resumes, or a problem you hit."
                className="min-h-[84px] resize-none rounded-2xl border-foreground/10 bg-foreground/[0.03] text-sm"
              />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-brand" />
                  Page-aware support for this workspace
                </div>
                <Button
                  type="button"
                  className="rounded-full bg-brand text-black hover:bg-brand/90"
                  disabled={isSending || !draft.trim()}
                  onClick={() => void sendMessage(draft)}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="h-12 rounded-full border border-brand/30 bg-background/95 px-4 text-brand shadow-[0_12px_28px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl hover:bg-brand hover:text-black"
      >
        <MessageSquare className="mr-2 h-4 w-4" />
        Support
      </Button>
    </div>
  );
}
