import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Bot,
  Briefcase,
  CreditCard,
  FileText,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  X,
  CheckCircle,
  User,
  Clock,
} from "lucide-react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabaseClient";

type SupportMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  metadata?: any;
};

type SupportAction = {
  label: string;
  route?: string | null;
  kind?: "navigate" | "human" | "reply";
  prompt?: string | null;
};

type SupportFloatingWidgetProps = {
  currentPageId: string;
  currentPageLabel: string;
  inline?: boolean;
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
  inline = false,
}: SupportFloatingWidgetProps) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [widgetView, setWidgetView] = useState<"list" | "chat">("list");
  const [tickets, setTickets] = useState<any[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [ticketStatus, setTicketStatus] = useState<string>("open");
  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [suggestedActions, setSuggestedActions] = useState<SupportAction[]>([]);
  
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const getInitialSuggestedActions = (pageId: string): SupportAction[] => {
    const common = [
      {
        label: "Contact Support",
        kind: "human" as const,
        route: null,
        prompt: null,
      },
    ];

    switch (pageId) {
      case "overview":
      case "dashboard-overview":
        return [
          {
            label: "Check my Resumes",
            route: "/dashboard/resume",
            kind: "navigate",
          },
          {
            label: "View Application History",
            route: "/dashboard/application",
            kind: "navigate",
          },
          ...common,
        ];
      case "referrals":
      case "dashboard-referrals":
        return [
          {
            label: "Invite friends",
            kind: "reply",
            prompt: "How do I earn Jobricon credits by referring friends?",
          },
          {
            label: "View Referral Rules",
            kind: "reply",
            prompt: "What are the rules and milestone caps for the referral system?",
          },
          ...common,
        ];
      case "jobs":
      case "dashboard-jobs":
        return [
          {
            label: "Find Best-Fit Roles",
            route: "/dashboard/jobs",
            kind: "navigate",
          },
          {
            label: "Explain ranking",
            kind: "reply",
            prompt: "Explain how Jobraker decides which jobs are most worth applying to.",
          },
          ...common,
        ];
      case "application":
      case "dashboard-application":
        return [
          {
            label: "Track applications",
            route: "/dashboard/application",
            kind: "navigate",
          },
          {
            label: "Update status",
            kind: "reply",
            prompt: "How do I update the status of my active job applications?",
          },
          ...common,
        ];
      case "billing":
      case "dashboard-billing":
        return [
          {
            label: "Open billing",
            route: "/dashboard/billing",
            kind: "navigate",
          },
          {
            label: "Compare plans",
            kind: "reply",
            prompt: "Compare Jobraker plans and explain which one fits my usage.",
          },
          ...common,
        ];
      case "resume":
      case "dashboard-resume-home":
        return [
          {
            label: "Open resumes",
            route: "/dashboard/resume",
            kind: "navigate",
          },
          {
            label: "Improve ATS fit",
            kind: "reply",
            prompt: "Show me how to improve ATS alignment without exaggerating my experience.",
          },
          ...common,
        ];
      case "cover-letter":
      case "dashboard-cover-letter-home":
        return [
          {
            label: "Open cover letters",
            route: "/dashboard/cover-letter",
            kind: "navigate",
          },
          {
            label: "Create cover letter",
            kind: "reply",
            prompt: "How do I create a high-converting cover letter using AI?",
          },
          ...common,
        ];
      case "settings":
        return [
          {
            label: "Open settings",
            route: "/dashboard/settings/profile",
            kind: "navigate",
          },
          {
            label: "Change appearance",
            route: "/dashboard/settings/appearance",
            kind: "navigate",
          },
          ...common,
        ];
      case "profile":
      case "dashboard-profile":
        return [
          {
            label: "Open profile",
            route: "/dashboard/profile",
            kind: "navigate",
          },
          {
            label: "Improve match score",
            kind: "reply",
            prompt: "How do I update my profile history to get better matches?",
          },
          ...common,
        ];
      case "analytics":
      case "dashboard-analytics":
        return [
          {
            label: "Open analytics",
            route: "/dashboard/analytics",
            kind: "navigate",
          },
          {
            label: "Explain metrics",
            kind: "reply",
            prompt: "Explain my application velocity and conversion rate trends.",
          },
          ...common,
        ];
      default:
        return [
          {
            label: "Check my Resumes",
            route: "/dashboard/resume",
            kind: "navigate",
          },
          {
            label: "View Application History",
            route: "/dashboard/application",
            kind: "navigate",
          },
          ...common,
        ];
    }
  };

  // Get user info on load
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          setUserId(data.user.id);
        }
      } catch (err) {
        console.error("Failed to load user in SupportFloatingWidget:", err);
      }
    };
    fetchUser();
  }, [supabase]);

  // Fetch all tickets for list view
  const fetchTickets = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setTickets(data || []);
    } catch (err) {
      console.error("Failed to fetch support tickets:", err);
    }
  }, [supabase, userId]);

  useEffect(() => {
    if ((open || inline) && userId) {
      fetchTickets();
    }
  }, [open, inline, userId, fetchTickets]);

  // Fetch messages helper
  const fetchMessages = useCallback(async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      
      const mapped = (data || []).map((msg: any) => ({
        id: msg.id,
        role: msg.sender_role === "user" ? ("user" as const) : ("assistant" as const),
        content: msg.content,
        metadata: msg.metadata || {},
      }));
      setMessages(mapped);

      const lastAiMessage = [...(data || [])].reverse().find((m: any) => m.sender_role === "ai");
      if (lastAiMessage?.metadata?.suggestedActions) {
        setSuggestedActions(lastAiMessage.metadata.suggestedActions);
      } else {
        setSuggestedActions([]);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  }, [supabase]);

  // Real-time message subscription & ticket status tracking
  useEffect(() => {
    if (!activeTicketId) return;

    fetchMessages(activeTicketId);

    const getTicketStatus = async () => {
      try {
        const { data } = await supabase
          .from("support_tickets")
          .select("status")
          .eq("id", activeTicketId)
          .single();
        if (data) {
          setTicketStatus(data.status);
        }
      } catch {}
    };
    getTicketStatus();

    const channel = supabase
      .channel(`support_messages:${activeTicketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${activeTicketId}`,
        },
        async (payload) => {
          const newMsg = payload.new as any;
          const mappedMsg = {
            id: newMsg.id,
            role: newMsg.sender_role === "user" ? ("user" as const) : ("assistant" as const),
            content: newMsg.content,
            metadata: newMsg.metadata || {},
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === mappedMsg.id)) return prev;
            return [...prev, mappedMsg];
          });

          if (newMsg.sender_role === "ai" && newMsg.metadata?.suggestedActions) {
            setSuggestedActions(newMsg.metadata.suggestedActions);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "support_tickets",
          filter: `id=eq.${activeTicketId}`,
        },
        (payload) => {
          const updatedTicket = payload.new as any;
          setTicketStatus(updatedTicket.status);
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [supabase, activeTicketId, fetchMessages]);

  const startNewTicket = async (prompt?: string) => {
    if (!userId) return;
    setIsSending(true);
    try {
      const subject = prompt 
        ? prompt.slice(0, 45) + (prompt.length > 45 ? "..." : "")
        : `Support Session - ${currentPageLabel}`;
      
      const { data: ticket, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({
          user_id: userId,
          subject,
          status: "open",
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Select ticket and go to chat screen
      setActiveTicketId(ticket.id);
      setTicketStatus("open");
      setMessages([]);
      setSuggestedActions(getInitialSuggestedActions(currentPageId));
      setWidgetView("chat");

      // Auto-insert a welcome message or the user's initial prompt
      if (prompt) {
        // Insert user's query
        const { error: userMsgError } = await supabase
          .from("support_messages")
          .insert({
            ticket_id: ticket.id,
            sender_role: "user",
            content: prompt,
          });
        if (userMsgError) throw userMsgError;

        // Trigger Edge Function immediately
        await supabase.functions.invoke("customer-support-chat", {
          body: {
            ticketId: ticket.id,
            pageId: currentPageId,
            pageTitle: currentPageLabel,
          },
        });
      } else {
        // Insert default welcome
        await supabase.from("support_messages").insert({
          ticket_id: ticket.id,
          sender_role: "ai",
          content: pageWelcome(currentPageLabel),
          metadata: { suggestedActions: getInitialSuggestedActions(currentPageId) },
        });
      }

      fetchTickets();
    } catch (err) {
      console.error("Failed to start new support ticket:", err);
    } finally {
      setIsSending(false);
    }
  };

  const requestHumanAgent = async () => {
    if (!activeTicketId) return;
    setIsSending(true);
    try {
      const { error: updateError } = await supabase
        .from("support_tickets")
        .update({ status: "pending_human" })
        .eq("id", activeTicketId);

      if (updateError) throw updateError;
      setTicketStatus("pending_human");

      // Insert message explaining escalation
      await supabase.from("support_messages").insert({
        ticket_id: activeTicketId,
        sender_role: "ai",
        content: "I am connecting you with a human agent. An administrator has been notified and will join the chat shortly. Please feel free to type any additional details below.",
        metadata: {},
      });
      
      fetchTickets();
    } catch (err) {
      console.error("Failed to request human agent:", err);
    } finally {
      setIsSending(false);
    }
  };

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;

    if (!activeTicketId) {
      // If no active ticket, start a new one automatically with this prompt
      await startNewTicket(trimmed);
      return;
    }

    setDraft("");
    setIsSending(true);

    try {
      // 1. Write user message to DB
      const { error: insertError } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: activeTicketId,
          sender_role: "user",
          content: trimmed,
        });

      if (insertError) throw insertError;

      // Update local ticket list updated_at
      fetchTickets();

      // 2. Call AI backend if status is open
      if (ticketStatus === "open") {
        const { error: fnError } = await supabase.functions.invoke(
          "customer-support-chat",
          {
            body: {
              ticketId: activeTicketId,
              pageId: currentPageId,
              pageTitle: currentPageLabel,
            },
          }
        );
        if (fnError) throw fnError;
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      const detail =
        error instanceof Error ? error.message : "Support is temporarily unavailable.";
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "assistant",
          content: `I couldn't complete that just now. ${detail} You can also email support@jobraker.io.`,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, isSending, open, widgetView]);

  const hasUserMessages = messages.some((m) => m.role === "user");

  if (!inline && !open) {
    return (
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden sm:inline-flex fixed bottom-4 right-4 z-[90] h-12 rounded-full border border-brand/30 bg-background/95 px-4 text-brand shadow-[0_12px_28px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl hover:bg-brand hover:text-black sm:bottom-5 sm:right-5"
      >
        <MessageSquare className="mr-2 h-4 w-4" />
        Support
      </Button>
    );
  }

  return (
    <div className={inline ? "flex w-full h-[calc(100vh-200px)] min-h-[500px] flex-col overflow-hidden rounded-2xl border border-border/40 bg-card/30 backdrop-blur-xl" : "hidden sm:flex fixed top-4 bottom-4 right-4 z-[90] w-[min(calc(100vw-2rem),420px)] flex-col overflow-hidden rounded-3xl border border-foreground/10 bg-background/95 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.75)] backdrop-blur-xl sm:top-5 sm:bottom-5 sm:right-5"}>
      {/* Header */}
      <div className="shrink-0 border-b border-foreground/10 bg-gradient-to-r from-brand/12 via-background to-background px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {widgetView === "chat" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 rounded-full p-0 mr-1 hover:bg-foreground/5"
                  onClick={() => {
                    setWidgetView("list");
                    setActiveTicketId(null);
                    setMessages([]);
                    fetchTickets();
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand/12 text-brand">
                <LifeBuoy className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {widgetView === "list" ? "Support Requests" : "Customer Care"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {widgetView === "list" ? "Review and manage your tickets" : `Help for ${currentPageLabel.toLowerCase()}`}
                </p>
              </div>
            </div>
          </div>
          {!inline && (
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
          )}
        </div>
      </div>

      {widgetView === "list" ? (
        /* State 1: Ticket History List */
        <div className="flex flex-1 flex-col overflow-hidden bg-background/30">
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            <Button
              onClick={() => startNewTicket()}
              className="w-full justify-center rounded-2xl border border-brand/20 bg-brand/5 text-brand hover:bg-brand/10 hover:border-brand/40 py-5 font-medium flex items-center gap-2 shadow-inner"
            >
              <Plus className="h-4 w-4" />
              Start New Ticket
            </Button>

            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2 pb-1">
              Your Conversations
            </div>

            {tickets.length === 0 ? (
              <div className="text-center py-12 px-6 border border-dashed border-foreground/10 rounded-2xl bg-foreground/[0.02]">
                <LifeBuoy className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-60" />
                <p className="text-sm text-foreground/80 font-medium mb-1">No tickets yet</p>
                <p className="text-xs text-muted-foreground max-w-[240px] mx-auto leading-relaxed">
                  Start a new conversation to ask questions or report a problem.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {tickets.map((t) => {
                  const statusColors: Record<string, string> = {
                    open: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
                    pending_human: "bg-amber-500/10 text-amber-500 border border-amber-500/20",
                    resolved: "bg-muted-foreground/10 text-muted-foreground border border-muted-foreground/20",
                  };
                  const statusLabels: Record<string, string> = {
                    open: "AI Support",
                    pending_human: "Waiting for Agent",
                    resolved: "Resolved",
                  };
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setActiveTicketId(t.id);
                        setTicketStatus(t.status);
                        setWidgetView("chat");
                      }}
                      className="w-full text-left p-3.5 rounded-2xl border border-foreground/10 bg-foreground/[0.03] transition-all hover:bg-foreground/[0.07] hover:border-brand/20 flex flex-col gap-2 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground group-hover:text-brand transition-colors line-clamp-1">
                          {t.subject}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 uppercase tracking-wider ${statusColors[t.status] || ""}`}>
                          {statusLabels[t.status] || t.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(t.updated_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="text-brand opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                          Open Chat <ArrowUpRight className="h-3 w-3" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* State 2: Active Ticket Chat Area */
        <div className="flex flex-1 flex-col overflow-hidden bg-background/30">
          {/* Quick actions for new empty chat */}
          {!hasUserMessages && (
            <div className="shrink-0 border-b border-foreground/10 px-4 py-3 bg-background/20">
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
          )}

          {/* Messages list */}
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
                    <div className="space-y-1">
                      <div className="mb-1 flex items-center gap-2 text-[11px] font-medium text-brand">
                        <Bot className="h-3.5 w-3.5" />
                        <span>Support AI</span>
                      </div>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        className="prose prose-invert prose-sm max-w-none text-foreground/90 break-words leading-relaxed prose-p:leading-relaxed prose-pre:my-2"
                        components={{
                          a: ({ node: _node, ...props }) => (
                            <a {...props} target="_blank" rel="noreferrer" className="text-brand hover:underline font-medium" />
                          ),
                          pre: ({ node: _node, ...props }) => (
                            <pre {...props} className="bg-black/30 border border-foreground/10 rounded-xl p-3 my-2 overflow-x-auto" />
                          ),
                          code: ({ node: _node, inline, className, children, ...props }: any) => {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                              <code className={`${className} block text-xs font-mono`} {...props}>
                                {children}
                              </code>
                            ) : (
                              <code className="bg-white/5 rounded px-1.5 py-0.5 text-xs font-mono" {...props}>
                                {children}
                              </code>
                            );
                          }
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </div>
            ))}

            {isSending && ticketStatus === "open" ? (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Thinking...</span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Connected banner for non-open statuses */}
          {ticketStatus === "pending_human" && (
            <div className="bg-amber-500/10 border-t border-b border-amber-500/20 px-4 py-2 flex items-center gap-2.5 text-amber-500 text-xs font-medium">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Escalated to human. An administrator will respond here shortly.</span>
            </div>
          )}

          {ticketStatus === "resolved" && (
            <div className="bg-emerald-500/10 border-t border-b border-emerald-500/20 px-4 py-2 flex items-center gap-2.5 text-emerald-500 text-xs font-medium">
              <CheckCircle className="h-3.5 w-3.5" />
              <span>This ticket has been marked as resolved. Feel free to send a message to re-open or ask further questions.</span>
            </div>
          )}

          {/* Suggested Actions */}
          {suggestedActions.length > 0 && ticketStatus === "open" ? (
            <div className="shrink-0 border-t border-foreground/10 px-4 py-3 bg-background/20">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Next actions
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedActions.slice(0, 3).map((action, index) => {
                  if (action.kind === "human") {
                    return (
                      <button
                        key={`${action.label}-${index}`}
                        onClick={() => requestHumanAgent()}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-500 transition-colors hover:bg-amber-500/15"
                      >
                        {action.label}
                        <ArrowUpRight className="h-3 w-3" />
                      </button>
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

          {/* Message input */}
          <div className="shrink-0 border-t border-foreground/10 px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Ask support
              </p>
              {ticketStatus === "open" && (
                <button
                  onClick={() => requestHumanAgent()}
                  className="text-xs text-brand transition-colors hover:text-brand/80"
                >
                  Talk to a person
                </button>
              )}
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
                  {ticketStatus === "open" ? "AI Care Assistant online" : "Human support session"}
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
      )}
    </div>
  );
}
