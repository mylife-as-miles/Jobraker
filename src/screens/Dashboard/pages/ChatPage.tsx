// Clean AI-elements only Chat Page implementation
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { nanoid } from 'nanoid';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import atomOneDarkStyle from 'react-syntax-highlighter/dist/styles/atom-one-dark';
import { createClient } from "../../../lib/supabaseClient";
import {
  MessageSquare, Wand2, Target, FileText, Sparkles, Zap, Plus, Search, Trash2, Bot,
  Bolt, BookOpen, Paperclip, ArrowUp
} from 'lucide-react';
import { UpgradePrompt } from "../../../components/UpgradePrompt";
import { useToast } from "../../../components/ui/toast-provider";

// Custom styles for the new design
const customStyles = `
  .glass-panel {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
  .suggestion-card:hover {
    border-color: #14C314;
    background: rgba(20, 195, 20, 0.05);
  }
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #222;
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #333;
  }
`;

// Real-deal streaming useChat hook
type Persona = 'concise' | 'friendly' | 'analyst' | 'coach';
interface BasicMessage { id: string; role: 'user' | 'assistant'; content: string; parts?: { type: 'text'; text: string }[]; streaming?: boolean; createdAt: number; meta?: { persona?: Persona; parent?: string } }
interface UseChatOptions { api: string; initialMessages?: BasicMessage[]; onFinish?: (msg: BasicMessage) => void; }
interface UseChatReturn { messages: BasicMessage[]; status: 'idle' | 'in_progress'; append: (m: { role: 'user'; content: string }, opts?: { model?: string; webSearch?: boolean; system?: string }) => void; regenerate: () => void; setMessages: (m: BasicMessage[]) => void; responseId: string | null; setResponseId: (id: string | null) => void }

const useChat = (opts: UseChatOptions): UseChatReturn => {
  const [messages, setMessages] = useState<BasicMessage[]>(opts.initialMessages || []);
  const [status, setStatus] = useState<'idle' | 'in_progress'>('idle');
  const [responseId, setResponseId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const append = useCallback(async (m: { role: 'user'; content: string }, chatOpts?: { model?: string; webSearch?: boolean; system?: string }) => {
    if (status === 'in_progress') return;

    const userMessage: BasicMessage = { id: nanoid(), role: 'user', content: m.content, createdAt: Date.now(), parts: [{ type: 'text', text: m.content }] };
    const history = [...messages, userMessage];
    setMessages(history);
    setStatus('in_progress');

    const assistantId = nanoid();
    const assistantMessage: BasicMessage = { id: assistantId, role: 'assistant', content: '', createdAt: Date.now(), parts: [{ type: 'text', text: '' }], streaming: true };
    setMessages(prev => [...prev, assistantMessage]);

    const supabase = createClient();
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
    const fnUrl = `${supabaseUrl}/functions/v1/ai-chat`;

    abortControllerRef.current = new AbortController();

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          model: chatOpts?.model || 'openai/gpt-4o-mini',
          messages: history.filter(m => m.content.trim() !== '').map(m => ({
            role: m.role,
            content: m.content
          })),
          webSearch: chatOpts?.webSearch,
          system: chatOpts?.system,
          previous_response_id: responseId,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      let currentEvent = 'message';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Keep the last line in the buffer if it's incomplete
        const endsWithNewLine = buffer.endsWith('\n');
        if (!endsWithNewLine) {
          buffer = lines.pop() || '';
        } else {
          buffer = '';
        }

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          if (trimmedLine.startsWith('event:')) {
            currentEvent = trimmedLine.slice(6).trim();
          } else if (trimmedLine.startsWith('data:')) {
            const dataStr = trimmedLine.slice(5).trim();
            if (dataStr === '[DONE]') continue; // Standard SSE done marker

            try {
              const data = JSON.parse(dataStr);

              if (currentEvent === 'message') {
                if (data.delta) {
                  setMessages(prev => prev.map(msg => msg.id === assistantId
                    ? { ...msg, content: msg.content + data.delta, parts: [{ type: 'text', text: msg.content + data.delta }] }
                    : msg
                  ));
                }
              } else if (currentEvent === 'response_id') {
                if (data.response_id) {
                  setResponseId(data.response_id);
                }
              } else if (currentEvent === 'error') {
                const errorText = `Error: ${data.error}`;
                setMessages(prev => prev.map(msg => msg.id === assistantId ? { ...msg, content: errorText, parts: [{ type: 'text', text: errorText }], streaming: false } : msg));
              } else if (currentEvent === 'done') {
                // Handled by loop exit usually, but if explicit event:
                // We can just ignore or finalize here.
              }
            } catch (e) {
              // Ignore parse errors for partial lines
            }
          }
        }
      }

      // Done
      setMessages(prev => {
        let finalAssistantMessage: BasicMessage | undefined;
        const finalMessages = prev.map(msg => {
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
      setStatus('idle');

    } catch (err: any) {
      if (err.name === 'AbortError') return;
      const errorText = `Fetch Error: ${err.message || 'Could not connect to the chat function.'}`;
      setMessages(prev => prev.map(msg => msg.id === assistantId ? { ...msg, content: errorText, parts: [{ type: 'text', text: errorText }], streaming: false } : msg));
      setStatus('idle');
    } finally {
      abortControllerRef.current = null;
    }

  }, [messages, status, responseId, opts.onFinish]);

  const regenerate = () => {
    if (status === 'in_progress' || messages.length === 0) return;
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
      const messagesWithoutLastAssistant = messages.filter(m => m.role !== 'assistant' || m.id !== messages[messages.length - 1].id);
      setMessages(messagesWithoutLastAssistant);
      append({ role: 'user', content: lastUserMessage.content });
    }
  };

  return { messages, status, append, regenerate, setMessages, responseId, setResponseId };
};


const models = [
  { id: 'ask', name: 'Ask' },
  { id: 'agent', name: 'Agent' },
];


export const ChatPage = () => {
  const { error: toastError } = useToast();
  // UI state
  const [text, setText] = useState('');
  const [model] = useState(models[0].id);
  const [persona, setPersona] = useState<Persona>('concise');
  const [sessions, setSessions] = useState<{ id: string; title: string; createdAt: number; updatedAt: number; messages: BasicMessage[]; responseId?: string | null }[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [subscriptionTier, setSubscriptionTier] = useState<'Free' | 'Basics' | 'Pro' | 'Ultimate' | null>(null);
  const [loadingTier, setLoadingTier] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  // Check subscription tier access
  useEffect(() => {
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId) {
          setSubscriptionTier('Free');
          setLoadingTier(false);
          return;
        }

        // Try to get from active subscription first
        const { data: subscription } = await supabase
          .from('user_subscriptions')
          .select('subscription_plans(name)')
          .eq('user_id', userId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (subscription && (subscription as any).subscription_plans?.name) {
          setSubscriptionTier((subscription as any).subscription_plans.name);
        } else {
          // Fallback to profile subscription_tier
          const { data: profileData } = await supabase
            .from('profiles')
            .select('subscription_tier')
            .eq('id', userId)
            .single();

          setSubscriptionTier(profileData?.subscription_tier || 'Free');
        }
      } catch (error) {
        console.error('Error fetching subscription tier:', error);
        setSubscriptionTier('Free');
      } finally {
        setLoadingTier(false);
      }
    })();
  }, [supabase]);


  // Chat logic
  const chat = useChat({ api: '/api/ai-chat' });
  const { messages, status, append, regenerate, setMessages, responseId, setResponseId } = chat;

  // Session management with Supabase -----------------------------------------
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  const loadSessions = useCallback(async () => {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      toastError('Could not load chats', error.message);
      return;
    }
    if (data && data.length > 0) {
      setSessions(data as any);
      setActiveSessionId(data[0].id);
    } else {
      // No sessions, create one
      await createSession(true);
    }
  }, [supabase]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // When active session changes, load its messages into the chat hook
  useEffect(() => {
    if (!activeSessionId) return;
    const active = sessions.find(s => s.id === activeSessionId);
    if (active) {
      setMessages(active.messages || []);
      setResponseId(active.responseId || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  // Debounced save to DB
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!activeSessionId || status === 'in_progress') return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      const currentMessages = messages;
      const currentResponseId = responseId;
      const active = sessionsRef.current.find(s => s.id === activeSessionId);

      if (active) {
        const hasChanged = JSON.stringify(active.messages) !== JSON.stringify(currentMessages) || active.responseId !== currentResponseId;
        if (!hasChanged) return;

        const { error } = await supabase
          .from('chat_sessions')
          .update({ messages: currentMessages as any, response_id: currentResponseId })
          .eq('id', activeSessionId);

        if (!error) {
          // also update local state to get new updated_at
          setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: currentMessages, responseId: currentResponseId, updatedAt: Date.now() } : s));
        }
      }
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    }
  }, [messages, responseId, activeSessionId, status, supabase]);

  const createSession = async (activate = true) => {
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({ title: 'New Chat' })
      .select()
      .single();

    if (error) {
      toastError('Could not create chat', error.message);
      return null;
    }
    if (data) {
      setSessions(prev => [data as any, ...prev].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
      if (activate) setActiveSessionId(data.id);
      return data.id;
    }
    return null;
  };

  const deleteSession = async (id: string) => {
    // Optimistically remove from UI
    const originalSessions = sessions;
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      const remaining = originalSessions.filter(s => s.id !== id);
      setActiveSessionId(remaining[0]?.id || null);
    }

    const { error } = await supabase.from('chat_sessions').delete().eq('id', id);

    if (error) {
      toastError('Could not delete chat', error.message);
      setSessions(originalSessions); // Revert on error
    }
  };

  const parseMarkdown = (raw: string) => {
    const blocks: { type: 'code' | 'text'; content: string; lang?: string }[] = [];
    const fence = /```(\w+)?\n([\s\S]*?)```/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = fence.exec(raw)) !== null) {
      if (m.index > last) blocks.push({ type: 'text', content: raw.slice(last, m.index) });
      blocks.push({ type: 'code', content: m[2].trimEnd(), lang: m[1] });
      last = fence.lastIndex;
    }
    if (last < raw.length) blocks.push({ type: 'text', content: raw.slice(last) });
    return blocks;
  };

  const renderRichText = (raw: string) => {
    return parseMarkdown(raw).map((b, i) => {
      if (b.type === 'code') {
        return (
          <div key={i} className="mt-3 mb-2 rounded-xl border border-white/[0.08] bg-black/60 text-[12px] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-white/[0.03] border-b border-white/[0.06]">
              <span className="text-[10px] font-medium text-white/50 uppercase tracking-wider">{b.lang || 'code'}</span>
              <button
                onClick={() => navigator.clipboard.writeText(b.content)}
                className="px-2.5 py-1 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-[10px] text-white/60 hover:text-white/90 transition-all border border-white/[0.06] hover:border-white/[0.12]"
              >
                Copy
              </button>
            </div>
            <div className="max-h-[480px] overflow-auto">
              <SyntaxHighlighter
                language={b.lang || 'text'}
                style={atomOneDarkStyle as any}
                customStyle={{ margin: 0, background: 'transparent', fontSize: '12px', padding: '16px' }}
                showLineNumbers={b.content.split('\n').length > 4}
                wrapLongLines
              >{b.content}</SyntaxHighlighter>
            </div>
          </div>
        );
      }
      const segs = b.content.split(/(`[^`]+`)/g).map((seg, j) => seg.startsWith('`') && seg.endsWith('`') ? (
        <code key={j} className="px-2 py-0.5 rounded-md bg-[#1dff00]/10 text-[#1dff00] text-[12px] font-mono border border-[#1dff00]/20">{seg.slice(1, -1)}</code>
      ) : <span key={j}>{seg}</span>);
      return <div key={i} className="whitespace-pre-wrap break-words">{segs}</div>;
    });
  };

  const handleSubmit = (message: { text: string; files?: any[] }) => {
    const hasText = !!message.text?.trim();
    if (!hasText) return;

    const systemInstruction = {
      concise: 'You are a concise and direct assistant.',
      friendly: 'You are a friendly and encouraging assistant.',
      analyst: 'You are a professional analyst who provides structured, data-driven answers.',
      coach: 'You are a career coach who gives actionable advice.'
    }[persona];

    const currentMessages = sessions.find(s => s.id === activeSessionId)?.messages || [];

    append(
      { role: 'user', content: message.text || '' },
      {
        model: model === 'agent' ? 'openai/gpt-4o' : 'openai/gpt-4o-mini',
        webSearch: false,
        system: currentMessages.length === 0 ? systemInstruction : undefined, // Only send system on first turn
      }
    );

    // Update session title on first user message
    if (currentMessages.filter(m => m.role === 'user').length === 0) {
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, title: (message.text || 'New Chat').slice(0, 48) } : s));
    }

    setText('');
  };

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Filtered sessions based on search
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter(s =>
      s.title.toLowerCase().includes(query) ||
      s.messages.some(m => m.content.toLowerCase().includes(query))
    );
  }, [sessions, searchQuery]);

  return (
    <div className="relative flex h-full w-full font-sans bg-white dark:bg-[#050505] overflow-hidden text-slate-900 dark:text-slate-100">
      <style>{customStyles}</style>

      {/* Loading state */}
      {loadingTier && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1dff00] mx-auto mb-4"></div>
            <p className="text-white/90">Loading...</p>
          </div>
        </div>
      )}

      {/* Access Gate */}
      {!loadingTier && (subscriptionTier === 'Free' || subscriptionTier === 'Basics') && (
        <div className="flex items-center justify-center h-full w-full p-4 sm:p-6 z-40 bg-black">
          <UpgradePrompt
            title="AI Chat Assistant"
            description="Unlock intelligent job search conversations with our advanced AI assistant."
            features={[
              {
                icon: <MessageSquare className="h-5 w-5" />,
                title: "Unlimited AI Conversations",
                description: "Chat as much as you need about your job search strategy"
              },
              {
                icon: <Wand2 className="h-5 w-5" />,
                title: "Resume Optimization",
                description: "Get AI-powered suggestions to improve your resume"
              },
              {
                icon: <FileText className="h-5 w-5" />,
                title: "Cover Letter Generation",
                description: "Create tailored cover letters for any job posting"
              },
              {
                icon: <Target className="h-5 w-5" />,
                title: "Job Match Analysis",
                description: "Understand how well you fit each opportunity"
              },
              {
                icon: <Sparkles className="h-5 w-5" />,
                title: "Smart Recommendations",
                description: "Receive personalized career advice and insights"
              },
              {
                icon: <Zap className="h-5 w-5" />,
                title: "Priority Support",
                description: "Get faster responses and dedicated assistance"
              }
            ]}
            requiredTier="Pro/Ultimate"
            icon={<MessageSquare className="h-12 w-12 text-[#1dff00]" />}
          />
        </div>
      )}

      {/* Main Chat Interface */}
      {!loadingTier && (subscriptionTier === 'Pro' || subscriptionTier === 'Ultimate') && (
        <>
          {/* Internal Sidebar for Chat History */}
          <aside className={`w-72 bg-white dark:bg-[#121212] border-r border-slate-200 dark:border-[#222] flex flex-col h-full z-20 transition-all duration-300 ${sidebarCollapsed ? '-ml-72' : ''}`}>
            <div className="p-6">
              <button
                onClick={() => createSession()}
                className="w-full bg-[#14C314] hover:bg-green-500 text-black font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#14C314]/20"
              >
                <Plus size={20} />
                New Chat
              </button>
            </div>

            <div className="px-6 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-white/5 border-none focus:ring-1 focus:ring-[#14C314] rounded-xl pl-10 py-2.5 text-sm outline-none text-slate-900 dark:text-white placeholder:text-slate-500"
                  placeholder="Search conversations..."
                  type="text"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 custom-scrollbar">
              <div className="mb-4">
                <p className="px-2 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Recent Chats</p>
                <div className="space-y-1">
                  {filteredSessions.length > 0 ? (
                    filteredSessions.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setActiveSessionId(s.id)}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors group text-left ${s.id === activeSessionId
                          ? 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10'
                          : 'hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent'
                          }`}
                      >
                        <MessageSquare className={`w-5 h-5 ${s.id === activeSessionId ? 'text-[#14C314]' : 'text-slate-400 group-hover:text-[#14C314]'} transition-colors`} />
                        <div className="flex-1 overflow-hidden">
                          <p className="text-sm font-medium truncate text-slate-900 dark:text-slate-300">{s.title || "New Chat"}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{new Date(s.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 flex items-center">
                          <button onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }} className="p-1 hover:text-red-400 text-slate-500 rounded"><Trash2 size={12} /></button>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-center text-slate-500 text-xs">No conversations found</div>
                  )}
                </div>
              </div>
            </div>

            {/* User Profile Snippet Removed */}
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 relative flex flex-col bg-white dark:bg-[#050505] overflow-hidden">
            <header className="h-16 flex items-center justify-between px-8 border-b border-slate-100 dark:border-[#222] shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="md:hidden mr-2 text-slate-500"><Bolt size={20} /></button>
                <h2 className="font-semibold text-lg text-slate-900 dark:text-white">AI Assistant</h2>
                <span className="bg-[#14C314]/10 text-[#14C314] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#14C314]/20">BETA</span>
              </div>
              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10`}>
                  <div className={`w-2 h-2 rounded-full ${status === 'in_progress' ? 'bg-[#14C314] animate-pulse' : 'bg-[#14C314]'} `}></div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{status === 'in_progress' ? 'Generating...' : 'Ready'}</span>
                </div>
                {messages.length > 0 && (
                  <button onClick={regenerate} className="text-sm font-medium text-[#14C314] hover:underline px-3 py-1.5 flex items-center gap-1">
                    Regenerate
                  </button>
                )}
              </div>
            </header>

            {/* Chat Content */}
            <div className="flex-1 overflow-y-auto flex flex-col relative custom-scrollbar">
              {messages.length === 0 ? (
                /* Empty State / Start Screen */
                <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="max-w-2xl w-full text-center space-y-6">
                    <div className="flex justify-center mb-8">
                      <div className="w-20 h-20 bg-[#14C314]/10 rounded-3xl flex items-center justify-center border border-[#14C314]/20 relative">
                        <Bot className="w-10 h-10 text-[#14C314]" />
                        <div className="absolute -right-1 -bottom-1 w-6 h-6 bg-[#14C314] rounded-full border-4 border-[#050505] flex items-center justify-center">
                          <span className="w-2 h-2 bg-black rounded-full"></span>
                        </div>
                      </div>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
                      How can <span className="text-[#14C314]">JobRaker</span> help you today?
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-lg max-w-lg mx-auto">
                      Your autonomous career partner. Ask me to optimize your resume, find roles, or practice interviews.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
                      {/* Suggestion Cards */}
                      <button onClick={() => setText("Optimize my resume for a Senior Frontend role")} className="suggestion-card glass-panel p-5 rounded-2xl text-left transition-all group">
                        <FileText className="text-[#14C314] mb-3 w-6 h-6" />
                        <h4 className="font-semibold text-sm mb-1 text-slate-200">Optimize Resume</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Tailor your CV for specific job descriptions.</p>
                      </button>
                      <button onClick={() => setText("Find remote software engineer jobs in US")} className="suggestion-card glass-panel p-5 rounded-2xl text-left transition-all group">
                        <Search className="text-[#14C314] mb-3 w-6 h-6" />
                        <h4 className="font-semibold text-sm mb-1 text-slate-200">Find Remote Roles</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Discover top-tier remote software engineering jobs.</p>
                      </button>
                      <button onClick={() => setText("Interview me for a Product Manager position")} className="suggestion-card glass-panel p-5 rounded-2xl text-left transition-all group">
                        <MessageSquare className="text-[#14C314] mb-3 w-6 h-6" />
                        <h4 className="font-semibold text-sm mb-1 text-slate-200">Interview Prep</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Mock interviews and feedback on your answers.</p>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Chat History Stream */
                <div className="flex-1 w-full max-w-4xl mx-auto p-6 space-y-6 pb-32">
                  {messages.map((m) => (
                    <div key={m.id} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {m.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-lg bg-[#14C314]/10 flex items-center justify-center shrink-0 border border-[#14C314]/20 mt-1">
                          <Bot size={16} className="text-[#14C314]" />
                        </div>
                      )}
                      <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${m.role === 'user'
                        ? 'bg-[#14C314] text-black font-medium rounded-tr-sm'
                        : 'glass-panel text-slate-200 rounded-tl-sm border-white/10'
                        }`}>
                        {m.role === 'user' ? (
                          <p className="text-sm">{m.content}</p>
                        ) : (
                          <div className="text-sm prose prose-invert max-w-none">
                            {renderRichText(m.content)}
                            {m.streaming && <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-[#14C314] animate-pulse" />}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={el => el?.scrollIntoView({ behavior: 'smooth' })} />
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-6 md:p-10 w-full max-w-5xl mx-auto z-10">
              <div className="relative glass-panel rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden bg-[#0a0a0a]/80 backdrop-blur-xl">
                <div className="flex flex-col">
                  {/* Toolbar */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/5">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPersona('concise')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${persona === 'concise'
                          ? 'bg-[#14C314]/10 text-[#14C314] border-[#14C314]/20'
                          : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-white/5'
                          }`}
                      >
                        <Bolt size={14} />
                        Concise
                      </button>
                      <button
                        onClick={() => setPersona('analyst')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${persona === 'analyst'
                          ? 'bg-[#14C314]/10 text-[#14C314] border-[#14C314]/20'
                          : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-white/5'
                          }`}
                      >
                        <BookOpen size={14} />
                        Detailed
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 transition-colors">
                        <Paperclip size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Textarea */}
                  <div className="relative flex items-center p-2">
                    <textarea
                      ref={textareaRef}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (text.trim()) handleSubmit({ text } as any);
                        }
                      }}
                      className="w-full bg-transparent border-none focus:ring-0 text-slate-900 dark:text-white placeholder:text-slate-500 py-4 px-4 resize-none min-h-[56px] max-h-48 text-lg"
                      placeholder="Message JobRaker AI..."
                      rows={1}
                    />
                    <button
                      onClick={() => text.trim() && handleSubmit({ text } as any)}
                      disabled={!text.trim() || status === 'in_progress'}
                      className={`absolute right-4 bottom-4 w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-lg ${text.trim()
                        ? 'bg-[#14C314] hover:bg-green-500 text-black shadow-[#14C314]/20'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                    >
                      <ArrowUp size={20} className="font-bold" />
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-center text-[10px] text-slate-500 mt-4 uppercase tracking-widest font-medium">
                JobRaker AI can make mistakes. Check important information.
              </p>
            </div>

            {/* Guided Tours FAB */}
            <div className="fixed bottom-8 right-8 z-30">
              <button className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-slate-900 dark:bg-[#121212] border border-slate-800 dark:border-[#222] shadow-xl hover:border-[#14C314]/50 transition-all group">
                <div className="w-2.5 h-2.5 rounded-full bg-[#14C314] group-hover:animate-ping"></div>
                <span className="text-sm font-semibold text-slate-300">Guided Tours</span>
              </button>
            </div>

            {/* Background Glows */}
            <div className="fixed -bottom-48 -right-48 w-96 h-96 bg-[#14C314]/5 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="fixed top-24 left-96 w-64 h-64 bg-[#14C314]/5 rounded-full blur-[100px] pointer-events-none"></div>
          </main>
        </>
      )}
    </div>
  );
};

export default ChatPage;