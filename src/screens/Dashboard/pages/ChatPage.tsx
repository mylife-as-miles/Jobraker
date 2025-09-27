// Clean AI-elements only Chat Page implementation
import { useState, useCallback, useEffect, useRef } from 'react';
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
  
  // Chat logic
  const { messages, status, append, regenerate, stop } = useChat({ api: '/api/chat' });

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
            <pre className="p-3 overflow-auto leading-relaxed whitespace-pre wrap-anywhere"><code>{b.content}</code></pre>
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
    setText('');
    setEditing(false);
  };

  const lastUserId = [...messages].reverse().find(m => m.role === 'user')?.id;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#1dff0040,transparent_60%),radial-gradient(circle_at_80%_70%,#0a824640,transparent_55%)]" />
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-4 py-4 sm:px-6 lg:px-8 gap-4">
        {/* Header */}
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-xl border border-neutral-800/60 bg-neutral-950/70 backdrop-blur-md px-4 sm:px-6 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_4px_18px_-2px_rgba(0,0,0,0.6)]">
          <div className="flex flex-col">
            <h1 className="text-sm sm:text-base font-semibold tracking-wide bg-gradient-to-r from-[#1dff00] via-[#6dffb0] to-[#1dff00] bg-clip-text text-transparent">Intelligent Assistant</h1>
            <p className="text-[11px] sm:text-xs text-neutral-400">Ask about applications, resumes, interviews & more.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[10px] sm:text-xs text-neutral-400">
            <div className="flex items-center gap-2">
              <span className={status === 'in_progress' ? 'text-[#1dff00]' : ''}>{status === 'in_progress' ? 'Generating…' : 'Idle'}</span>
              <span className="h-4 w-px bg-neutral-800" />
              <span>{messages.filter(m => m.role === 'user').length} msg</span>
            </div>
            <div className="flex items-center gap-1">
              <label className="uppercase tracking-wider text-[9px] text-neutral-500">Persona</label>
              <select
                className="bg-neutral-900/70 border border-neutral-700/60 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#1dff00]/60"
                value={persona}
                onChange={e => setPersona(e.target.value as Persona)}
              >
                {Object.entries(personaLabel).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              {status === 'in_progress' && (
                <button onClick={stop} className="px-2 py-1 rounded-md text-[10px] bg-red-600/20 text-red-300 border border-red-500/30 hover:bg-red-600/30 transition">Stop</button>
              )}
              {status !== 'in_progress' && messages.some(m => m.role === 'assistant') && (
                <button onClick={regenerate} className="px-2 py-1 rounded-md text-[10px] bg-neutral-800/70 text-neutral-300 border border-neutral-700 hover:bg-neutral-700 transition">Regenerate</button>
              )}
            </div>
          </div>
        </header>
        {/* Conversation Area */}
        <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-neutral-800/60 bg-neutral-950/60 backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_8px_30px_-4px_rgba(0,0,0,0.65)] overflow-hidden">
          <Conversation className="flex-1">
            <ConversationContent className="px-3 sm:px-6 py-6 space-y-6">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center gap-6">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#1dff00]/20 to-[#0a8246]/10 border border-[#1dff00]/25 flex items-center justify-center shadow-inner">
                    <GlobeIcon className="w-9 h-9 text-[#1dff00]" />
                  </div>
                  <div className="max-w-sm mx-auto flex flex-col gap-3">
                    <h2 className="text-lg font-semibold tracking-wide text-neutral-100">Start a conversation</h2>
                    <p className="text-xs leading-relaxed text-neutral-400">Use the prompt box below to ask anything about your job search workflow. Attach resumes or enable web search for richer answers.</p>
                    <div className="flex flex-wrap gap-2 justify-center pt-2">
                      {quickPrompts.slice(0,3).map(q => (
                        <button
                          key={q}
                          onClick={() => { setText(q); setEditing(false); }}
                          className="px-3 py-1.5 rounded-full text-[11px] bg-neutral-900/70 hover:bg-neutral-800 border border-neutral-700/70 text-neutral-300 hover:text-white transition"
                        >{q}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {messages.map(msg => {
                const isUser = msg.role === 'user';
                const bubble = isUser
                  ? 'bg-gradient-to-br from-[#1dff00] via-[#45d86e] to-[#0a8246] text-black shadow-[0_4px_16px_-2px_rgba(29,255,0,0.35)]'
                  : 'bg-neutral-900/70 text-neutral-100 border border-neutral-800';
                const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const textContent = msg.parts?.[0]?.text || msg.content;
                const isLastUser = isUser && msg.id === lastUserId;
                return (
                  <div key={msg.id} className="group relative flex flex-col gap-2">
                    <div className={"flex " + (isUser ? 'justify-end' : 'justify-start')}>
                      <div className={"relative max-w-[92%] md:max-w-3xl rounded-2xl px-4 py-3 text-sm leading-relaxed tracking-wide backdrop-blur-sm transition-shadow " + bubble}>
                        {/* Streaming / plain text */}
                        <div className="whitespace-pre-wrap break-words selection:bg-[#1dff00]/30">
                          {msg.streaming ? `${textContent} ▌` : null}
                        </div>
                        {!msg.streaming && renderRichText(textContent)}
                        {/* Hover Actions */}
                        <div className="absolute -bottom-5 left-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-neutral-500">
                          <button
                            onClick={() => copyMessage(msg.id, textContent)}
                            className="px-1.5 py-0.5 rounded-md bg-neutral-800/70 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700/70 shadow-inner"
                          >{copiedId === msg.id ? 'Copied' : 'Copy'}</button>
                          {isLastUser && !editing && (
                            <button
                              onClick={() => { setText(textContent); setEditing(true); }}
                              className="px-1.5 py-0.5 rounded-md bg-neutral-800/70 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700/70 shadow-inner"
                            >Edit</button>
                          )}
                          <span className="select-none">{isUser ? 'You' : 'AI'} • {time}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <ConversationScrollButton className="relative z-10" />
            </ConversationContent>
          </Conversation>
        </div>
        {/* Prompt Input */}
        <div className="rounded-xl border border-neutral-800/70 bg-neutral-950/70 backdrop-blur-md shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_6px_24px_-4px_rgba(0,0,0,0.6)]">
          {messages.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pt-4 -mb-1">
              {quickPrompts.map(q => (
                <button
                  key={q}
                  onClick={() => { setText(q); setEditing(false); }}
                  className="px-3 py-1.5 rounded-full text-[11px] bg-neutral-900/70 hover:bg-neutral-800 border border-neutral-700/70 text-neutral-300 hover:text-white transition"
                >{q}</button>
              ))}
            </div>
          )}
          <PromptInput onSubmit={handleSubmit} className="p-3 sm:p-4" multiple globalDrop>
            <PromptInputBody className="rounded-xl border border-neutral-800/70 bg-neutral-900/70 focus-within:border-[#1dff00]/50 transition-colors">
              <PromptInputAttachments>
                {(file) => <PromptInputAttachment data={file} />}
              </PromptInputAttachments>
              <PromptInputTextarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={editing ? 'Edit your message…' : 'Ask anything about your applications, resumes, interviews...'}
                className="min-h-[64px]"
              />
            </PromptInputBody>
            <PromptInputToolbar className="mt-2 flex flex-wrap gap-2 justify-between">
              <PromptInputTools className="flex items-center gap-1.5">
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments />
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>
                <PromptInputButton
                  onClick={() => setUseMicrophone(v => !v)}
                  variant={useMicrophone ? 'default' : 'ghost'}
                >
                  <MicIcon size={16} />
                  <span className="sr-only">Microphone</span>
                </PromptInputButton>
                <PromptInputButton
                  onClick={() => setUseWebSearch(v => !v)}
                  variant={useWebSearch ? 'default' : 'ghost'}
                >
                  <GlobeIcon size={16} />
                  <span className="sr-only">Web Search</span>
                </PromptInputButton>
                <PromptInputModelSelect value={model} onValueChange={(v) => setModel(v)}>
                  <PromptInputModelSelectTrigger>
                    <PromptInputModelSelectValue />
                  </PromptInputModelSelectTrigger>
                  <PromptInputModelSelectContent>
                    {models.map(m => (
                      <PromptInputModelSelectItem key={m.id} value={m.id}>{m.name}</PromptInputModelSelectItem>
                    ))}
                  </PromptInputModelSelectContent>
                </PromptInputModelSelect>
              </PromptInputTools>
              <PromptInputSubmit
                disabled={!text && status !== 'in_progress'}
                status={status === 'in_progress' ? 'in_progress' : undefined as any}
                className="shadow-[0_0_0_1px_#1dff00,0_4px_18px_-4px_rgba(29,255,0,0.45)] hover:shadow-[0_0_0_1px_#1dff00,0_6px_24px_-4px_rgba(29,255,0,0.65)] transition-shadow"
              />
            </PromptInputToolbar>
            <div className="pt-1 text-[10px] tracking-wider text-neutral-500 flex justify-between font-mono opacity-70">
              <span>{editing ? 'Editing – submit to resend' : status === 'in_progress' ? 'Generating response...' : 'Idle'}</span>
              <span>{text.length}/2000</span>
            </div>
          </PromptInput>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;