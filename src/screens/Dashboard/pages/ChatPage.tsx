import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { Send, Paperclip, Smile, MoreVertical, X, StopCircle, Trash2, History, Loader2, Copy, Check, Sparkles, Edit3, BookmarkPlus, Pin, ChevronLeft, ChevronRight } from 'lucide-react';
import { useChat } from '../../../hooks/useChat';
import { TypingIndicator } from '../../../components/chat/TypingIndicator';
import { ScrollToBottom } from '../../../components/chat/ScrollToBottom';
import clsx from 'clsx';

// Skeleton shimmer for streaming tokens
const StreamingCursor = () => (
  <motion.span
    className="inline-block w-2 h-4 bg-[#1dff00] rounded-sm ml-1 align-middle"
    animate={{ opacity: [0, 1, 0] }}
    transition={{ duration: 1.2, repeat: Infinity }}
  />
);

const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

interface MessageBubbleProps {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  streaming?: boolean;
  attachments?: { id: string; name: string; size: number; type: string; url?: string }[];
  error?: string;
}

const MessageBubble = ({ role, content, createdAt, streaming, attachments, error }: MessageBubbleProps) => {
  const isUser = role === 'user';
  const isAssistant = role === 'assistant';
  const isSystem = role === 'system';
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(content).then(()=>{
      setCopied(true);
      setTimeout(()=>setCopied(false), 1500);
    }).catch(()=>{});
  }, [content]);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      className={clsx('flex', isUser ? 'justify-end' : 'justify-start')}
    >
      <div className={clsx('max-w-[92%] sm:max-w-2xl group relative')}>        
        <div
          className={clsx(
            'rounded-2xl px-4 py-3 shadow-md border backdrop-blur-sm transition-all duration-300',
            'prose prose-invert prose-sm marker:text-[#1dff00] prose-p:my-2',
            isUser && 'bg-gradient-to-br from-[#1dff00] to-[#0a8246] text-black border-[#1dff00]/40',
            isAssistant && 'bg-gradient-to-br from-[#101010] to-[#060606] text-neutral-200 border-[#1dff00]/20',
            isSystem && 'bg-[#111111]/80 text-neutral-400 border-[#1dff00]/10'
          )}
        >
          {error && (
            <div className="text-red-400 text-xs mb-2 font-medium flex items-center gap-1">
              <X className="w-3 h-3" /> {error}
            </div>
          )}
          <div className="relative whitespace-pre-wrap leading-relaxed font-medium tracking-wide text-[13px] sm:text-[14px]">
            {content || (streaming ? '...' : '')}
            {streaming && <StreamingCursor />}
          </div>
          {!!attachments?.length && (
            <div className="mt-3 flex flex-wrap gap-2">
              {attachments.map(a => (
                <div key={a.id} className="text-[10px] sm:text-xs px-2 py-1 rounded-md bg-black/20 border border-[#1dff00]/20 text-[#1dff00] font-mono">{a.name}</div>
              ))}
            </div>
          )}
          <div className="text-[10px] tracking-wider uppercase mt-2 opacity-60 font-semibold flex items-center gap-2">
            {isSystem ? 'SYSTEM' : isUser ? 'YOU' : 'ASSISTANT'} • {formatTime(createdAt)}
            {isAssistant && (
              <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1 ml-auto">
                <button onClick={copy} className="p-1.5 rounded-md bg-black/20 hover:bg-black/40 border border-[#1dff00]/20 text-[#1dff00] transition" aria-label="Copy message">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
                <button className="p-1.5 rounded-md bg-black/20 hover:bg-black/40 border border-[#1dff00]/20 text-[#1dff00] transition" aria-label="Refine"><Edit3 className="w-3 h-3" /></button>
                <button className="p-1.5 rounded-md bg-black/20 hover:bg-black/40 border border-[#1dff00]/20 text-[#1dff00] transition" aria-label="Save snippet"><BookmarkPlus className="w-3 h-3" /></button>
                <button className="p-1.5 rounded-md bg-black/20 hover:bg-black/40 border border-[#1dff00]/20 text-[#1dff00] transition" aria-label="Pin"><Pin className="w-3 h-3" /></button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const ChatPage = (): JSX.Element => {
  const { messages, input, setInput, send, stop, clear, isSending, attachFiles, removeAttachment, pendingAttachments } = useChat();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showSessions, setShowSessions] = useState(true);
  const [composerRows, setComposerRows] = useState(1);

  const toggleSessions = useCallback(()=> setShowSessions(s => !s), []);

  // Auto scroll on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  // (single-line input handler removed; textarea handles Enter logic)

  const quickPrompts = useMemo(() => [
    'Summarize my recent application activity',
    'Suggest 3 tailored resume bullet improvements',
    'Generate a concise cover letter opening for a senior frontend role',
    'List likely interview questions for a React + TypeScript position',
    'Help me negotiate an offer with a competing opportunity'
  ], []);

  return (
    <div className="relative h-full flex flex-col bg-black min-h-[100dvh] overflow-hidden">
      {/* Ambient animated gradient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/3 -left-1/3 w-[70vw] h-[70vw] bg-[#1dff00]/10 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute top-1/4 -right-1/4 w-[55vw] h-[55vw] bg-[#0a8246]/20 rounded-full blur-[160px] animate-[pulse_9s_ease-in-out_infinite]" />
      </div>
      <div className="flex-1 flex flex-row w-full max-w-7xl mx-auto relative z-10">
        {/* Sessions Sidebar (placeholder for future) */}
        <motion.aside
          initial={false}
          animate={{ width: showSessions ? 240 : 0, opacity: showSessions ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          className="hidden md:flex flex-col border-r border-[#1dff00]/15 bg-[#050805]/60 backdrop-blur-xl overflow-hidden"
        >
          <div className="px-4 pt-4 pb-3 border-b border-[#1dff00]/10 flex items-center justify-between">
            <h3 className="text-xs font-semibold tracking-wider text-[#1dff00] flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> SESSIONS</h3>
            <button onClick={toggleSessions} className="p-1.5 rounded-md hover:bg-[#1dff00]/10 text-neutral-400 hover:text-[#1dff00] transition" aria-label="Collapse sidebar"><ChevronLeft className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <button key={i} className="w-full group flex flex-col items-start gap-1 px-3 py-2 rounded-lg border border-transparent hover:border-[#1dff00]/30 bg-[#0c0c0c]/40 hover:bg-[#0f1f0f]/60 transition text-left">
                <span className="text-[11px] font-medium text-neutral-200 truncate w-full">Session {i + 1}</span>
                <span className="text-[10px] text-neutral-500 group-hover:text-neutral-400">0 msgs • draft</span>
              </button>
            ))}
          </div>
          <div className="p-3 border-t border-[#1dff00]/10">
            <button className="w-full text-[11px] font-semibold tracking-wide px-3 py-2 rounded-md bg-gradient-to-r from-[#1dff00] to-[#0a8246] text-black shadow ring-1 ring-[#1dff00]/40 hover:shadow-lg hover:shadow-[#1dff00]/30 transition">New Session</button>
          </div>
        </motion.aside>
        {/* Main column */}
        <div className="flex-1 flex flex-col w-full">
        {/* Header */}
        <div className="bg-[#060606]/80 backdrop-blur-md border-b border-[#1dff00]/20 px-4 sm:px-6 py-3 sticky top-0 z-10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <motion.div whileHover={{ rotate: 8, scale:1.05 }} className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#1dff00] via-[#15b34f] to-[#04542a] flex items-center justify-center shadow-lg shadow-[#1dff00]/20 ring-1 ring-[#1dff00]/40">
                <span className="text-black font-extrabold tracking-tight text-lg">AI</span>
              </motion.div>
              <div>
                <h2 className="text-white font-semibold text-base sm:text-lg flex items-center gap-2">JobRaker Copilot <span className="relative inline-flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1dff00] opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-[#1dff00]" /></span></h2>
                <p className="text-[11px] sm:text-xs text-neutral-400 -mt-0.5">Context aware job search & career optimization assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={toggleSessions} className="w-9 h-9 p-0 text-neutral-400 hover:text-[#1dff00] hover:bg-[#1dff00]/10 hidden md:inline-flex">{showSessions ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</Button>
              <Button variant="ghost" size="sm" onClick={clear} className="w-9 h-9 p-0 text-neutral-400 hover:text-[#1dff00] hover:bg-[#1dff00]/10"><History className="w-4 h-4" /></Button>
              <Button variant="ghost" size="sm" onClick={stop} disabled={!messages.some(m=>m.streaming)} className="w-9 h-9 p-0 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 disabled:opacity-30"><StopCircle className="w-4 h-4" /></Button>
              <Button variant="ghost" size="sm" className="w-9 h-9 p-0 text-neutral-400 hover:text-[#1dff00] hover:bg-[#1dff00]/10"><MoreVertical className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
        {/* Messages */}
        <div ref={scrollRef} className="relative flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-6 space-y-4 bg-gradient-to-b from-black via-[#020602] to-black">
          <LayoutGroup>
            <AnimatePresence initial={false}>
              {messages.filter(m => m.role !== 'system').map(m => (
                <MessageBubble key={m.id} {...m} />
              ))}
            </AnimatePresence>
          </LayoutGroup>
          {isSending && (
            <div className="pl-2 pt-2">
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#101010]/80 border border-[#1dff00]/20">
                <span className="text-[11px] font-medium tracking-wide text-neutral-400">Thinking</span>
                <TypingIndicator />
              </div>
            </div>
          )}
          <ScrollToBottom target={scrollRef} />
        </div>
        {/* Composer */}
        <div className="sticky bottom-0 bg-[#060606]/90 backdrop-blur-xl border-t border-[#1dff00]/20 px-4 sm:px-6 pt-4 pb-5 space-y-3">
          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pendingAttachments.map(a => (
                <motion.div layout key={a.id} className="group flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg bg-[#101010] border border-[#1dff00]/30 text-[#1dff00] text-xs">
                  <span className="max-w-[140px] truncate font-mono">{a.name}</span>
                  <button onClick={() => removeAttachment(a.id)} className="p-1 rounded-md hover:bg-[#1dff00]/10 text-neutral-400 hover:text-white transition"><X className="w-3 h-3" /></button>
                </motion.div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-2 flex-1">
              <div className="relative group">
                <textarea
                  value={input}
                  onChange={e=>{setInput(e.target.value); const lines = e.target.value.split(/\n/).length; setComposerRows(Math.min(8, Math.max(1, lines)));}}
                  onKeyDown={(e)=>{
                    if(e.key==='Enter' && !e.shiftKey){
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={composerRows}
                  placeholder="Ask anything about your applications, resumes, interviews... (Shift+Enter for newline)"
                  className="resize-none w-full peer bg-[#0d0d0d]/90 border-[#1dff00]/30 focus:border-[#1dff00] focus:ring-0 text-white placeholder:text-neutral-500 rounded-2xl py-3 pr-28 pl-4 text-sm shadow-inner shadow-black/40 leading-relaxed"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={()=>fileInputRef.current?.click()} className="w-9 h-9 p-0 text-neutral-400 hover:text-[#1dff00] hover:bg-[#1dff00]/10"><Paperclip className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" className="w-9 h-9 p-0 text-neutral-400 hover:text-[#1dff00] hover:bg-[#1dff00]/10"><Smile className="w-4 h-4" /></Button>
                  <Button disabled={!input.trim()} onClick={send} size="sm" className="w-9 h-9 p-0 bg-gradient-to-br from-[#1dff00] to-[#0a8246] text-black hover:shadow-lg hover:shadow-[#1dff00]/30 hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed transition"><Send className="w-4 h-4" /></Button>
                </div>
                <input ref={fileInputRef} type="file" multiple hidden onChange={e=>attachFiles(e.target.files)} />
                <div className="absolute -bottom-5 left-2 text-[10px] font-mono tracking-wider text-neutral-500 opacity-70">Enter ↵ to send • Shift+Enter for newline</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map(p => (
                  <motion.button
                    key={p}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={()=>setInput(p)}
                    className="px-3 py-1.5 rounded-full bg-[#101410] text-[#78ff6e] border border-[#1dff00]/30 hover:bg-[#122b12] hover:text-[#1dff00] text-[11px] font-medium tracking-wide transition"
                  >{p}</motion.button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="outline" size="sm" onClick={clear} className="border-[#1dff00]/40 text-neutral-300 hover:text-white hover:border-[#1dff00] bg-[#0d0d0d]">Reset</Button>
              <Button variant="outline" size="sm" disabled className="border-[#1dff00]/10 text-neutral-600 bg-[#0d0d0d] cursor-not-allowed">Memory</Button>
              <Button variant="outline" size="sm" disabled className="border-[#1dff00]/10 text-neutral-600 bg-[#0d0d0d] cursor-not-allowed">Context</Button>
            </div>
          </div>
          <div className="flex justify-between text-[10px] text-neutral-500 font-mono tracking-wider pt-1">
            <div>{isSending ? 'Thinking...' : 'Idle'}</div>
            <div>{messages.filter(m=>m.role==='user').length} messages • {new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
          </div>
        </div>
        </div>
      </div>
      {/* Floating Clear (mobile) */}
      <motion.button
        onClick={clear}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        className="md:hidden fixed bottom-5 right-5 z-50 p-3 rounded-xl bg-[#101010] border border-[#1dff00]/30 text-[#1dff00] shadow-lg shadow-[#1dff00]/10 backdrop-blur-md"
      >
        <Trash2 className="w-5 h-5" />
      </motion.button>
      {isSending && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed bottom-24 right-5 md:right-8 z-40 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0d0d0d]/90 border border-[#1dff00]/30 text-[#1dff00] text-xs shadow-lg">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating
        </motion.div>
      )}
    </div>
  );
};