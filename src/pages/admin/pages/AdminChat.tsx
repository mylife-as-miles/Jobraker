import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabaseClient";
import {
  Search,
  MessageSquare,
  CheckCircle,
  Loader2,
  Bot,
  User,
  Shield,
  Send,
  LifeBuoy,
  Clock,
  ArrowUpRight,
  RefreshCw,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function AdminChat() {
  const supabase = useMemo(() => createClient(), []);
  
  const [tickets, setTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [activeTicket, setActiveTicket] = useState<any | null>(null);
  const [activeUserEmail, setActiveUserEmail] = useState<string | null>(null);
  
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "pending_human" | "resolved">("pending_human");

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch all support tickets
  const fetchTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select(`
          *,
          profiles (
            first_name,
            last_name
          )
        `)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (err) {
      console.error("Failed to load admin support tickets:", err);
    } finally {
      setLoadingTickets(false);
    }
  }, [supabase]);

  // Load tickets on mount
  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Real-time subscription to update ticket list
  useEffect(() => {
    const channel = supabase
      .channel("admin_tickets_updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets" },
        () => {
          fetchTickets();
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [supabase, fetchTickets]);

  // Load messages & user email for the selected ticket
  useEffect(() => {
    if (!activeTicketId) {
      setActiveTicket(null);
      setActiveUserEmail(null);
      setMessages([]);
      return;
    }

    const ticket = tickets.find((t) => t.id === activeTicketId);
    if (ticket) {
      setActiveTicket(ticket);
    }

    const fetchTicketDetails = async () => {
      setLoadingMessages(true);
      try {
        // Fetch creator's email via secure RPC
        const { data: emailData } = await supabase.rpc("get_user_email", {
          user_id: ticket?.user_id,
        });
        if (emailData && emailData.length > 0) {
          setActiveUserEmail(emailData[0].email);
        } else {
          setActiveUserEmail("Unknown Email");
        }

        // Fetch messages
        const { data: messagesData, error } = await supabase
          .from("support_messages")
          .select("*")
          .eq("ticket_id", activeTicketId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        setMessages(messagesData || []);
      } catch (err) {
        console.error("Failed to fetch messages for ticket:", err);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchTicketDetails();

    // Subscribe to support_messages for this active ticket
    const channel = supabase
      .channel(`admin_chat_messages:${activeTicketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${activeTicketId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [supabase, activeTicketId, tickets]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loadingMessages]);

  // Handle take over chat
  const handleTakeOver = async () => {
    if (!activeTicketId) return;
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: "pending_human" })
        .eq("id", activeTicketId);
      if (error) throw error;

      // Add a system log message
      await supabase.from("support_messages").insert({
        ticket_id: activeTicketId,
        sender_role: "admin",
        content: "An administrator has joined the chat and taken over support.",
        metadata: { isSystemLog: true },
      });

      // Update tickets list locally
      fetchTickets();
    } catch (err) {
      console.error("Failed to take over support chat:", err);
    }
  };

  // Handle resolve ticket
  const handleResolve = async () => {
    if (!activeTicketId) return;
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: "resolved" })
        .eq("id", activeTicketId);
      if (error) throw error;

      // Add system message
      await supabase.from("support_messages").insert({
        ticket_id: activeTicketId,
        sender_role: "ai",
        content: "This support ticket has been marked as resolved by the administrator.",
        metadata: { isSystemLog: true },
      });

      fetchTickets();
    } catch (err) {
      console.error("Failed to resolve support ticket:", err);
    }
  };

  // Handle re-open AI support
  const handleReopenAi = async () => {
    if (!activeTicketId) return;
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: "open" })
        .eq("id", activeTicketId);
      if (error) throw error;

      await supabase.from("support_messages").insert({
        ticket_id: activeTicketId,
        sender_role: "ai",
        content: "AI support has been re-enabled for this chat session.",
        metadata: { isSystemLog: true },
      });

      fetchTickets();
    } catch (err) {
      console.error("Failed to reopen AI support:", err);
    }
  };

  // Send admin reply
  const handleSendMessage = async () => {
    const trimmed = draft.trim();
    if (!trimmed || isSending || !activeTicketId) return;

    setIsSending(true);
    setDraft("");

    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id ?? null;

      const { error } = await supabase.from("support_messages").insert({
        ticket_id: activeTicketId,
        user_id: currentUserId,
        sender_role: "admin",
        content: trimmed,
      });

      if (error) throw error;
      fetchTickets(); // Refresh updated_at on list
    } catch (err) {
      console.error("Failed to send support reply:", err);
    } finally {
      setIsSending(false);
    }
  };

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      
      const email = activeTicketId === t.id ? activeUserEmail : "";
      const name = `${t.profiles?.first_name || ""} ${t.profiles?.last_name || ""}`;
      const subject = t.subject || "";
      const matchesSearch =
        searchTerm === "" ||
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.user_id.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [tickets, searchTerm, statusFilter, activeTicketId, activeUserEmail]);

  return (
    <div className='bg-gradient-to-br from-background/40 to-background/10 border border-brand/20 rounded-2xl p-6 min-h-[calc(100vh-140px)] flex flex-col'>
      {/* Header */}
      <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-brand/20'>
        <div>
          <h1 className='text-2xl font-bold text-white flex items-center gap-2'>
            <LifeBuoy className='w-6 h-6 text-brand' />
            Support Helpdesk
          </h1>
          <p className='text-gray-400 text-sm mt-1'>
            Manage and respond to user customer support tickets in real-time.
          </p>
        </div>
        <Button
          onClick={fetchTickets}
          variant='outline'
          className='border-brand/30 hover:border-brand hover:bg-brand/10 text-gray-300 hover:text-brand transition-all flex items-center gap-2 self-start'
        >
          <RefreshCw className='w-4 h-4' />
          Refresh Queue
        </Button>
      </div>

      {/* Main Grid */}
      <div className='flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6 overflow-hidden'>
        {/* Left Column: Tickets Queue list */}
        <div className='lg:col-span-4 flex flex-col bg-background/20 border border-brand/10 rounded-2xl overflow-hidden min-h-[400px] lg:min-h-0'>
          {/* Filters & Search */}
          <div className='p-4 border-b border-brand/10 space-y-3 bg-background/10'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500' />
              <input
                type='text'
                placeholder='Search by name, email, subject...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='w-full pl-9 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-brand focus:outline-none transition-colors text-sm'
              />
            </div>
            
            <div className='flex gap-1.5 p-1 bg-gray-800/40 border border-gray-700/50 rounded-xl'>
              {(["pending_human", "open", "resolved", "all"] as const).map((filter) => {
                const labelMap = {
                  pending_human: "Escalated",
                  open: "AI Chat",
                  resolved: "Resolved",
                  all: "All",
                };
                return (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                      statusFilter === filter
                        ? "bg-brand/20 border border-brand/30 text-brand"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {labelMap[filter]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tickets Queue */}
          <div className='flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar max-h-[500px] lg:max-h-none'>
            {loadingTickets ? (
              <div className='flex flex-col items-center justify-center py-12'>
                <Loader2 className='w-8 h-8 text-brand animate-spin mb-2' />
                <p className='text-sm text-gray-500'>Loading ticket queue...</p>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className='text-center py-12 px-4'>
                <AlertCircle className='w-8 h-8 text-gray-600 mx-auto mb-2' />
                <p className='text-sm text-gray-400 font-medium'>No tickets found</p>
                <p className='text-xs text-gray-500 max-w-[200px] mx-auto mt-1 leading-relaxed'>
                  No support sessions match the selected filter.
                </p>
              </div>
            ) : (
              filteredTickets.map((t) => {
                const isActive = activeTicketId === t.id;
                const statusStyles: Record<string, string> = {
                  open: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                  pending_human: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                  resolved: "bg-gray-700/30 text-gray-400 border border-gray-700/50",
                };
                const statusLabels: Record<string, string> = {
                  open: "AI",
                  pending_human: "Escalated",
                  resolved: "Resolved",
                };

                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTicketId(t.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-2 group ${
                      isActive
                        ? "bg-brand/10 border-brand text-brand shadow-lg shadow-brand/5"
                        : "bg-gray-800/10 border-gray-700/20 hover:bg-gray-800/30 hover:border-brand/30 text-gray-300"
                    }`}
                  >
                    <div className='flex items-start justify-between gap-2'>
                      <span className={`text-sm font-semibold transition-colors line-clamp-1 ${
                        isActive ? "text-brand" : "text-white group-hover:text-brand"
                      }`}>
                        {t.subject}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${statusStyles[t.status] || ""}`}>
                        {statusLabels[t.status] || t.status}
                      </span>
                    </div>

                    <div className='text-xs text-gray-400 flex items-center justify-between'>
                      <span className='flex items-center gap-1'>
                        <User className='w-3 h-3 text-gray-500' />
                        {t.profiles?.first_name 
                          ? `${t.profiles.first_name} ${t.profiles.last_name || ""}`
                          : "Anonymous"}
                      </span>
                      <span className='flex items-center gap-1 font-mono text-[10px]'>
                        <Clock className='w-3 h-3 text-gray-500' />
                        {new Date(t.updated_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat History & Responses */}
        <div className='lg:col-span-8 flex flex-col bg-background/20 border border-brand/10 rounded-2xl overflow-hidden min-h-[500px] lg:min-h-0'>
          {activeTicketId && activeTicket ? (
            <div className='flex flex-1 flex-col overflow-hidden'>
              {/* Active Ticket Header */}
              <div className='p-4 border-b border-brand/10 bg-background/10 flex flex-col md:flex-row md:items-center justify-between gap-4'>
                <div className='space-y-1.5'>
                  <h3 className='text-base font-bold text-white flex items-center gap-2 line-clamp-1'>
                    {activeTicket.subject}
                  </h3>
                  <div className='flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-400'>
                    <span className='flex items-center gap-1.5'>
                      <User className='w-3.5 h-3.5 text-gray-500' />
                      {activeTicket.profiles?.first_name 
                        ? `${activeTicket.profiles.first_name} ${activeTicket.profiles.last_name || ""}` 
                        : "Anonymous"}
                      {activeUserEmail && ` (${activeUserEmail})`}
                    </span>
                    <span className='flex items-center gap-1.5 font-mono text-[11px]'>
                      <Clock className='w-3.5 h-3.5 text-gray-500' />
                      Created: {new Date(activeTicket.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Ticket controls */}
                <div className='flex flex-wrap gap-2'>
                  {activeTicket.status === "open" && (
                    <Button
                      onClick={handleTakeOver}
                      className='bg-brand text-black font-semibold hover:bg-brand/90 text-xs px-3.5 h-9 rounded-xl flex items-center gap-1.5'
                    >
                      <User className='w-3.5 h-3.5' />
                      Take Over Chat
                    </Button>
                  )}
                  {activeTicket.status === "pending_human" && (
                    <Button
                      onClick={handleReopenAi}
                      variant='outline'
                      className='border-emerald-500/30 hover:border-emerald-500 bg-transparent text-emerald-400 hover:bg-emerald-500/10 text-xs px-3.5 h-9 rounded-xl flex items-center gap-1.5'
                    >
                      <Bot className='w-3.5 h-3.5' />
                      Revert to AI
                    </Button>
                  )}
                  {activeTicket.status !== "resolved" && (
                    <Button
                      onClick={handleResolve}
                      variant='outline'
                      className='border-brand/30 hover:border-brand bg-transparent text-gray-300 hover:text-brand hover:bg-brand/10 text-xs px-3.5 h-9 rounded-xl flex items-center gap-1.5'
                    >
                      <CheckCircle className='w-3.5 h-3.5' />
                      Mark Resolved
                    </Button>
                  )}
                  {activeTicket.status === "resolved" && (
                    <Button
                      onClick={handleTakeOver}
                      variant='outline'
                      className='border-brand/30 hover:border-brand bg-transparent text-brand hover:bg-brand/10 text-xs px-3.5 h-9 rounded-xl flex items-center gap-1.5'
                    >
                      <RefreshCw className='w-3.5 h-3.5' />
                      Reopen Ticket
                    </Button>
                  )}
                </div>
              </div>

              {/* Chat Thread */}
              <div className='flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-background/5'>
                {loadingMessages ? (
                  <div className='flex flex-col items-center justify-center h-full'>
                    <Loader2 className='w-10 h-10 text-brand animate-spin mb-2' />
                    <p className='text-sm text-gray-500'>Loading chat transcripts...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className='flex items-center justify-center h-full text-gray-500 text-sm'>
                    No messages in this support session yet.
                  </div>
                ) : (
                  messages.map((m) => {
                    const isAi = m.sender_role === "ai";
                    const isAdmin = m.sender_role === "admin";
                    const isUser = m.sender_role === "user";
                    const isSystem = m.metadata?.isSystemLog === true;

                    if (isSystem) {
                      return (
                        <div key={m.id} className='flex justify-center my-3'>
                          <div className='bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-1.5 text-xs text-gray-400 font-medium flex items-center gap-2'>
                            <LifeBuoy className='w-3.5 h-3.5 text-brand' />
                            {m.content}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={m.id}
                        className={`flex ${isUser ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed border shadow-md ${
                            isUser
                              ? "bg-gray-800/40 border-gray-700/50 text-white"
                              : isAdmin
                              ? "bg-brand text-black border-brand/20"
                              : "bg-brand/5 border-brand/20 text-brand"
                          }`}
                        >
                          <div className='flex items-center justify-between gap-6 mb-1 text-[11px] font-semibold opacity-70'>
                            <span className='flex items-center gap-1.5'>
                              {isUser ? (
                                <>
                                  <User className='w-3 h-3' />
                                  <span>User</span>
                                </>
                              ) : isAdmin ? (
                                <>
                                  <Shield className='w-3 h-3' />
                                  <span>Administrator</span>
                                </>
                              ) : (
                                <>
                                  <Bot className='w-3 h-3' />
                                  <span>Support AI</span>
                                </>
                              )}
                            </span>
                            <span className='font-mono text-[9px]'>
                              {new Date(m.created_at).toLocaleTimeString(undefined, {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>

                          {!isUser ? (
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              className={`prose prose-sm max-w-none break-words leading-relaxed prose-p:leading-relaxed prose-pre:my-2 ${
                                isAdmin ? "prose-invert text-black font-medium prose-a:underline" : "prose-invert text-foreground/95"
                              }`}
                              components={{
                                a: ({ node: _node, ...props }) => (
                                  <a {...props} target="_blank" rel="noreferrer" className={isAdmin ? "text-black font-bold" : "text-brand hover:underline font-medium"} />
                                ),
                                pre: ({ node: _node, ...props }) => (
                                  <pre {...props} className="bg-black/35 border border-foreground/10 rounded-xl p-3 my-2 overflow-x-auto" />
                                ),
                                code: ({ node: _node, inline, className, children, ...props }: any) => {
                                  const match = /language-(\w+)/.exec(className || '');
                                  return !inline && match ? (
                                    <code className={`${className} block text-xs font-mono`} {...props}>
                                      {children}
                                    </code>
                                  ) : (
                                    <code className="bg-black/10 rounded px-1.5 py-0.5 text-xs font-mono" {...props}>
                                      {children}
                                    </code>
                                  );
                                }
                              }}
                            >
                              {m.content}
                            </ReactMarkdown>
                          ) : (
                            <p className='whitespace-pre-wrap'>{m.content}</p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input or Take Over Helper */}
              <div className='p-4 border-t border-brand/10 bg-background/10 shrink-0'>
                {activeTicket.status === "pending_human" ? (
                  <div className='space-y-2'>
                    <div className='flex items-center gap-2 text-xs text-brand font-semibold'>
                      <Shield className='w-3.5 h-3.5' />
                      Live session — Admin Response
                    </div>
                    <div className='flex gap-2 items-end'>
                      <Textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void handleSendMessage();
                          }
                        }}
                        rows={2}
                        placeholder='Type your response to the user here...'
                        className='flex-1 min-h-[50px] max-h-[120px] resize-none rounded-xl border-gray-700 bg-gray-800 text-sm focus:border-brand'
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={isSending || !draft.trim()}
                        className='bg-brand hover:bg-brand/90 text-black font-semibold h-11 rounded-xl px-4 flex items-center justify-center shrink-0'
                      >
                        {isSending ? (
                          <Loader2 className='w-4 h-4 animate-spin' />
                        ) : (
                          <Send className='w-4 h-4' />
                        )}
                      </Button>
                    </div>
                  </div>
                ) : activeTicket.status === "open" ? (
                  <div className='flex flex-col items-center justify-center p-4 border border-dashed border-brand/30 rounded-xl bg-brand/5 text-center gap-3'>
                    <Bot className='w-8 h-8 text-brand animate-pulse' />
                    <div>
                      <p className='text-sm text-white font-semibold'>AI Support is active</p>
                      <p className='text-xs text-gray-400 max-w-[340px] mx-auto mt-0.5 leading-relaxed'>
                        The AI assistant is responding to the user. Click below to take over control and chat one-on-one with the user.
                      </p>
                    </div>
                    <Button
                      onClick={handleTakeOver}
                      className='bg-brand text-black font-semibold hover:bg-brand/90 text-xs px-4 h-9 rounded-xl flex items-center gap-1.5'
                    >
                      <User className='w-3.5 h-3.5' />
                      Take Over Session
                    </Button>
                  </div>
                ) : (
                  <div className='flex items-center justify-center p-4 border border-dashed border-gray-700 rounded-xl bg-gray-800/10 text-center gap-2 text-gray-500 text-sm'>
                    <CheckCircle className='w-4 h-4 text-emerald-500' />
                    This support ticket has been resolved. You can click "Take Over Session" to re-open it.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className='flex-1 flex flex-col items-center justify-center text-center p-8'>
              <MessageSquare className='w-12 h-12 text-gray-600 mb-3 opacity-60' />
              <h3 className='text-base font-bold text-white mb-1'>No Ticket Selected</h3>
              <p className='text-sm text-gray-500 max-w-[280px] leading-relaxed'>
                Select a support request from the queue to view its chat logs and response options.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
