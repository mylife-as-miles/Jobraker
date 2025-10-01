// Clean AI-elements only Chat Page implementation
import { useState, useCallback, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import { useRegisterCoachMarks } from "../../../providers/TourProvider";
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
// Temporary lightweight chat hook placeholder (remove when real ai/react is available)
type Persona = 'concise' | 'friendly' | 'analyst' | 'coach';
interface BasicMessage { id: string; role: 'user' | 'assistant'; content: string; parts?: { type: 'text'; text: string }[]; streaming?: boolean; createdAt: number; meta?: { persona?: Persona; parent?: string } }
interface UseChatReturn { messages: BasicMessage[]; status: 'idle' | 'in_progress'; append: (m: { role: 'user'; content: string }) => void; regenerate: () => void; stop: () => void }
const useChat = (_opts: { api: string }): UseChatReturn => {
  const [messages, setMessages] = useState<BasicMessage[]>([]);
  const [status, setStatus] = useState<'idle' | 'in_progress'>('idle');
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  const lastUserContentRef = useRef<string>('');

  // Persistence
  useEffect(()=>{
    try {
      const raw = localStorage.getItem('chat_session_default');
      if (raw) {
        const parsed: BasicMessage[] = JSON.parse(raw);
        setMessages(parsed);
      }
    } catch {}
  }, []);
  useEffect(()=>{
    try { localStorage.setItem('chat_session_default', JSON.stringify(messages)); } catch {}
  }, [messages]);

  const streamAssistant = (assistantId: string, tokens: string[], i: number) => {
    setMessages(prev => prev.map(msg => msg.id === assistantId
      ? { ...msg, parts: [{ type: 'text', text: tokens.slice(0, i + 1).join(' ') }], streaming: i + 1 < tokens.length }
      : msg));
    if (cancelRef.current.cancelled) {
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, streaming: false } : m));
      setStatus('idle');
      return;
    }
    if (i + 1 < tokens.length) {
      setTimeout(() => streamAssistant(assistantId, tokens, i + 1), 40 + Math.random()*60);
    } else {
      setStatus('idle');
    }
  };

  const append = (m: { role: 'user'; content: string }) => {
    const userId = Math.random().toString(36).slice(2);
    lastUserContentRef.current = m.content;
    setMessages(prev => [...prev, { id: userId, role: m.role, content: m.content, createdAt: Date.now(), parts: [{ type: 'text', text: m.content }] }]);
    // Simulated streaming assistant reply
    setStatus('in_progress');
    const assistantId = Math.random().toString(36).slice(2);
    const reply = `You said: "${m.content}". This is a simulated streaming response demonstrating incremental token updates.`;
    const tokens = reply.split(/\s+/);
    cancelRef.current.cancelled = false;
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: reply, createdAt: Date.now(), parts: [{ type: 'text', text: '' }], streaming: true, meta: { parent: userId } }]);
    // start token streaming
    setTimeout(() => streamAssistant(assistantId, tokens, 0), 120);
  };
  const regenerate = () => {
    if (status === 'in_progress') return;
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUser) return;
    append({ role: 'user', content: lastUser.content });
  };
  const stop = () => {
    cancelRef.current.cancelled = true;
  };
  return { messages, status, append, regenerate, stop };
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
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input';
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation';
// Custom styled bubbles leveraging Conversation primitives


const models = [
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'claude-opus-4-20250514', name: 'Claude 4 Opus' },
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
  const [sessions, setSessions] = useState<{ id: string; title: string; createdAt: number; updatedAt: number; messages: BasicMessage[] }[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [renamingSession, setRenamingSession] = useState<string | null>(null);
  useRegisterCoachMarks({
    page: 'chat',
    marks: [
      { id: 'chat-model-select', selector: '[data-chat-model-select]', title: 'Model Selection', body: 'Choose the intelligence model best aligned with your current task.' },
      { id: 'chat-transcript', selector: '.conversation-scroll-area, .conversation-container', title: 'Conversation History', body: 'Scroll to review prior exchanges. Context improves follow-up quality.' },
      { id: 'chat-input', selector: 'textarea', title: 'Prompt Input', body: 'Craft clear, specific prompts. Use the toolbar for attachments or settings.' }
    ]
  });
  
  // Chat logic
  const chat = useChat({ api: '/api/chat' });
  const { messages, status, append, regenerate, stop } = chat;

  // Session persistence ------------------------------------------------------
  useEffect(() => {
    try {
      const raw = localStorage.getItem('chat_sessions_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSessions(parsed);
          if (parsed.length) setActiveSessionId(parsed[0].id);
        }
      } else {
        // initialize with one session if none
        const id = nanoid();
        const initial = [{ id, title: 'New Chat', createdAt: Date.now(), updatedAt: Date.now(), messages: [] }];
        setSessions(initial);
        setActiveSessionId(id);
      }
    } catch {}
  }, []);

  // Sync active session messages with chat hook (simple mirror)
  useEffect(() => {
    if (!activeSessionId) return;
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages } : s));
  }, [messages, activeSessionId]);

  useEffect(() => {
    try { localStorage.setItem('chat_sessions_v1', JSON.stringify(sessions)); } catch {}
  }, [sessions]);

  const createSession = () => {
    const id = nanoid();
    setSessions(prev => [{ id, title: 'New Chat', createdAt: Date.now(), updatedAt: Date.now(), messages: [] }, ...prev]);
    setActiveSessionId(id);
    // reset chat state (simple page-level reset)
    window.location.hash = '#chat-' + id; // hint without full navigation
    // Hard reset by reloading for simplicity to reuse hook state; optional improvement: refactor hook to accept external messages.
    // For now mimic reset:
  };

  const deleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      const remaining = sessions.filter(s => s.id !== id);
      setActiveSessionId(remaining[0]?.id || null);
    }
  };

  const renameSession = (id: string, title: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title, updatedAt: Date.now() } : s));
  };

  // Quick prompts
  const quickPrompts = [
    "Summarize today's job applications",
    'Generate a professional follow-up email',
    'Suggest ways to improve my resume headline',
    'Create a weekly job search action plan',
    'List interview prep topics for a frontend role'
  ];

  const personaLabel: Record<Persona, string> = {
    concise: 'Concise',
    friendly: 'Friendly',
    analyst: 'Analyst',
    coach: 'Coach'
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
          <div key={i} className="mt-3 mb-2 rounded-lg border border-neutral-800 bg-neutral-950/80 overflow-hidden text-[12px]">
            <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-900/80 text-neutral-400 uppercase tracking-wider text-[10px]">
              <span>{b.lang || 'code'}</span>
              <button
                onClick={() => navigator.clipboard.writeText(b.content)}
                className="px-2 py-0.5 rounded-md bg-neutral-800 hover:bg-neutral-700 text-[10px] text-neutral-300"
              >Copy</button>
            </div>
            <div className="max-h-[480px] overflow-auto">
              <SyntaxHighlighter
                language={b.lang || 'text'}
                style={atomOneDark as any}
                customStyle={{ margin: 0, background: 'transparent', fontSize: '12px', padding: '12px 14px' }}
                showLineNumbers={b.content.split('\n').length > 4}
                wrapLongLines
              >{b.content}</SyntaxHighlighter>
            </div>
          </div>
        );
      }
      const segs = b.content.split(/(`[^`]+`)/g).map((seg, j) => seg.startsWith('`') && seg.endsWith('`') ? (
        <code key={j} className="px-1.5 py-0.5 rounded-md bg-neutral-800/70 text-[#9efca0] text-[12px] font-mono">{seg.slice(1, -1)}</code>
      ) : <span key={j}>{seg}</span>);
      return <div key={i} className="whitespace-pre-wrap break-words selection:bg-[#1dff00]/30">{segs}</div>;
    });
  };

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = !!message.text?.trim();
    const hasFiles = !!message.files?.length; // reserved for future
    if (!hasText && !hasFiles) return;
    const prefix = {
      concise: '',
      friendly: 'Please answer in a warm, encouraging tone. ',
      analyst: 'Provide structured, analytical reasoning. ',
      coach: 'Answer like a career coach with actionable steps. '
    }[persona];
    const finalText = prefix + (message.text || 'Sent with attachments');
    append({ role: 'user', content: finalText });
    // update session title on first message
    setSessions(prev => prev.map(s => s.id === activeSessionId && s.messages.length === 0 ? { ...s, title: (message.text || 'New Chat').slice(0,48) } : s));
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
    <div className="relative flex h-full w-full flex-col overflow-hidden font-sans">
      {/* Ambient gradients */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_18%,#1dff0026,transparent_65%),radial-gradient(circle_at_85%_80%,#0a824626,transparent_55%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 via-black/10 to-transparent" />
      <div className="mx-auto flex h-full w-full max-w-7xl gap-4 px-3 sm:px-5 lg:px-8 py-4">
        {/* Sidebar */}
  <aside className="hidden md:flex w-60 flex-col rounded-2xl border border-neutral-800/60 bg-neutral-950/70 backdrop-blur-xl overflow-hidden shadow-[0_4px_18px_-4px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.03)] relative before:absolute before:inset-0 before:pointer-events-none before:rounded-2xl before:border before:border-white/5">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/70">
            <h3 className="text-xs font-semibold tracking-wide text-neutral-300">Sessions</h3>
            <button onClick={createSession} className="text-[11px] px-2 py-1 rounded-md bg-neutral-800/70 hover:bg-neutral-700 border border-neutral-700/70 text-neutral-300">New</button>
          </div>
          <div className="flex-1 overflow-auto">
            {sessions.map(s => (
              <div key={s.id} onClick={() => setActiveSessionId(s.id)} className={`group border-b border-neutral-900/60 px-3 py-2.5 text-[11px] cursor-pointer flex flex-col gap-1 ${s.id === activeSessionId ? 'bg-neutral-900/60' : 'hover:bg-neutral-900/30'}`}> 
                {renamingSession === s.id ? (
                  <input autoFocus defaultValue={s.title} onBlur={e => { renameSession(s.id, e.target.value || 'Untitled'); setRenamingSession(null); }} onKeyDown={e => { if (e.key==='Enter') (e.target as HTMLInputElement).blur(); }} className="px-1.5 py-1 rounded bg-neutral-800/70 text-neutral-200 text-[11px] outline-none border border-neutral-700/70 w-full" />
                ) : (
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate" title={s.title}>{s.title}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e)=>{ e.stopPropagation(); setRenamingSession(s.id); }} className="px-1 py-0.5 rounded bg-neutral-800/70 hover:bg-neutral-700 text-neutral-400">✎</button>
                      <button onClick={(e)=>{ e.stopPropagation(); deleteSession(s.id); }} className="px-1 py-0.5 rounded bg-neutral-800/70 hover:bg-red-600/30 text-neutral-400">✕</button>
                    </div>
                  </div>
                )}
                <div className="flex justify-between text-[9px] text-neutral-500">
                  <span>{new Date(s.updatedAt).toLocaleDateString()}</span>
                  <span>{s.messages.length}</span>
                </div>
              </div>
            ))}
            {!sessions.length && <div className="p-4 text-[11px] text-neutral-500">No sessions</div>}
          </div>
        </aside>
        {/* Main Column */}
        <div className="flex flex-1 flex-col gap-4">
          <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-2xl border border-neutral-800/60 bg-neutral-950/70 backdrop-blur-xl px-4 sm:px-6 py-4 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)] relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(circle_at_30%_30%,black,transparent_70%)] bg-[conic-gradient(from_140deg,rgba(29,255,0,0.12),rgba(10,130,70,0.05),transparent_70%)]" />
            <div className="flex flex-col">
              <h1 className="text-sm sm:text-base font-semibold tracking-wide bg-gradient-to-r from-[#1dff00] via-[#6dffb0] to-[#1dff00] bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(29,255,0,0.25)]">Intelligent Assistant</h1>
              <p className="text-[11px] sm:text-xs text-neutral-400/80">Ask about applications, resumes, interviews & more.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[10px] sm:text-xs text-neutral-400">
              <div className="flex items-center gap-2">
                <span className={status === 'in_progress' ? 'text-[#1dff00] animate-pulse' : ''}>{status === 'in_progress' ? 'Generating…' : 'Idle'}</span>
                <span className="h-4 w-px bg-neutral-800" />
                <span>{messages.filter(m=>m.role==='user').length} msg</span>
              </div>
              <div className="flex items-center gap-1">
                <label className="uppercase tracking-wider text-[9px] text-neutral-500">Persona</label>
                <select value={persona} onChange={e=>setPersona(e.target.value as Persona)} className="bg-neutral-900/70 border border-neutral-700/60 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#1dff00]/60">
                  {Object.entries(personaLabel).map(([val,label]) => <option key={val} value={val}>{label}</option>)}
                </select>
                <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-neutral-700/60 bg-neutral-900/60 px-2 py-0.5 text-[10px] text-neutral-400">
                  <span className="inline-block h-2 w-2 rounded-full bg-gradient-to-br from-[#1dff00] to-[#0a8246] shadow-[0_0_0_2px_rgba(29,255,0,0.25)]" />
                  {personaLabel[persona]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {status === 'in_progress' && <button onClick={stop} className="px-2 py-1 rounded-md text-[10px] bg-red-600/20 text-red-300 border border-red-500/30 hover:bg-red-600/30 transition">Stop</button>}
                {status !== 'in_progress' && messages.some(m=>m.role==='assistant') && <button onClick={regenerate} className="px-2 py-1 rounded-md text-[10px] bg-neutral-800/70 text-neutral-300 border border-neutral-700 hover:bg-neutral-700 transition">Regenerate</button>}
              </div>
            </div>
          </header>
          <div className="flex-1 min-h-0 flex flex-col rounded-3xl border border-neutral-800/60 bg-neutral-950/70 backdrop-blur-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_12px_40px_-10px_rgba(0,0,0,0.7)] overflow-hidden relative">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/60 to-transparent z-10" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent z-10" />
            <Conversation className="flex-1">
              <ConversationContent className="px-3 sm:px-6 py-8 space-y-7">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-24 text-center gap-6">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#1dff00]/20 to-[#0a8246]/10 border border-[#1dff00]/25 flex items-center justify-center shadow-inner"><GlobeIcon className="w-9 h-9 text-[#1dff00]" /></div>
                    <div className="max-w-sm mx-auto flex flex-col gap-3">
                      <h2 className="text-lg font-semibold tracking-wide text-neutral-100">Start a conversation</h2>
                      <p className="text-xs leading-relaxed text-neutral-400">Use the prompt box below to ask anything about your job search workflow. Attach resumes or enable web search for richer answers.</p>
                      <div className="flex flex-wrap gap-2 justify-center pt-2">
                        {quickPrompts.slice(0,3).map(q => <button key={q} onClick={()=>{ setText(q); setEditing(false); }} className="px-3 py-1.5 rounded-full text-[11px] bg-neutral-900/70 hover:bg-neutral-800 border border-neutral-700/70 text-neutral-300 hover:text-white transition">{q}</button>)}
                      </div>
                    </div>
                  </div>
                )}
                {messages.map((msg, idx) => {
                  const isUser = msg.role==='user';
                  const bubble = isUser
                    ? 'bg-gradient-to-br from-[#1dff00] via-[#45d86e] to-[#0a8246] text-black shadow-[0_8px_24px_-6px_rgba(29,255,0,0.35)]'
                    : 'bg-neutral-900/80 text-neutral-100 border border-neutral-800/70 shadow-[0_4px_18px_-4px_rgba(0,0,0,0.55)]';
                  const time = new Date(msg.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                  const textContent = msg.parts?.[0]?.text || msg.content;
                  const lastUserIdLocal = lastUserId;
                  const prev = messages[idx-1];
                  const showAvatar = !prev || prev.role !== msg.role;
                  const isLastUser = isUser && msg.id === lastUserIdLocal;
                  const next = messages[idx+1];
                  const isGroupedTop = prev && prev.role === msg.role;
                  const isGroupedBottom = next && next.role === msg.role;
                  const radius = isUser
                    ? `${isGroupedTop ? 'rounded-tr-md' : 'rounded-tr-2xl'} ${isGroupedBottom ? 'rounded-br-md' : 'rounded-br-2xl'} rounded-tl-2xl rounded-bl-2xl`
                    : `${isGroupedTop ? 'rounded-tl-md' : 'rounded-tl-2xl'} ${isGroupedBottom ? 'rounded-bl-md' : 'rounded-bl-2xl'} rounded-tr-2xl rounded-br-2xl`;
                  return (
                    <div key={msg.id} className="group relative flex flex-col gap-2">
                      <div className={`flex items-end gap-3 ${isUser ? 'justify-end' : 'justify-start'} animate-[fadeIn_0.5s_ease]`}> 
                        {!isUser && showAvatar && <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#1dff00]/30 to-[#0a8246]/30 text-[11px] font-semibold text-[#1dff00] border border-[#1dff00]/30 shadow-inner backdrop-blur-sm">AI</div>}
                        {isUser && showAvatar && <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-800/80 text-[11px] font-semibold text-neutral-200 border border-neutral-700 shadow-inner">You</div>}
                        <div className={`relative max-w-[92%] md:max-w-3xl ${radius} px-4 py-3 text-sm leading-relaxed tracking-wide backdrop-blur-sm transition-shadow ${bubble}`}> 
                          {msg.streaming ? (
                            <div className="whitespace-pre-wrap break-words selection:bg-[#1dff00]/30 flex items-center gap-1">
                              <span>{textContent}</span>
                              <span className="inline-flex items-center gap-0.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-black/60 animate-pulse" />
                                <span className="h-1.5 w-1.5 rounded-full bg-black/40 animate-pulse delay-150" />
                                <span className="h-1.5 w-1.5 rounded-full bg-black/20 animate-pulse delay-300" />
                              </span>
                            </div>
                          ) : renderRichText(textContent)}
                          <div className="absolute -bottom-6 left-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-neutral-500">
                            <button onClick={()=>copyMessage(msg.id, textContent)} className="px-1.5 py-0.5 rounded-md bg-neutral-800/70 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700/70 shadow-inner">{copiedId===msg.id ? 'Copied' : 'Copy'}</button>
                            {isLastUser && !editing && <button onClick={()=>{ setText(textContent); setEditing(true); }} className="px-1.5 py-0.5 rounded-md bg-neutral-800/70 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700/70 shadow-inner">Edit</button>}
                            {!isUser && <>
                              <button className="px-1.5 py-0.5 rounded-md bg-neutral-800/70 hover:bg-neutral-700 text-neutral-300 border border-neutral-700/70 shadow-inner">👍</button>
                              <button className="px-1.5 py-0.5 rounded-md bg-neutral-800/70 hover:bg-neutral-700 text-neutral-300 border border-neutral-700/70 shadow-inner">👎</button>
                            </>}
                            <span className="select-none hidden sm:inline">{isUser ? 'You' : 'AI'} • {time}</span>
                          </div>
                        </div>
                        {isUser && showAvatar && <div className="w-9" />}
                      </div>
                    </div>
                  );
                })}
                <ConversationScrollButton className="relative z-10" />
              </ConversationContent>
            </Conversation>
          </div>
          <div className="rounded-2xl border border-neutral-800/70 bg-neutral-950/80 backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_10px_36px_-8px_rgba(0,0,0,0.65)] relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(29,255,0,0.07),transparent_35%,transparent_65%,rgba(10,130,70,0.08))] opacity-80" />
            {messages.length > 0 && (
              <div className="flex flex-wrap gap-2 px-4 pt-4 -mb-1">
                {quickPrompts.map(q => <button key={q} onClick={()=>{ setText(q); setEditing(false); }} className="px-3 py-1.5 rounded-full text-[11px] bg-neutral-900/70 hover:bg-neutral-800 border border-neutral-700/70 text-neutral-300 hover:text-white transition">{q}</button>)}
              </div>
            )}
            <PromptInput onSubmit={handleSubmit} className="p-3 sm:p-4" multiple globalDrop>
              <PromptInputBody className="relative rounded-xl border border-neutral-800/70 bg-neutral-900/70 focus-within:border-[#1dff00]/50 transition-colors shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_4px_18px_-6px_rgba(0,0,0,0.7)]">
                <div className="pointer-events-none absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_70%_30%,rgba(29,255,0,0.18),transparent_70%)] opacity-30" />
                <PromptInputAttachments>{file => <PromptInputAttachment data={file} />}</PromptInputAttachments>
                <PromptInputTextarea value={text} onChange={e=>{ setText(e.target.value); setShowCommands(e.target.value.startsWith('/') && e.target.value.length <= 30); }} placeholder={editing ? 'Edit your message…' : 'Ask anything about your applications, resumes, interviews...'} className="min-h-[64px]" ref={textareaRef} />
                {showCommands && !text.includes(' ') && (
                  <div className="absolute left-2 right-2 top-2 z-20 rounded-lg border border-neutral-800/70 bg-neutral-950/95 backdrop-blur-md p-2 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.65)] animate-[fadeIn_0.18s_ease]">
                    <ul className="flex flex-col gap-1 max-h-52 overflow-auto text-[11px]">
                      {commandList.map(c => (
                        <li key={c.key}>
                          <button
                            onClick={()=>{ setText(c.key + ' '); setShowCommands(false); textareaRef.current?.focus(); }}
                            className="w-full flex items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-neutral-800/80 transition group"
                          >
                            <span className="font-mono text-[#1dff00] group-hover:translate-x-px transition-transform">{c.key}</span>
                            <span className="text-neutral-400 group-hover:text-neutral-300">{c.desc}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </PromptInputBody>
              <PromptInputToolbar className="mt-2 flex flex-wrap gap-2 justify-between">
                <PromptInputTools className="flex items-center gap-1.5">
                  <PromptInputActionMenu>
                    <PromptInputActionMenuTrigger />
                    <PromptInputActionMenuContent>
                      <PromptInputActionAddAttachments />
                    </PromptInputActionMenuContent>
                  </PromptInputActionMenu>
                  <PromptInputButton onClick={()=>setUseMicrophone(v=>!v)} variant={useMicrophone ? 'default' : 'ghost'}>
                    <MicIcon size={16} />
                    <span className="sr-only">Microphone</span>
                  </PromptInputButton>
                  <PromptInputButton onClick={()=>setUseWebSearch(v=>!v)} variant={useWebSearch ? 'default' : 'ghost'}>
                    <GlobeIcon size={16} />
                    <span className="sr-only">Web Search</span>
                  </PromptInputButton>
                  <PromptInputModelSelect value={model} onValueChange={v=>setModel(v)}>
                    <PromptInputModelSelectTrigger><PromptInputModelSelectValue /></PromptInputModelSelectTrigger>
                    <PromptInputModelSelectContent>
                      {models.map(m => <PromptInputModelSelectItem key={m.id} value={m.id}>{m.name}</PromptInputModelSelectItem>)}
                    </PromptInputModelSelectContent>
                  </PromptInputModelSelect>
                </PromptInputTools>
                <PromptInputSubmit disabled={!text && status !== 'in_progress'} status={status === 'in_progress' ? 'in_progress' : undefined as any} className="shadow-[0_0_0_1px_#1dff00,0_4px_18px_-4px_rgba(29,255,0,0.45)] hover:shadow-[0_0_0_1px_#1dff00,0_6px_24px_-4px_rgba(29,255,0,0.65)] transition-shadow" />
              </PromptInputToolbar>
              <div className="pt-1 text-[10px] tracking-wider text-neutral-500 flex justify-between font-mono opacity-70">
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <span className={`h-2 w-2 rounded-full ${status==='in_progress' ? 'bg-[#1dff00] animate-pulse' : 'bg-neutral-600'}`} />
                    {editing ? 'Editing – submit to resend' : status === 'in_progress' ? 'Generating response… (Esc to stop)' : 'Idle (Ctrl+Enter to send)'}
                  </span>
                </span>
                <span>{text.length}/2000 · ~{tokenEstimate} tokens</span>
              </div>
            </PromptInput>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;