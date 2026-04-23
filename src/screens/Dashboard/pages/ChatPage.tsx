// Clean AI-elements only Chat Page implementation
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { nanoid } from "nanoid";
import SyntaxHighlighter from "react-syntax-highlighter/dist/esm/light";
import atomOneDarkStyle from "react-syntax-highlighter/dist/esm/styles/hljs/atom-one-dark";
import js from "react-syntax-highlighter/dist/esm/languages/hljs/javascript";
import ts from "react-syntax-highlighter/dist/esm/languages/hljs/typescript";
import python from "react-syntax-highlighter/dist/esm/languages/hljs/python";
import bash from "react-syntax-highlighter/dist/esm/languages/hljs/bash";
import json from "react-syntax-highlighter/dist/esm/languages/hljs/json";
import css from "react-syntax-highlighter/dist/esm/languages/hljs/css";
import sql from "react-syntax-highlighter/dist/esm/languages/hljs/sql";
import xml from "react-syntax-highlighter/dist/esm/languages/hljs/xml";

SyntaxHighlighter.registerLanguage("javascript", js);
SyntaxHighlighter.registerLanguage("js", js);
SyntaxHighlighter.registerLanguage("typescript", ts);
SyntaxHighlighter.registerLanguage("ts", ts);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("shell", bash);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("css", css);
SyntaxHighlighter.registerLanguage("sql", sql);
SyntaxHighlighter.registerLanguage("html", xml);
SyntaxHighlighter.registerLanguage("xml", xml);
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useNavigate } from "react-router-dom";
import { createClient } from "../../../lib/supabaseClient";
import {
  cacheChatAttachment,
  getChatAttachment,
} from "../../../lib/chatAttachmentIdb";
import {
  MessageSquare,
  Wand2,
  Target,
  FileText,
  Sparkles,
  Zap,
  Plus,
  Search,
  Trash2,
  Bot,
  Bolt,
  BookOpen,
  Paperclip,
  ArrowUp,
  ArrowDown,
  PanelLeft,
  X,
  Coins,
} from "lucide-react";
import { UpgradePrompt } from "../../../components/UpgradePrompt";
import { useToast } from "../../../components/ui/toast-provider";
import { useSubscriptionTier } from "@/hooks/useSubscriptionTier";
import { hasSubscriptionAccess } from "@/lib/subscriptionAccess";

// Custom styles for the new design
const customStyles = `
  .glass-panel {
    background: hsl(var(--card) / 0.72);
    backdrop-filter: blur(12px);
    border: 1px solid hsl(var(--border) / 0.7);
  }
  .suggestion-card:hover {
    border-color: hsl(var(--brand) / 0.55);
    background: hsl(var(--brand) / 0.08);
  }
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: hsl(var(--border) / 0.85);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--foreground) / 0.2);
  }
`;

// Real-deal streaming useChat hook
type Persona = "concise" | "friendly" | "analyst" | "coach";
type ChatMode = "ask" | "agent";
type ChatRequestOptions = {
  model?: string;
  webSearch?: boolean;
  system?: string;
  mode?: ChatMode;
};
type ChatUiAction = {
  type?: string;
  route?: string;
  replace?: boolean;
  pageId?: string | null;
  pageTitle?: string | null;
};
interface ToolCallEntry {
  name: string;
  args?: Record<string, unknown>;
  status: "running" | "done" | "error";
}
interface BasicMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts?: { type: "text"; text: string }[];
  streaming?: boolean;
  createdAt: number;
  meta?: { persona?: Persona; parent?: string };
  toolCalls?: ToolCallEntry[];
  /** Persisted: user message included an image (bytes live in IndexedDB). */
  hasPastedImage?: boolean;
}

type ChatUserPayload = {
  role: "user";
  content: string;
  images?: { mimeType: string; data: string; name?: string }[];
};
interface UseChatOptions {
  api: string;
  initialMessages?: BasicMessage[];
  onFinish?: (msg: BasicMessage) => void;
  /** Fired when agent mode charges extra credits for a tool round */
  onCreditsUpdated?: () => void;
  onUiAction?: (action: ChatUiAction) => void;
}
interface UseChatReturn {
  messages: BasicMessage[];
  status: "idle" | "in_progress";
  append: (m: ChatUserPayload, opts?: ChatRequestOptions) => void;
  regenerate: () => void;
  setMessages: (m: BasicMessage[]) => void;
  responseId: string | null;
  setResponseId: (id: string | null) => void;
}

type ChatSessionRecord = {
  id: string;
  title?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  messages?: unknown;
  response_id?: string | null;
  responseId?: string | null;
  persona?: string | null;
  model?: string | null;
};

type ChatSessionState = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  created_at?: string;
  updated_at?: string;
  messages: BasicMessage[];
  responseId?: string | null;
  persona?: string | null;
  model?: string | null;
};

const DEFAULT_CHAT_MODEL = "gemini-3-flash-preview";

const normalizeBasicMessage = (message: any): BasicMessage => ({
  id: typeof message?.id === "string" ? message.id : nanoid(),
  role: message?.role === "assistant" ? "assistant" : "user",
  content: typeof message?.content === "string" ? message.content : "",
  parts:
    Array.isArray(message?.parts) && message.parts.length > 0
      ? message.parts
      : [
          {
            type: "text" as const,
            text: typeof message?.content === "string" ? message.content : "",
          },
        ],
  streaming: Boolean(message?.streaming),
  createdAt:
    typeof message?.createdAt === "number" ? message.createdAt : Date.now(),
  meta:
    message?.meta && typeof message.meta === "object"
      ? message.meta
      : undefined,
  hasPastedImage: Boolean(message?.hasPastedImage),
});

const normalizeChatSession = (session: ChatSessionRecord): ChatSessionState => {
  const createdAtMs = session.created_at
    ? new Date(session.created_at).getTime()
    : Date.now();
  const updatedAtMs = session.updated_at
    ? new Date(session.updated_at).getTime()
    : createdAtMs;

  return {
    id: session.id,
    title:
      typeof session.title === "string" && session.title.trim()
        ? session.title
        : "New Chat",
    createdAt: createdAtMs,
    updatedAt: updatedAtMs,
    created_at: session.created_at ?? undefined,
    updated_at: session.updated_at ?? undefined,
    messages: Array.isArray(session.messages)
      ? session.messages.map(normalizeBasicMessage)
      : [],
    responseId: session.responseId ?? session.response_id ?? null,
    persona: session.persona ?? null,
    model: session.model ?? null,
  };
};

const useChat = (opts: UseChatOptions): UseChatReturn => {
  const [messages, setMessages] = useState<BasicMessage[]>(
    opts.initialMessages || [],
  );
  const [status, setStatus] = useState<"idle" | "in_progress">("idle");
  const [responseId, setResponseId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastTurnRef = useRef<{
    message: ChatUserPayload;
    chatOpts?: ChatRequestOptions;
    historyBeforeUser: BasicMessage[];
  } | null>(null);

  const sendMessage = useCallback(
    async (
      baseMessages: BasicMessage[],
      m: ChatUserPayload,
      chatOpts?: ChatRequestOptions,
      previousResponseId?: string | null,
    ) => {
      if (status === "in_progress") return;

      const textContent = m.content.trim();
      const userMessage: BasicMessage = {
        id: nanoid(),
        role: "user",
        content: textContent,
        hasPastedImage: Boolean(m.images?.length),
        createdAt: Date.now(),
        parts: [
          {
            type: "text",
            text: textContent || (m.images?.length ? " " : ""),
          },
        ],
      };

      if (m.images?.length) {
        const img0 = m.images[0];
        if (img0?.data) {
          void cacheChatAttachment({
            messageId: userMessage.id,
            mimeType: img0.mimeType || "image/png",
            name: img0.name || "attachment",
            base64: img0.data,
          });
        }
      }

      const history = [...baseMessages, userMessage];
      lastTurnRef.current = {
        message: m,
        chatOpts,
        historyBeforeUser: baseMessages,
      };
      setMessages(history);
      setStatus("in_progress");

      const assistantId = nanoid();
      const assistantMessage: BasicMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        parts: [{ type: "text", text: "" }],
        streaming: true,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      const supabase = createClient();
      const supabaseUrl =
        import.meta.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
      const fnUrl = `${supabaseUrl}/functions/v1/ai-chat`;

      abortControllerRef.current = new AbortController();

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const response = await fetch(fnUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            model: chatOpts?.model || DEFAULT_CHAT_MODEL,
            messages: history
              .filter((msg, idx, arr) => {
                const isLast = idx === arr.length - 1;
                if (isLast && msg.role === "user") {
                  return msg.content.trim() !== "" || Boolean(m.images?.length);
                }
                return msg.role === "assistant" || msg.content.trim() !== "";
              })
              .map((msg, idx, arr) => {
                const isLast = idx === arr.length - 1;
                if (isLast && msg.role === "user" && m.images?.length) {
                  return {
                    role: "user",
                    content: msg.content.trim(),
                    images: m.images.map(({ mimeType, data, name }) => ({
                      mimeType,
                      data,
                      ...(name ? { name } : {}),
                    })),
                  };
                }
                return { role: msg.role, content: msg.content.trim() };
              }),
            mode: chatOpts?.mode || "ask",
            webSearch: chatOpts?.webSearch ?? false,
            system: chatOpts?.system,
            previous_response_id: previousResponseId ?? responseId,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "");
          let errorMessage = response.statusText || "Chat request failed";
          try {
            const parsed = JSON.parse(errorBody);
            if (parsed.code === "insufficient_credits") {
              errorMessage =
                parsed.error ||
                "You've run out of free messages and credits. Purchase more credits to continue.";
            } else if (
              parsed.code === "rate_limit" ||
              parsed.code === "daily_limit"
            ) {
              errorMessage =
                parsed.error || "Too many messages. Please wait a moment.";
            } else if (parsed.error) {
              errorMessage = parsed.error;
            }
          } catch {
            if (errorBody) errorMessage = errorBody;
          }
          throw new Error(errorMessage);
        }

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        let currentEvent = "message";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");

          // Keep the last line in the buffer if it's incomplete
          const endsWithNewLine = buffer.endsWith("\n");
          if (!endsWithNewLine) {
            buffer = lines.pop() || "";
          } else {
            buffer = "";
          }

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            if (trimmedLine.startsWith("event:")) {
              currentEvent = trimmedLine.slice(6).trim();
            } else if (trimmedLine.startsWith("data:")) {
              const dataStr = trimmedLine.slice(5).trim();
              if (dataStr === "[DONE]") continue;

              try {
                const data = JSON.parse(dataStr);

                if (currentEvent === "message") {
                  if (data.delta) {
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantId
                          ? {
                              ...msg,
                              content: msg.content + data.delta,
                              parts: [
                                {
                                  type: "text",
                                  text: msg.content + data.delta,
                                },
                              ],
                            }
                          : msg,
                      ),
                    );
                  }
                } else if (currentEvent === "response_id") {
                  if (data.response_id) {
                    setResponseId(data.response_id);
                  }
                } else if (currentEvent === "error") {
                  const errorText = `Error: ${data.error}`;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantId
                        ? {
                            ...msg,
                            content: errorText,
                            parts: [{ type: "text", text: errorText }],
                            streaming: false,
                          }
                        : msg,
                    ),
                  );
                } else if (currentEvent === "tool_call") {
                  const toolEntry: ToolCallEntry = {
                    name: data.name,
                    args: data.args,
                    status: data.result?.error ? "error" : "done",
                  };
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantId
                        ? {
                            ...msg,
                            toolCalls: [...(msg.toolCalls || []), toolEntry],
                          }
                        : msg,
                    ),
                  );
                } else if (currentEvent === "agent_surcharge") {
                  opts.onCreditsUpdated?.();
                } else if (currentEvent === "ui_action") {
                  opts.onUiAction?.(data as ChatUiAction);
                }
              } catch (e) {
                // Ignore parse errors for partial lines
              }
            }
          }
        }

        // Done
        setMessages((prev) => {
          let finalAssistantMessage: BasicMessage | undefined;
          const finalMessages = prev.map((msg) => {
            if (msg.id === assistantId) {
              finalAssistantMessage = { ...msg, streaming: false };
              return finalAssistantMessage;
            }
            return msg;
          });
          if (opts.onFinish && finalAssistantMessage) {
            opts.onFinish(finalAssistantMessage);
          }
          return finalMessages;
        });
        setStatus("idle");
      } catch (err: any) {
        if (err.name === "AbortError") {
          setStatus("idle");
          return;
        }
        const errorText = `Fetch Error: ${err.message || "Could not connect to the chat function."}`;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content: errorText,
                  parts: [{ type: "text", text: errorText }],
                  streaming: false,
                }
              : msg,
          ),
        );
        setStatus("idle");
      } finally {
        abortControllerRef.current = null;
      }
    },
    [responseId, status, opts.onFinish, opts.onCreditsUpdated],
  );

  const append = useCallback(
    (m: ChatUserPayload, chatOpts?: ChatRequestOptions) => {
      void sendMessage(messages, m, chatOpts, responseId);
    },
    [messages, responseId, sendMessage],
  );

  const regenerate = () => {
    if (status === "in_progress" || !lastTurnRef.current) return;
    const lastTurn = lastTurnRef.current;
    setMessages(lastTurn.historyBeforeUser);
    setResponseId(null);
    void sendMessage(
      lastTurn.historyBeforeUser,
      lastTurn.message,
      lastTurn.chatOpts,
      null,
    );
  };

  return {
    messages,
    status,
    append,
    regenerate,
    setMessages,
    responseId,
    setResponseId,
  };
};

async function fileToChatImagePart(
  file: File,
): Promise<{ mimeType: string; data: string; name: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  const mimeType = match?.[1] || file.type || "image/png";
  const data = match?.[2] || "";
  return { mimeType, data, name: file.name || "attachment" };
}

function UserChatAttachment({
  messageId,
  hasPastedImage,
}: {
  messageId: string;
  hasPastedImage?: boolean;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!hasPastedImage) return;
    let cancelled = false;
    void getChatAttachment(messageId).then((row) => {
      if (cancelled || !row) return;
      setSrc(`data:${row.mimeType};base64,${row.base64}`);
    });
    return () => {
      cancelled = true;
    };
  }, [messageId, hasPastedImage]);
  if (!hasPastedImage || !src) return null;
  return (
    <img
      src={src}
      alt=''
      className='rounded-lg max-h-56 max-w-full mb-2 border border-primary-foreground/25 object-contain bg-black/10'
    />
  );
}

export const ChatPage = () => {
  const { error: toastError } = useToast();
  const navigate = useNavigate();
  // UI state
  const [text, setText] = useState("");
  const [persona, setPersona] = useState<Persona>("analyst");
  const [sessions, setSessions] = useState<ChatSessionState[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const supabase = useMemo(() => createClient(), []);
  const { subscriptionTier, loadingTier } = useSubscriptionTier();
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentPreviewUrl = useMemo(() => {
    if (!attachment?.type?.startsWith("image/")) return null;
    return URL.createObjectURL(attachment);
  }, [attachment]);

  useEffect(() => {
    return () => {
      if (attachmentPreviewUrl) URL.revokeObjectURL(attachmentPreviewUrl);
    };
  }, [attachmentPreviewUrl]);

  const hasChatAccess = hasSubscriptionAccess(subscriptionTier, "Pro");

  const [chatQuota, setChatQuota] = useState<{
    free_remaining: number;
    free_total: number;
    credit_balance: number;
    plan_name?: string;
  } | null>(null);

  const fetchChatQuota = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user?.id) return;
      const { data } = await supabase.rpc("get_chat_quota_status", {
        p_user_id: userData.user.id,
      });
      if (data) setChatQuota(data);
    } catch {
      // Quota display is non-critical
    }
  }, [supabase]);

  useEffect(() => {
    if (hasChatAccess) fetchChatQuota();
  }, [hasChatAccess, fetchChatQuota]);

  // Chat logic
  const chat = useChat({
    api: "/api/ai-chat",
    onFinish: () => {
      fetchChatQuota();
    },
    onCreditsUpdated: fetchChatQuota,
    onUiAction: (action) => {
      if (action?.type !== "navigate" || !action.route) return;
      navigate(action.route, { replace: Boolean(action.replace) });
    },
  });
  const {
    messages,
    status,
    append,
    regenerate,
    setMessages,
    responseId,
    setResponseId,
  } = chat;

  // Session management with Supabase -----------------------------------------
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  const createSession = useCallback(
    async (activate = true) => {
      const sessionMode: ChatMode = persona === "analyst" ? "agent" : "ask";
      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({
          title: "New Chat",
          persona: sessionMode,
          model: DEFAULT_CHAT_MODEL,
        })
        .select()
        .single();

      if (error) {
        toastError("Could not create chat", error.message);
        return null;
      }
      if (data) {
        const normalized = normalizeChatSession(data as ChatSessionRecord);
        setSessions((prev) =>
          [normalized, ...prev].sort(
            (a, b) =>
              new Date(b.updated_at || 0).getTime() -
              new Date(a.updated_at || 0).getTime(),
          ),
        );
        if (activate) setActiveSessionId(normalized.id);
        return normalized.id;
      }
      return null;
    },
    [persona, supabase, toastError],
  );

  const loadSessions = useCallback(async () => {
    const { data, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      toastError("Could not load chats", error.message);
      return;
    }
    if (data && data.length > 0) {
      const normalizedSessions = (data as ChatSessionRecord[]).map(
        normalizeChatSession,
      );
      setSessions(normalizedSessions);
      setActiveSessionId(normalizedSessions[0]?.id || null);
    } else {
      // No sessions, create one
      await createSession(true);
    }
  }, [createSession, supabase, toastError]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const prevSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeSessionId) return;
    if (activeSessionId === prevSessionIdRef.current) return;
    prevSessionIdRef.current = activeSessionId;

    const active = sessions.find((s) => s.id === activeSessionId);
    if (active) {
      setMessages(active.messages || []);
      setResponseId(active.responseId || null);
      if (active.persona === "agent") {
        setPersona("analyst");
      } else if (active.persona === "ask") {
        setPersona("concise");
      }
    }
  }, [activeSessionId, sessions, setMessages, setResponseId]);

  // Debounced save to DB
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!activeSessionId || status === "in_progress") return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      const currentMessages = messages;
      const currentResponseId = responseId;
      const active = sessionsRef.current.find((s) => s.id === activeSessionId);

      if (active) {
        const hasChanged =
          JSON.stringify(active.messages) !== JSON.stringify(currentMessages) ||
          active.responseId !== currentResponseId;
        if (!hasChanged) return;

        const { error } = await supabase
          .from("chat_sessions")
          .update({
            messages: currentMessages as any,
            response_id: currentResponseId,
          })
          .eq("id", activeSessionId);

        if (!error) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSessionId
                ? {
                    ...s,
                    messages: currentMessages,
                    responseId: currentResponseId,
                    persona:
                      s.persona || (persona === "analyst" ? "agent" : "ask"),
                    model: s.model || DEFAULT_CHAT_MODEL,
                    updated_at: new Date().toISOString(),
                  }
                : s,
            ),
          );
        }
      }
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [messages, persona, responseId, activeSessionId, status, supabase]);

  const deleteSession = async (id: string) => {
    const originalSessions = sessions;
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) {
      const remaining = originalSessions.filter((s) => s.id !== id);
      setActiveSessionId(remaining[0]?.id || null);
    }

    const { error } = await supabase
      .from("chat_sessions")
      .delete()
      .eq("id", id);

    if (error) {
      toastError("Could not delete chat", error.message);
      setSessions(originalSessions);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachment(e.target.files[0]);
    }
  };

  const handlePasteImage = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items?.length) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind !== "file") continue;
        const file = item.getAsFile();
        if (file) files.push(file);
      }
      const imageFile = files.find((f) => f.type.startsWith("image/"));
      if (!imageFile) return;

      e.preventDefault();
      const ext =
        imageFile.name.split(".").pop()?.toLowerCase() ||
        imageFile.type.split("/")[1]?.split("+")[0] ||
        "png";
      const needsName =
        !imageFile.name ||
        !imageFile.name.includes(".") ||
        imageFile.name === "image.png";
      const file = needsName
        ? new File([imageFile], `pasted-screenshot-${Date.now()}.${ext}`, {
            type: imageFile.type || "image/png",
          })
        : imageFile;

      setAttachment(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [],
  );

  const handleSubmit = async (message: { text: string }) => {
    if ((!message.text.trim() && !attachment) || status === "in_progress")
      return;

    const attachmentFile = attachment;
    setText("");
    setAttachment(null);
    const textarea = textareaRef.current;
    if (textarea) textarea.style.height = "auto";

    let images: { mimeType: string; data: string; name: string }[] | undefined;
    if (attachmentFile) {
      try {
        images = [await fileToChatImagePart(attachmentFile)];
      } catch (e) {
        console.error(e);
        toastError(
          "Could not read the image. Try again or use a smaller file.",
        );
        return;
      }
    }

    const content = message.text || "";

    const systemInstruction = {
      concise: "You are a concise and direct assistant.",
      friendly: "You are a friendly and encouraging assistant.",
      analyst:
        "You are JobRaker Agent, a high-performance career assistant with access to the user's JobRaker profile, resume, tracked jobs, applications, app pages, and edge functions. Use your tools to search for jobs, analyze fit, generate documents, refresh multi-stage application pipelines, open the right app pages, and launch URL-first apply flows. Be proactive, professional, and data-driven.",
      coach: "You are a career coach who gives actionable advice.",
    }[persona];

    const sessionId = activeSessionId || (await createSession(true));
    if (!sessionId) {
      toastError("Could not start chat", "Please try again.");
      return;
    }

    const currentMessages =
      sessions.find((s) => s.id === sessionId)?.messages || [];

    const mode = persona === "analyst" ? "agent" : "ask";
    const model = DEFAULT_CHAT_MODEL;

    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId ? { ...s, persona: mode, model } : s,
      ),
    );
    void supabase
      .from("chat_sessions")
      .update({ persona: mode, model })
      .eq("id", sessionId);

    append(
      {
        role: "user",
        content: content.trim(),
        ...(images ? { images } : {}),
      },
      {
        model,
        webSearch: mode === "agent",
        system: currentMessages.length === 0 ? systemInstruction : undefined,
        mode,
      },
    );

    const isFirstMessage =
      currentMessages.filter((m) => m.role === "user").length === 0;

    if (isFirstMessage && sessionId) {
      const optimisticTitle = (
        message.text.trim() || (attachmentFile ? "Image" : "New Chat")
      ).slice(0, 40);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, title: optimisticTitle } : s,
        ),
      );

      (async () => {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const supabaseUrl =
            import.meta.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
          const fnUrl = `${supabaseUrl}/functions/v1/generate-title`;

          const response = await fetch(fnUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              message:
                message.text.trim() ||
                (attachmentFile ? "User shared a screenshot" : ""),
            }),
          });

          if (response.ok) {
            const { title } = await response.json();
            if (title) {
              setSessions((prev) =>
                prev.map((s) => (s.id === sessionId ? { ...s, title } : s)),
              );
              await supabase
                .from("chat_sessions")
                .update({ title })
                .eq("id", sessionId);
            }
          }
        } catch (error) {
          console.error("Failed to generate AI title", error);
        }
      })();
    }

    setText("");
  };

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const updateScrollState = useCallback(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollToBottom(distanceFromBottom > 160);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    updateScrollState();
  }, [messages.length, updateScrollState]);

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(query) ||
        s.messages.some((m) => m.content.toLowerCase().includes(query)),
    );
  }, [sessions, searchQuery]);

  return (
    <div className='relative flex h-full w-full font-sans bg-background overflow-hidden text-foreground'>
      <style>{customStyles}</style>

      {loadingTier && (
        <div className='absolute inset-0 z-50 flex items-center justify-center bg-background'>
          <div className='text-foreground text-center'>
            <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4'></div>
            <p className='text-foreground/90'>Loading...</p>
          </div>
        </div>
      )}

      {!loadingTier && !hasChatAccess && (
        <div className='flex items-center justify-center h-full w-full p-4 sm:p-6 z-40'>
          <UpgradePrompt
            title='AI Chat Assistant'
            description='Unlock intelligent job search conversations with our advanced AI assistant.'
            features={[
              {
                icon: <MessageSquare className='h-5 w-5' />,
                title: "AI Conversations",
                description:
                  "50 free messages/month on Pro, 200 on Ultimate, then 1 credit each",
              },
              {
                icon: <Wand2 className='h-5 w-5' />,
                title: "Resume Optimization",
                description:
                  "Get AI-powered suggestions to improve your resume",
              },
              {
                icon: <FileText className='h-5 w-5' />,
                title: "Cover Letter Generation",
                description:
                  "Create tailored cover letters for any job posting",
              },
              {
                icon: <Target className='h-5 w-5' />,
                title: "Job Match Analysis",
                description: "Understand how well you fit each opportunity",
              },
              {
                icon: <Sparkles className='h-5 w-5' />,
                title: "Smart Recommendations",
                description: "Receive personalized career advice and insights",
              },
              {
                icon: <Zap className='h-5 w-5' />,
                title: "Priority Support",
                description: "Get faster responses and dedicated assistance",
              },
            ]}
            requiredTier='Pro'
            icon={<MessageSquare className='h-12 w-12 text-brand' />}
          />
        </div>
      )}

      {!loadingTier && hasChatAccess && (
        <>
          <aside
            className={`w-72 bg-card/40 border-r border-border flex flex-col h-full z-20 transition-all duration-300 ${sidebarCollapsed ? "-ml-72" : ""}`}
          >
            <div className='p-6'>
              <button
                onClick={() => createSession()}
                className='w-full bg-brand hover:bg-brand/90 text-primary-foreground font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-brand/20'
              >
                <Plus size={20} />
                New Chat
              </button>
            </div>

            <div className='px-6 mb-4'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4' />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='w-full bg-background/60 border border-border focus:ring-1 focus:ring-brand focus:border-brand rounded-xl pl-10 py-2.5 text-sm outline-none text-foreground placeholder:text-muted-foreground'
                  placeholder='Search conversations...'
                  type='text'
                />
              </div>
            </div>

            <div className='flex-1 overflow-y-auto px-4 custom-scrollbar'>
              <div className='mb-4'>
                <p className='px-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2'>
                  Recent Chats
                </p>
                <div className='space-y-1'>
                  {filteredSessions.length > 0 ? (
                    filteredSessions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setActiveSessionId(s.id)}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors group text-left ${
                          s.id === activeSessionId
                            ? "bg-accent/50 border border-border"
                            : "hover:bg-accent/30 border border-transparent"
                        }`}
                      >
                        <MessageSquare
                          className={`w-5 h-5 ${s.id === activeSessionId ? "text-brand" : "text-muted-foreground group-hover:text-brand"} transition-colors`}
                        />
                        <div className='flex-1 overflow-hidden'>
                          <p className='text-sm font-medium truncate text-foreground'>
                            {s.title || "New Chat"}
                          </p>
                          <p className='text-[11px] text-muted-foreground mt-0.5'>
                            {new Date(
                              s.updated_at || s.updatedAt || Date.now(),
                            ).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                        <div className='opacity-0 group-hover:opacity-100 flex items-center'>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSession(s.id);
                            }}
                            className='p-1 hover:text-brand text-foreground/60 rounded'
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className='px-3 py-4 text-center text-muted-foreground text-xs'>
                      No conversations found
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>

          <main className='flex-1 relative flex flex-col bg-background overflow-hidden'>
            <header className='h-16 flex items-center justify-between px-8 border-b border-border shrink-0 bg-background/85 backdrop-blur-sm'>
              <div className='flex items-center gap-3'>
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className='mr-3 text-foreground/60 hover:text-foreground transition-colors'
                >
                  <PanelLeft size={20} />
                </button>
                <h2 className='font-semibold text-lg text-foreground'>
                  AI Assistant
                </h2>
                <span className='bg-brand/10 text-brand text-[10px] font-bold px-2 py-0.5 rounded-full border border-brand/20'>
                  BETA
                </span>
              </div>
              <div className='flex items-center gap-4'>
                {chatQuota && (
                  <div className='flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/70 border border-border'>
                    <Coins size={14} className='text-brand' />
                    <span className='text-xs font-medium text-foreground'>
                      {chatQuota.free_remaining > 0
                        ? `${chatQuota.free_remaining}/${chatQuota.free_total} free`
                        : `${chatQuota.credit_balance} credits`}
                    </span>
                  </div>
                )}
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/70 border border-border`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${status === "in_progress" ? "bg-brand animate-pulse" : "bg-brand"} `}
                  ></div>
                  <span className='text-xs font-medium text-foreground'>
                    {status === "in_progress" ? "Generating..." : "Ready"}
                  </span>
                </div>
                {messages.length > 0 && (
                  <button
                    onClick={regenerate}
                    className='text-sm font-medium text-brand hover:underline px-3 py-1.5 flex items-center gap-1'
                  >
                    Regenerate
                  </button>
                )}
              </div>
            </header>

            <div
              ref={chatScrollRef}
              onScroll={updateScrollState}
              className='flex-1 overflow-y-auto flex flex-col relative custom-scrollbar'
            >
              {messages.length === 0 ? (
                <div className='flex-1 flex flex-col items-center justify-center p-6 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700'>
                  <div className='max-w-2xl w-full text-center space-y-6'>
                    <div className='flex justify-center mb-8'>
                      <div className='w-20 h-20 bg-foreground/10 rounded-3xl flex items-center justify-center border border-brand/20 relative'>
                        <Bot className='w-10 h-10 text-brand' />
                        <div className='absolute -right-1 -bottom-1 w-6 h-6 bg-brand rounded-full border-4 border-background flex items-center justify-center'>
                          <span className='w-2 h-2 bg-primary-foreground rounded-full'></span>
                        </div>
                      </div>
                    </div>
                    <h2 className='product-page-title text-4xl font-bold tracking-tight md:text-5xl'>
                      How can <span className='text-brand'>JobRaker</span> help
                      you today?
                    </h2>
                    <p className='text-muted-foreground text-lg max-w-lg mx-auto'>
                      Your autonomous career partner. Ask me to optimize your
                      resume, find roles, or practice interviews.
                    </p>

                    <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mt-12'>
                      <button
                        onClick={() =>
                          setText(
                            "Optimize my resume for a Senior Frontend role",
                          )
                        }
                        className='suggestion-card glass-panel p-5 rounded-2xl text-left transition-all group'
                      >
                        <FileText className='text-brand mb-3 w-6 h-6' />
                        <h4 className='font-semibold text-sm mb-1 text-card-foreground'>
                          Optimize Resume
                        </h4>
                        <p className='text-xs text-muted-foreground'>
                          Tailor your CV for specific job descriptions.
                        </p>
                      </button>

                      <button
                        onClick={() =>
                          setText("Find remote software engineer jobs in US")
                        }
                        className='suggestion-card glass-panel p-5 rounded-2xl text-left transition-all group'
                      >
                        <Search className='text-brand mb-3 w-6 h-6' />
                        <h4 className='font-semibold text-sm mb-1 text-card-foreground'>
                          Find Remote Roles
                        </h4>
                        <p className='text-xs text-muted-foreground'>
                          Discover top-tier remote software engineering jobs.
                        </p>
                      </button>
                      <button
                        onClick={() =>
                          setText("Interview me for a Product Manager position")
                        }
                        className='suggestion-card glass-panel p-5 rounded-2xl text-left transition-all group'
                      >
                        <MessageSquare className='text-brand mb-3 w-6 h-6' />
                        <h4 className='font-semibold text-sm mb-1 text-card-foreground'>
                          Interview Prep
                        </h4>
                        <p className='text-xs text-muted-foreground'>
                          Mock interviews and feedback on your answers.
                        </p>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className='flex-1 w-full max-w-4xl mx-auto p-6 space-y-6 pb-32'>
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex gap-4 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {m.role === "assistant" && (
                        <div className='w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0 border border-brand/20 mt-1'>
                          <Bot size={16} className='text-brand' />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                          m.role === "user"
                            ? "bg-brand text-primary-foreground font-medium rounded-tr-sm"
                            : "glass-panel text-card-foreground rounded-tl-sm"
                        }`}
                      >
                        {m.role === "user" ? (
                          <div className='text-sm break-words whitespace-pre-wrap'>
                            <UserChatAttachment
                              messageId={m.id}
                              hasPastedImage={m.hasPastedImage}
                            />
                            {m.content.trim() ? m.content : null}
                          </div>
                        ) : (
                          <div className='text-sm prose prose-invert max-w-none overflow-hidden'>
                            {m.toolCalls && m.toolCalls.length > 0 && (
                              <div className='mb-3 space-y-1.5'>
                                {m.toolCalls.map((tc, idx) => (
                                  <div
                                    key={`${tc.name}-${idx}`}
                                    className='flex items-center gap-2 text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-brand/5 border border-brand/10'
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                        tc.status === "running"
                                          ? "bg-brand animate-pulse"
                                          : tc.status === "error"
                                            ? "bg-brand"
                                            : "bg-brand"
                                      }`}
                                    />
                                    <span className='text-muted-foreground'>
                                      {(
                                        {
                                          get_account_snapshot:
                                            "Checked account data",
                                          run_job_search: `Searched jobs: "${tc.args?.query || ""}"`,
                                          get_user_profile: "Retrieved profile",
                                          list_applications:
                                            "Listed applications",
                                          list_resumes: "Listed resumes",
                                          get_credits_balance:
                                            "Checked credits",
                                          list_recent_jobs:
                                            "Listed recent jobs",
                                          apply_to_job:
                                            "Submitting application...",
                                          analyze_resume: "Analyzing resume",
                                          generate_cover_letter:
                                            "Generating cover letter",
                                          evaluate_job_fit:
                                            "Evaluating job fit",
                                          intake_job_url:
                                            "Importing job from URL",
                                          update_profile: `Updated profile: ${Object.keys(tc.args || {}).join(", ")}`,
                                          add_skill: `Added skill: ${tc.args?.name || ""}`,
                                          remove_skill: `Removed skill: ${tc.args?.name || ""}`,
                                          add_experience: `Added experience: ${tc.args?.title || ""} @ ${tc.args?.company || ""}`,
                                          save_cover_letter: `Saved cover letter: ${tc.args?.name || ""}`,
                                          update_resume: `Updated resume: ${(tc.args as any)?.display_name || (tc.args as any)?.full_name || ""}`,
                                          update_application_status: `Updated application status to ${tc.args?.status || ""}`,
                                          bookmark_job: tc.args?.bookmarked
                                            ? "Bookmarked job"
                                            : "Removed bookmark",
                                          hide_job: "Dismissed job from queue",
                                        } as Record<string, string>
                                      )[tc.name] || tc.name.replace(/_/g, " ")}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                table: ({ node, ...props }) => (
                                  <div className='my-6 overflow-hidden rounded-xl border border-border'>
                                    <table
                                      className='w-full text-left text-xs bg-background/40'
                                      {...props}
                                    />
                                  </div>
                                ),
                                thead: ({ node, ...props }) => (
                                  <thead
                                    className='bg-accent/40 border-b border-border'
                                    {...props}
                                  />
                                ),
                                tbody: ({ node, ...props }) => (
                                  <tbody {...props} />
                                ),
                                tr: ({ node, ...props }) => (
                                  <tr
                                    className='border-b border-foreground/5 last:border-0'
                                    {...props}
                                  />
                                ),
                                th: ({ node, ...props }) => (
                                  <th
                                    className='px-4 py-2 font-semibold text-brand'
                                    {...props}
                                  />
                                ),
                                td: ({ node, ...props }) => (
                                  <td
                                    className='px-4 py-2 text-muted-foreground'
                                    {...props}
                                  />
                                ),
                                code: ({
                                  node,
                                  inline,
                                  className,
                                  children,
                                  ...props
                                }: any) => {
                                  const match = /language-(\w+)/.exec(
                                    className || "",
                                  );
                                  return !inline && match ? (
                                    <div className='my-4 rounded-xl border border-border bg-muted/40 overflow-hidden'>
                                      <div className='flex items-center justify-between px-3 py-1.5 bg-accent/40 border-b border-border'>
                                        <span className='text-[10px] font-medium text-foreground/50 uppercase'>
                                          {match[1]}
                                        </span>
                                        <button
                                          onClick={() =>
                                            navigator.clipboard.writeText(
                                              String(children),
                                            )
                                          }
                                          className='text-[10px] text-foreground/40 hover:text-foreground transition-colors'
                                        >
                                          Copy
                                        </button>
                                      </div>
                                      <SyntaxHighlighter
                                        language={match[1]}
                                        style={atomOneDarkStyle as any}
                                        customStyle={{
                                          margin: 0,
                                          background: "transparent",
                                          fontSize: "12px",
                                          padding: "16px",
                                        }}
                                        wrapLongLines
                                        {...props}
                                      >
                                        {String(children).replace(/\n$/, "")}
                                      </SyntaxHighlighter>
                                    </div>
                                  ) : (
                                    <code
                                      className='px-1.5 py-0.5 rounded bg-brand/10 text-brand text-[12px] font-mono border border-brand/20'
                                      {...props}
                                    >
                                      {children}
                                    </code>
                                  );
                                },
                                ul: ({ node, ...props }) => (
                                  <ul
                                    className='list-disc pl-4 space-y-1 my-2 text-muted-foreground marker:text-brand'
                                    {...props}
                                  />
                                ),
                                ol: ({ node, ...props }) => (
                                  <ol
                                    className='list-decimal pl-4 space-y-1 my-2 text-muted-foreground marker:text-brand'
                                    {...props}
                                  />
                                ),
                                li: ({ node, ...props }) => (
                                  <li className='pl-1' {...props} />
                                ),
                                strong: ({ node, ...props }) => (
                                  <strong
                                    className='text-foreground font-semibold'
                                    {...props}
                                  />
                                ),
                                p: ({ node, ...props }) => (
                                  <p
                                    className='mb-2 last:mb-0 leading-relaxed text-muted-foreground'
                                    {...props}
                                  />
                                ),
                                h1: ({ node, ...props }) => (
                                  <h1
                                    className='text-2xl font-bold text-foreground mb-4 mt-6 first:mt-0'
                                    {...props}
                                  />
                                ),
                                h2: ({ node, ...props }) => (
                                  <h2
                                    className='text-xl font-bold text-foreground mb-3 mt-5 first:mt-0'
                                    {...props}
                                  />
                                ),
                                h3: ({ node, ...props }) => (
                                  <h3
                                    className='text-lg font-semibold text-foreground mb-2 mt-4 first:mt-0'
                                    {...props}
                                  />
                                ),
                                h4: ({ node, ...props }) => (
                                  <h4
                                    className='text-base font-semibold text-foreground mb-2 mt-3 first:mt-0'
                                    {...props}
                                  />
                                ),
                              }}
                            >
                              {m.content}
                            </ReactMarkdown>
                            {m.streaming &&
                              (m.content ? (
                                <span className='inline-block w-1.5 h-4 ml-1 align-middle bg-brand animate-pulse' />
                              ) : (
                                <span className='text-sm font-medium text-muted-foreground animate-pulse'>
                                  {m.toolCalls && m.toolCalls.length > 0
                                    ? "Working..."
                                    : "Thinking..."}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {messages.length > 0 && showScrollToBottom && (
              <div className='pointer-events-none absolute bottom-28 right-6 z-20 md:right-10'>
                <button
                  onClick={() => scrollToBottom()}
                  className='pointer-events-auto inline-flex items-center gap-2 rounded-full border border-brand/30 bg-card/95 px-4 py-2 text-sm font-medium text-brand shadow-lg shadow-black/20 backdrop-blur transition hover:bg-card'
                >
                  <ArrowDown size={16} />
                  Latest
                </button>
              </div>
            )}

            <div className='p-4 md:p-6 pt-0 w-full max-w-4xl mx-auto z-10 shrink-0'>
              <div
                className={`relative rounded-[24px] border border-border shadow-2xl overflow-hidden transition-all duration-300 ${
                  text.trim() || attachment
                    ? "bg-card ring-1 ring-brand/50 border-brand/50"
                    : "bg-card/85 backdrop-blur-xl"
                }`}
              >
                <div className='flex flex-col'>
                  <div className='relative flex items-end p-2 pb-2'>
                    <textarea
                      ref={textareaRef}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onPaste={handlePasteImage}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (text.trim() || attachment)
                            handleSubmit({ text } as any);
                        }
                      }}
                      className='w-full bg-transparent border-none focus:ring-0 text-foreground placeholder:text-muted-foreground py-3 px-4 resize-none min-h-[48px] max-h-48 text-base leading-relaxed scrollbar-hide'
                      placeholder='Ask detailed questions about your career...'
                      rows={1}
                      style={{ height: "auto", minHeight: "52px" }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = "auto";
                        target.style.height = `${target.scrollHeight}px`;
                      }}
                    />

                    <button
                      onClick={() =>
                        (text.trim() || attachment) &&
                        handleSubmit({ text } as any)
                      }
                      disabled={
                        (!text.trim() && !attachment) ||
                        status === "in_progress"
                      }
                      className={`mb-1.5 mr-1.5 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        text.trim() || attachment
                          ? "bg-brand hover:bg-brand/90 text-primary-foreground shadow-[0_0_15px_hsl(var(--brand)/0.3)]"
                          : "bg-muted text-muted-foreground/60 cursor-not-allowed"
                      }`}
                    >
                      <ArrowUp size={16} className='font-bold' />
                    </button>
                  </div>

                  <div className='flex items-center justify-between px-4 pb-3 pt-0'>
                    <div className='flex flex-col gap-1 min-w-0'>
                      <div className='flex gap-2 flex-wrap'>
                        <button
                          onClick={() => setPersona("concise")}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                            persona === "concise"
                              ? "bg-brand/10 text-brand border-brand/20"
                              : "text-muted-foreground border-transparent hover:bg-accent/40"
                          }`}
                        >
                          <Bolt size={12} />
                          Ask
                        </button>
                        <button
                          onClick={() => setPersona("analyst")}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                            persona === "analyst"
                              ? "bg-brand/10 text-brand border-brand/20"
                              : "text-muted-foreground border-transparent hover:bg-accent/40"
                          }`}
                          title='Same base credit as Ask, plus 1 credit per round when tools run'
                        >
                          <BookOpen size={12} />
                          Agent Mode
                        </button>
                      </div>
                      {persona === "analyst" && (
                        <p className='text-[10px] text-muted-foreground px-0.5'>
                          Agent: 1 credit for your message, then +1 credit each
                          time tools run (from your balance).
                        </p>
                      )}
                    </div>
                    <div className='flex gap-2'>
                      <input
                        type='file'
                        ref={fileInputRef}
                        className='hidden'
                        onChange={handleFileSelect}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className={`transition-colors ${attachment ? "text-brand" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        <Paperclip size={16} />
                      </button>
                    </div>
                  </div>

                  {attachment && (
                    <div className='px-4 pb-2'>
                      <div className='inline-flex items-center gap-2 bg-accent/40 px-3 py-1.5 rounded-lg text-xs font-medium text-foreground border border-border'>
                        {attachmentPreviewUrl ? (
                          <img
                            src={attachmentPreviewUrl}
                            alt=''
                            className='h-10 w-10 rounded-md object-cover border border-border shrink-0'
                          />
                        ) : (
                          <Paperclip size={12} className='text-brand' />
                        )}
                        <span className='max-w-[150px] truncate'>
                          {attachment.name}
                        </span>
                        <button
                          type='button'
                          onClick={() => {
                            setAttachment(null);
                            if (fileInputRef.current)
                              fileInputRef.current.value = "";
                          }}
                          className='ml-1 hover:text-brand'
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <p className='text-center text-[10px] text-muted-foreground mt-3 uppercase tracking-widest font-medium'>
                JobRaker AI can make mistakes. Check important information.
              </p>
            </div>

            <div className='fixed -bottom-48 -right-48 w-96 h-96 bg-brand/5 rounded-full blur-[120px] pointer-events-none'></div>
            <div className='fixed top-24 left-96 w-64 h-64 bg-brand/5 rounded-full blur-[100px] pointer-events-none'></div>
          </main>
        </>
      )}
    </div>
  );
};

export default ChatPage;
