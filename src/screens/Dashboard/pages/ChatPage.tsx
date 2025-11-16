// Clean AI-elements only Chat Page implementation
import ModelDropdown from "@/components/ModelDropdown";
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { nanoid } from 'nanoid';
import { useRegisterCoachMarks } from "../../../providers/TourProvider";
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import atomOneDarkStyle from 'react-syntax-highlighter/dist/styles/atom-one-dark';
import { createClient } from "../../../lib/supabaseClient";
import { MessageSquare, Wand2, Target, FileText, Sparkles, Zap, Plus, Search, Trash2, Edit3 } from 'lucide-react';
import { UpgradePrompt } from "../../../components/UpgradePrompt";
// Real-deal streaming useChat hook
type Persona = 'concise' | 'friendly' | 'analyst' | 'coach';
interface BasicMessage { id: string; role: 'user' | 'assistant'; content: string; parts?: { type: 'text'; text: string }[]; streaming?: boolean; createdAt: number; meta?: { persona?: Persona; parent?: string } }
interface UseChatOptions { api: string; initialMessages?: BasicMessage[]; onFinish?: (msg: BasicMessage) => void; }
interface UseChatReturn { messages: BasicMessage[]; status: 'idle' | 'in_progress'; append: (m: { role: 'user'; content: string }, opts?: { model?: string; webSearch?: boolean; system?: string }) => void; regenerate: () => void; stop: () => void; setMessages: (m: BasicMessage[]) => void; responseId: string | null; setResponseId: (id: string | null) => void }

const useChat = (opts: UseChatOptions): UseChatReturn => {
  const [messages, setMessages] = useState<BasicMessage[]>(opts.initialMessages || []);
  const [status, setStatus] = useState<'idle' | 'in_progress'>('idle');
  const [responseId, setResponseId] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const stop = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setStatus('idle');
      // Finalize any streaming messages
      setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m));
    }
  }, []);

  const append = useCallback((m: { role: 'user'; content: string }, chatOpts?: { model?: string; webSearch?: boolean; system?: string }) => {
    if (status === 'in_progress') return;

    const userMessage: BasicMessage = { id: nanoid(), role: 'user', content: m.content, createdAt: Date.now(), parts: [{ type: 'text', text: m.content }] };
    const history = [...messages, userMessage];
    setMessages(history);
    setStatus('in_progress');

    const assistantId = nanoid();
    const assistantMessage: BasicMessage = { id: assistantId, role: 'assistant', content: '', createdAt: Date.now(), parts: [{ type: 'text', text: '' }], streaming: true };
    setMessages(prev => [...prev, assistantMessage]);

    const supabase = createClient();
    supabase.functions.invoke('ai-chat', {
      body: {
        model: chatOpts?.model || 'openai/gpt-4o-mini',
        messages: responseId ? [userMessage] : history, // Full history on first turn, just new message after
        webSearch: chatOpts?.webSearch,
        system: chatOpts?.system,
        previous_response_id: responseId,
      }
    }).then(async (resp) => {

      if (resp.error) {
        const errorText = `Error: ${resp.error.message || 'Function returned an error.'}`;
        setMessages(prev => prev.map(msg => msg.id === assistantId ? { ...msg, content: errorText, parts: [{ type: 'text', text: errorText }], streaming: false } : msg));
        setStatus('idle');
        return;
      }
      // Supabase Functions does not support streaming responses directly in invoke,
      // so we use a standard fetch with EventSource for the streaming endpoint.
      // We must get the URL from the supabase client config.
      const fnUrl = `${supabase.functionsUrl}/ai-chat`;

      eventSourceRef.current = new EventSource(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          model: chatOpts?.model || 'openai/gpt-4o-mini',
          messages: responseId ? [userMessage] : history,
          webSearch: chatOpts?.webSearch,
          system: chatOpts?.system,
          previous_response_id: responseId,
        })
      } as any); // EventSource polyfills/types can be tricky

      eventSourceRef.current.addEventListener('message', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.delta) {
            setMessages(prev => prev.map(msg => msg.id === assistantId
              ? { ...msg, content: msg.content + data.delta, parts: [{ type: 'text', text: msg.content + data.delta }] }
              : msg
            ));
          }
        } catch (error) {}
      });

      eventSourceRef.current.addEventListener('response_id', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.response_id) {
            setResponseId(data.response_id);
          }
        } catch (error) {}
      });

      eventSourceRef.current.addEventListener('error', (e) => {
        let errorText = 'An unknown streaming error occurred.';
        try {
          const data = JSON.parse(e.data);
          if (data.error) errorText = `Error: ${data.error}`;
        } catch (error) {}
        setMessages(prev => prev.map(msg => msg.id === assistantId ? { ...msg, content: errorText, parts: [{ type: 'text', text: errorText }], streaming: false } : msg));
        stop();
      });

      eventSourceRef.current.addEventListener('done', () => {
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
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        setStatus('idle');
      });
    }).catch(err => {
      const errorText = `Fetch Error: ${err.message || 'Could not connect to the chat function.'}`;
      setMessages(prev => prev.map(msg => msg.id === assistantId ? { ...msg, content: errorText, parts: [{ type: 'text', text: errorText }], streaming: false } : msg));
      setStatus('idle');
    });

  }, [messages, status, responseId, stop, opts.onFinish]);

  const regenerate = () => {
    if (status === 'in_progress' || messages.length === 0) return;
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
      // Potentially remove the last assistant message before regenerating
      const messagesWithoutLastAssistant = messages.filter(m => m.role !== 'assistant' || m.id !== messages[messages.length - 1].id);
      setMessages(messagesWithoutLastAssistant);
      // This is a simplified regenerate; a real one might need more context/state rewind
      append(lastUserMessage);
    }
  };

  return { messages, status, append, regenerate, stop, setMessages, responseId, setResponseId };
};
import { GlobeIcon, MicIcon } from 'lucide-react';
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputButton,
  type PromptInputMessage,

  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input';
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation';
// Custom styled bubbles leveraging Conversation primitives


const models = [
  { id: 'ask', name: 'Ask' },
  { id: 'agent', name: 'Agent' },
];

export const ChatPage = () => {
  // UI state
  const [text, setText] = useState('');
  const [model, setModel] = useState(models[0].id);
  const [useMicrophone, setUseMicrophone] = useState(false);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [persona, setPersona] = useState<Persona>('concise');
  const [editing, setEditing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<{ id: string; title: string; createdAt: number; updatedAt: number; messages: BasicMessage[]; responseId?: string | null }[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [renamingSession, setRenamingSession] = useState<string | null>(null);
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
  
  useRegisterCoachMarks({
    page: 'chat',
    marks: [
      { id: 'chat-model-select', selector: '[data-chat-model-select]', title: 'Model Selection', body: 'Choose the intelligence model best aligned with your current task.' },
      { id: 'chat-transcript', selector: '.conversation-scroll-area, .conversation-container', title: 'Conversation History', body: 'Scroll to review prior exchanges. Context improves follow-up quality.' },
      { id: 'chat-input', selector: 'textarea', title: 'Prompt Input', body: 'Craft clear, specific prompts. Use the toolbar for attachments or settings.' }
    ]
  });
  
  // Chat logic
  const chat = useChat({ api: '/api/ai-chat' });
  const { messages, status, append, regenerate, stop, setMessages, responseId, setResponseId } = chat;

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
  }, [activeSessionId, sessions, setMessages, setResponseId]);

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
          setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: currentMessages, responseId: currentResponseId, updatedAt: new Date().toISOString() } : s));
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
      setSessions(prev => [data as any, ...prev].sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
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

  const renameSession = async (id: string, title: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title, updatedAt: new Date().toISOString() } : s));
    const { error } = await supabase.from('chat_sessions').update({ title }).eq('id', id);
    if (error) {
      toastError('Could not rename chat', error.message);
      loadSessions(); // Re-fetch to correct state
    }
  };

  // Quick prompts - more professional and enterprise-focused
  const quickPrompts = [
    "Analyze my application pipeline efficiency",
    'Generate executive-level follow-up communication',
    'Strategic resume optimization recommendations',
    'Develop quarterly job search roadmap',
    'Competitive interview preparation analysis'
  ];

  const personaLabel: Record<Persona, string> = {
    concise: '⚡ Concise',
    friendly: '💬 Friendly',
    analyst: '📊 Analyst',
    coach: '🎯 Coach'
  };

  const copyMessage = useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(c => (c === id ? null : c)), 1600);
    });
  }, []);

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

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = !!message.text?.trim();
    const hasFiles = !!message.files?.length;
    if (!hasText && !hasFiles) return;

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
        webSearch: useWebSearch,
        system: currentMessages.length === 0 ? systemInstruction : undefined, // Only send system on first turn
      }
    );

    // Update session title on first user message
    if (currentMessages.filter(m=>m.role==='user').length === 0) {
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, title: (message.text || 'New Chat').slice(0, 48) } : s));
    }

    setText('');
    setEditing(false);
  };

  const lastUserId = [...messages].reverse().find(m => m.role === 'user')?.id;

  // Keyboard shortcuts ------------------------------------------------------
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (text.trim()) handleSubmit({ text, files: [] } as any);
      } else if (e.key === 'Escape' && status === 'in_progress') {
        stop();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [text, status, stop]);

  // Token estimate (naive)
  const tokenEstimate = Math.ceil(text.trim().split(/\s+/).filter(Boolean).join(' ').length / 4) || 0;

  // Filtered sessions based on search
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter(s => 
      s.title.toLowerCase().includes(query) || 
      s.messages.some(m => m.content.toLowerCase().includes(query))
    );
  }, [sessions, searchQuery]);

  // (activeSession derived if needed in future multi-session isolation)

  // Command palette-like inline helper for slash commands
  const [showCommands, setShowCommands] = useState(false);
  const commandList = [
    { key: '/summary', desc: "Summarize today's job applications" },
    { key: '/followup', desc: 'Draft a professional follow-up email' },
    { key: '/plan', desc: 'Create a weekly job search action plan' },
    { key: '/improve', desc: 'Suggest resume improvement points' },
    { key: '/interview', desc: 'Generate interview prep checklist' },
  ];

  return (
    <div className="relative flex h-full w-full flex-col font-sans bg-black overflow-hidden">
      {/* Loading state */}
      {loadingTier && (
        <div className="flex items-center justify-center h-full">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1dff00] mx-auto mb-4"></div>
            <p className="text-white/90">Loading...</p>
          </div>
        </div>
      )}
      
      {/* Access Gate for Free and Basics tier users */}
      {!loadingTier && (subscriptionTier === 'Free' || subscriptionTier === 'Basics') && (
        <div className="flex items-center justify-center h-full p-4 sm:p-6">
          <UpgradePrompt
            title="AI Chat Assistant"
            description="Unlock intelligent job search conversations with our advanced AI assistant. Get personalized advice, resume tips, and career guidance 24/7."
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
      
      {/* Chat interface - only visible for Pro and Ultimate users */}
      {!loadingTier && (subscriptionTier === 'Pro' || subscriptionTier === 'Ultimate') && (
        <>
      {/* Subtle ambient background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(29,255,0,0.08),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(10,130,70,0.06),transparent_50%)]" />
      
      <div className="mx-auto flex h-full w-full max-w-[1920px] gap-0">
        {/* Enhanced Sidebar */}
        <aside className={`hidden md:flex flex-col border-r border-white/[0.06] bg-black/40 backdrop-blur-xl transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-80'} relative`}>
          {/* Sidebar Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.06]">
            {!sidebarCollapsed && (
              <>
                <h3 className="text-xs font-medium tracking-wider uppercase text-white/70">Conversations</h3>
                <button 
                  onClick={createSession} 
                  className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg bg-[#1dff00]/10 hover:bg-[#1dff00]/15 border border-[#1dff00]/20 text-[#1dff00] transition-all hover:scale-105 active:scale-95"
                >
                  <Plus size={12} />
                  <span>New</span>
                </button>
              </>
            )}
            {sidebarCollapsed && (
              <button 
                onClick={createSession} 
                className="mx-auto p-2 rounded-lg bg-[#1dff00]/10 hover:bg-[#1dff00]/15 border border-[#1dff00]/20 text-[#1dff00] transition-all hover:scale-105"
              >
                <Plus size={14} />
              </button>
            )}
          </div>

          {/* Search Bar */}
          {!sidebarCollapsed && (
            <div className="px-3 py-3 border-b border-white/[0.06]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={14} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full pl-9 pr-3 py-2 text-[11px] rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/90 placeholder:text-white/40 focus:outline-none focus:border-[#1dff00]/30 focus:bg-white/[0.05] transition-all"
                />
              </div>
            </div>
          )}
          
          {/* Sessions List */}
          <div className="flex-1 overflow-auto">
            {!sidebarCollapsed ? (
              filteredSessions.length > 0 ? (
                filteredSessions.map(s => (
                  <div 
                    key={s.id} 
                    onClick={() => setActiveSessionId(s.id)} 
                    className={`group relative border-b border-white/[0.04] px-3 py-3 text-[11px] cursor-pointer transition-all ${
                      s.id === activeSessionId 
                        ? 'bg-[#1dff00]/[0.08] border-l-2 border-l-[#1dff00]' 
                        : 'hover:bg-white/[0.03]'
                    }`}
                  > 
                    {renamingSession === s.id ? (
                      <input 
                        autoFocus 
                        defaultValue={s.title} 
                        onBlur={e => { renameSession(s.id, e.target.value || 'Untitled'); setRenamingSession(null); }} 
                        onKeyDown={e => { if (e.key==='Enter') (e.target as HTMLInputElement).blur(); }} 
                        className="px-2 py-1 rounded-md bg-white/[0.08] text-white/90 text-[11px] outline-none border border-[#1dff00]/30 w-full focus:border-[#1dff00]/50" 
                      />
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="flex-1 truncate text-white/90 font-medium leading-tight" title={s.title}>{s.title}</span>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e)=>{ e.stopPropagation(); setRenamingSession(s.id); }} 
                              className="p-1 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-white/60 hover:text-white/90 transition-all"
                            >
                              <Edit3 size={11} />
                            </button>
                            <button 
                              onClick={(e)=>{ e.stopPropagation(); deleteSession(s.id); }} 
                              className="p-1 rounded-md bg-white/[0.05] hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-all"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-white/40">
                          <span>{new Date(s.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          <span className="flex items-center gap-1">
                            <MessageSquare size={8} />
                            {s.messages.length}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-6 text-center">
                  <Search className="mx-auto mb-2 text-white/20" size={24} />
                  <p className="text-[11px] text-white/40">No conversations found</p>
                </div>
              )
            ) : (
              sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSessionId(s.id)}
                  className={`w-full p-3 border-b border-white/[0.04] transition-all ${
                    s.id === activeSessionId 
                      ? 'bg-[#1dff00]/[0.08] border-l-2 border-l-[#1dff00]' 
                      : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <MessageSquare className="mx-auto text-white/60" size={16} />
                </button>
              ))
            )}
          </div>

          {/* Sidebar Toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute -right-3 top-20 z-10 p-1.5 rounded-full bg-black border border-white/10 text-white/60 hover:text-white/90 hover:border-[#1dff00]/30 transition-all shadow-lg"
          >
            <svg 
              className={`w-3 h-3 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </aside>
        {/* Main Column */}
        <div className="flex flex-1 flex-col gap-3">
          {/* Minimalist Header */}
          <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-white/[0.06] px-6 py-4 bg-black/20 backdrop-blur-sm">
            <div className="flex flex-col">
              <h1 className="text-base font-semibold tracking-tight text-white/95">AI Assistant</h1>
              <p className="text-[11px] text-white/50 mt-0.5">Enterprise-grade career intelligence</p>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              {/* Status Indicator */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08]">
                <span className={`h-1.5 w-1.5 rounded-full ${status === 'in_progress' ? 'bg-[#1dff00] animate-pulse' : 'bg-white/30'}`} />
                <span className="text-white/70">{status === 'in_progress' ? 'Generating' : 'Ready'}</span>
              </div>
              
              {/* Persona Selector - Minimalist */}
              <select 
                value={persona} 
                onChange={e=>setPersona(e.target.value as Persona)} 
                className="px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-[11px] text-white/90 focus:outline-none focus:ring-1 focus:ring-[#1dff00]/40 focus:border-[#1dff00]/30 transition-all cursor-pointer hover:bg-white/[0.05]"
              >
                {Object.entries(personaLabel).map(([val,label]) => <option key={val} value={val} className="bg-black text-white/90">{label}</option>)}
              </select>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5">
                {status === 'in_progress' && (
                  <button 
                    onClick={stop} 
                    className="px-3 py-1.5 rounded-full text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
                  >
                    Stop
                  </button>
                )}
                {status !== 'in_progress' && messages.some(m=>m.role==='assistant') && (
                  <button 
                    onClick={regenerate} 
                    className="px-3 py-1.5 rounded-full text-[10px] bg-[#1dff00]/10 text-[#1dff00] border border-[#1dff00]/20 hover:bg-[#1dff00]/15 transition-all"
                  >
                    Regenerate
                  </button>
                )}
              </div>
            </div>
          </header>
          {/* Conversation Area - Clean & Modern */}
          <div className="flex-1 min-h-0 flex flex-col bg-black/20 backdrop-blur-sm border border-white/[0.06] relative overflow-hidden">
            <Conversation className="flex-1" data-tour="chat-transcript">
              <ConversationContent className="px-4 sm:px-8 py-6 space-y-6">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-32 text-center gap-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1dff00]/10 to-[#0a8246]/5 border border-[#1dff00]/20 flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-[#1dff00]" />
                    </div>
                    <div className="max-w-md mx-auto flex flex-col gap-4">
                      <h2 className="text-lg font-medium tracking-tight text-white/95">Welcome to AI Assistant</h2>
                      <p className="text-xs leading-relaxed text-white/50">
                        Ask questions about your job search strategy, get resume feedback, or request career guidance.
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center pt-4">
                        {quickPrompts.slice(0,3).map(q => (
                          <button 
                            key={q} 
                            onClick={()=>{ setText(q); setEditing(false); }} 
                            className="px-4 py-2 rounded-lg text-[11px] bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-[#1dff00]/30 text-white/70 hover:text-white/90 transition-all"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {messages.map((msg, idx) => {
                  const isUser = msg.role==='user';
                  const bubble = isUser
                    ? 'bg-gradient-to-br from-[#1dff00]/95 via-[#45d86e]/90 to-[#0a8246]/95 text-black font-medium'
                    : 'bg-white/[0.02] text-white/90 border border-white/[0.06]';
                  const time = new Date(msg.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                  const textContent = msg.parts?.[0]?.text || msg.content;
                  const lastUserIdLocal = lastUserId;
                  const prev = messages[idx-1];
                  const showAvatar = !prev || prev.role !== msg.role;
                  const isLastUser = isUser && msg.id === lastUserIdLocal;
                  const radius = 'rounded-2xl';
                  
                  return (
                    <div key={msg.id} className="group relative flex flex-col gap-1.5 animate-[fadeIn_0.4s_ease]">
                      <div className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}> 
                        {!isUser && showAvatar && (
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#1dff00]/15 to-[#0a8246]/10 text-[10px] font-semibold text-[#1dff00] border border-[#1dff00]/20">
                            AI
                          </div>
                        )}
                        <div className={`relative max-w-[85%] md:max-w-2xl ${radius} px-4 py-3 text-[13px] leading-relaxed tracking-normal transition-all ${bubble}`}> 
                          {msg.streaming ? (
                            <div className="whitespace-pre-wrap break-words flex items-center gap-1.5">
                              <span>{textContent}</span>
                              <span className="inline-flex items-center gap-0.5">
                                <span className="h-1 w-1 rounded-full bg-current animate-pulse opacity-60" />
                                <span className="h-1 w-1 rounded-full bg-current animate-pulse delay-150 opacity-40" />
                                <span className="h-1 w-1 rounded-full bg-current animate-pulse delay-300 opacity-20" />
                              </span>
                            </div>
                          ) : renderRichText(textContent)}
                        </div>
                        {isUser && showAvatar && (
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-[10px] font-semibold text-white/90 border border-white/[0.08]">
                            You
                          </div>
                        )}
                      </div>
                      {/* Message Actions */}
                      <div className={`flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? 'justify-end pr-11' : 'justify-start pl-11'}`}>
                        <button 
                          onClick={()=>copyMessage(msg.id, textContent)} 
                          className="px-2 py-1 rounded-md text-[9px] bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white/90 border border-white/[0.06] transition-all"
                        >
                          {copiedId===msg.id ? 'Copied' : 'Copy'}
                        </button>
                        {isLastUser && !editing && (
                          <button 
                            onClick={()=>{ setText(textContent); setEditing(true); }} 
                            className="px-2 py-1 rounded-md text-[9px] bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white/90 border border-white/[0.06] transition-all"
                          >
                            Edit
                          </button>
                        )}
                        <span className="text-[9px] text-white/40">{time}</span>
                      </div>
                    </div>
                  );
                })}
                <ConversationScrollButton className="relative z-10" />
              </ConversationContent>
            </Conversation>
          </div>
          {/* Input Area - Refined & Professional */}
          <div className="border-t border-white/[0.06] bg-black/20 backdrop-blur-sm">
            {messages.length > 0 && (
              <div className="flex flex-wrap gap-2 px-6 pt-4 pb-2">
                {quickPrompts.map(q => (
                  <button 
                    key={q} 
                    onClick={()=>{ setText(q); setEditing(false); }} 
                    className="px-3 py-1.5 rounded-lg text-[10px] bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-[#1dff00]/30 text-white/60 hover:text-white/90 transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            <PromptInput onSubmit={handleSubmit} className="p-6" multiple globalDrop>
              <PromptInputBody className="relative rounded-xl border border-white/[0.08] bg-white/[0.02] focus-within:border-[#1dff00]/30 focus-within:bg-white/[0.03] transition-all">
                <PromptInputAttachments>{file => <PromptInputAttachment data={file} />}</PromptInputAttachments>
                <PromptInputTextarea 
                  value={text} 
                  onChange={e=>{ setText(e.target.value); setShowCommands(e.target.value.startsWith('/') && e.target.value.length <= 30); }} 
                  placeholder={editing ? 'Edit your message and press Enter to resend...' : 'Ask me anything about your career...'} 
                  className="min-h-[80px] text-[13px] text-white/90 placeholder:text-white/40" 
                  ref={textareaRef} 
                  data-tour="chat-input" 
                />
                {showCommands && !text.includes(' ') && (
                  <div className="absolute left-2 right-2 top-2 z-20 rounded-xl border border-white/[0.1] bg-black/95 backdrop-blur-xl p-2 shadow-2xl animate-[fadeIn_0.2s_ease]">
                    <ul className="flex flex-col gap-0.5 max-h-60 overflow-auto text-[11px]">
                      {commandList.map(c => (
                        <li key={c.key}>
                          <button
                            onClick={()=>{ setText(c.key + ' '); setShowCommands(false); textareaRef.current?.focus(); }}
                            className="w-full flex items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/[0.05] transition-all group"
                          >
                            <span className="font-mono text-[#1dff00] font-medium group-hover:translate-x-0.5 transition-transform">{c.key}</span>
                            <span className="text-white/50 group-hover:text-white/80 transition-colors text-[10px] leading-relaxed">{c.desc}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </PromptInputBody>
              <PromptInputToolbar className="mt-3 flex flex-wrap gap-3 justify-between items-center">
                <PromptInputTools className="flex items-center gap-2">
                  <PromptInputActionMenu>
                    <PromptInputActionMenuTrigger />
                    <PromptInputActionMenuContent>
                      <PromptInputActionAddAttachments />
                    </PromptInputActionMenuContent>
                  </PromptInputActionMenu>
                  <PromptInputButton onClick={()=>setUseMicrophone(v=>!v)} variant={useMicrophone ? 'default' : 'ghost'}>
                    <MicIcon size={15} />
                    <span className="sr-only">Microphone</span>
                  </PromptInputButton>
                  <PromptInputButton onClick={()=>setUseWebSearch(v=>!v)} variant={useWebSearch ? 'default' : 'ghost'}>
                    <GlobeIcon size={15} />
                    <span className="sr-only">Web Search</span>
                  </PromptInputButton>
                  
                  <ModelDropdown 
                    value={model} 
                    onValueChange={(v) => setModel(v)} 
                    models={models}
                  />
                </PromptInputTools>
                <PromptInputSubmit 
                  disabled={!text && status !== 'in_progress'} 
                  status={status === 'in_progress' ? 'in_progress' : undefined as any} 
                  className="px-6 py-2.5 rounded-lg bg-[#1dff00] hover:bg-[#1dff00]/90 text-black font-medium text-[12px] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed" 
                />
              </PromptInputToolbar>
              <div className="pt-2 text-[9px] tracking-wide text-white/40 flex justify-between items-center">
                <span className="flex items-center gap-2">
                  {editing && <span className="text-[#1dff00]">✎ Editing message</span>}
                  {!editing && status === 'in_progress' && <span className="text-[#1dff00] animate-pulse">● Generating response...</span>}
                  {!editing && status !== 'in_progress' && <span>Press Ctrl+Enter to send</span>}
                </span>
                <span className="font-mono">{text.length}/2000 · ~{tokenEstimate} tokens</span>
              </div>
            </PromptInput>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};

export default ChatPage;