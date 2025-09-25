import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';

export interface AttachmentMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string; // object URL for preview
}

export interface ChatMessageRecord {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  streaming?: boolean;
  attachments?: AttachmentMeta[];
  error?: string;
}

interface UseChatOptions {
  /** localStorage key for persistence */
  storageKey?: string;
  /** Simulate latency (ms) */
  simulateLatency?: [min: number, max: number];
  /** Enable token streaming simulation */
  stream?: boolean;
  /** System prompt baseline */
  systemPrompt?: string;
  /** Optional override to load existing messages (session) */
  initialMessages?: ChatMessageRecord[];
  /** Callback when a new message is appended */
  onMessage?: (msg: ChatMessageRecord) => void;
  /** Real OpenAI handler (returns async iterator of string tokens) */
  openAIStreamHandler?: (history: ChatMessageRecord[], userPrompt: string) => AsyncIterable<string> | Promise<string>;
}

const DEFAULT_SYSTEM_PROMPT = 'You are JobRaker AI, a concise recruiting copilot. Provide actionable, structured guidance for job seekers. Use bullet lists when helpful. Keep tone professional-warm.';

export const useChat = (opts: UseChatOptions = {}) => {
  const {
    storageKey = 'jobraker.chat.v1',
    simulateLatency = [400, 1200],
    stream = true,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    initialMessages,
    onMessage,
    openAIStreamHandler,
  } = opts;

  const [messages, setMessages] = useState<ChatMessageRecord[]>(() => {
    if (initialMessages && initialMessages.length) return initialMessages;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return [
      { id: uuid(), role: 'system', content: systemPrompt, createdAt: Date.now() },
      { id: uuid(), role: 'assistant', content: 'Hi! I\'m your JobRaker assistant. Ask me anything about your applications, resumes, interviews, or job search strategy.', createdAt: Date.now() },
    ];
  });
  const [input, setInput] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentMeta[]>([]);
  const [isSending, setIsSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // persist
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(messages)); } catch (_) {}
  }, [messages, storageKey]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([
      {
        id: uuid(),
        role: 'system',
        content: systemPrompt,
        createdAt: Date.now(),
      },
      {
        id: uuid(),
        role: 'assistant',
        content: 'History cleared. How can I help now?',
        createdAt: Date.now(),
      },
    ]);
  }, [systemPrompt]);

  const attachFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const next: AttachmentMeta[] = [];
    for (const file of Array.from(files)) {
      next.push({ id: uuid(), name: file.name, size: file.size, type: file.type, url: URL.createObjectURL(file) });
    }
    setPendingAttachments(prev => [...prev, ...next]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setPendingAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const simulateAssistantResponse = useCallback(async (userText: string) => {
    const controller = new AbortController();
    abortRef.current = controller;

    const baseId = uuid();
    const seed = `Analyzing your request...\n\n${userText.length > 160 ? 'Here\'s a structured summary:' : 'Key points:'}`;
    const tokens = [
      seed,
      '\n\nActionable steps:',
      '\n1. ',
      'Review the targeted job description and extract required core competencies.',
      '\n2. ',
      'Map your existing resume bullet points to those competencies; highlight quantified impact.',
      '\n3. ',
      'Identify gaps (skills / tools) and plan micro-learning sprints (7-10 days each).',
      '\n4. ',
      'Optimize one ATS-friendly resume variant per role cluster.',
      '\n\nLet me know if you want a tailored resume bullet rewrite or interview prep next.'
    ];

    if (openAIStreamHandler) {
      // Real backend integration path
      try {
        const history = messages.filter(m => m.role !== 'system');
        const iterator = await openAIStreamHandler(history, userText);
        if (typeof (iterator as any) === 'string') {
          setMessages(m => m.map(msg => msg.id === baseId ? { ...msg, content: iterator as string, streaming: false } : msg));
          return;
        }
        // streaming tokens
        for await (const token of iterator as AsyncIterable<string>) {
          if (controller.signal.aborted) break;
          setMessages(m => m.map(msg => msg.id === baseId ? { ...msg, content: (msg.content || '') + token, streaming: true } : msg));
        }
        setMessages(m => m.map(msg => msg.id === baseId ? { ...msg, streaming: false } : msg));
        return;
      } catch (e: any) {
        setMessages(m => m.map(msg => msg.id === baseId ? { ...msg, streaming: false, error: e?.message || 'OpenAI failed' } : msg));
        return;
      }
    }

    if (!stream) {
      await new Promise(r => setTimeout(r, 600));
      setMessages(m => m.map(msg => msg.id === baseId ? { ...msg, content: tokens.join(''), streaming: false } : msg));
      onMessage?.({ id: baseId, role: 'assistant', content: tokens.join(''), createdAt: Date.now() });
      return;
    }

    for (let i = 0; i < tokens.length; i++) {
      if (controller.signal.aborted) break;
      setMessages(m => m.map(msg => msg.id === baseId ? { ...msg, content: (msg.content || '') + tokens[i], streaming: i < tokens.length - 1 } : msg));
      const delay = 40 + Math.random() * 120;
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, delay));
    }
    onMessage?.({ id: baseId, role: 'assistant', content: tokens.join(''), createdAt: Date.now() });
  }, [stream]);

  const parseSlash = (text: string): string => {
    if (!text.startsWith('/')) return text;
    const [cmd, ...rest] = text.slice(1).split(/\s+/);
    switch (cmd.toLowerCase()) {
      case 'help':
        return 'Provide a concise help menu of available slash commands.';
      case 'resume':
        return `Analyze my resume and suggest 5 high-impact improvements. Raw text: ${rest.join(' ') || '(resume omitted)'}`;
      case 'jobs':
        return 'Summarize recent job postings I added and highlight patterns.';
      case 'applications':
        return 'Evaluate the status distribution of my applications and suggest next steps.';
      case 'interview':
        return 'Generate a mock interview question set based on my target roles.';
      default:
        return rest.join(' ') || 'Interpret this custom command contextually.';
    }
  };

  const send = useCallback(async () => {
    if (!input.trim() || isSending) return;
    const userMessage: ChatMessageRecord = {
      id: uuid(),
      role: 'user',
      content: input.trim(),
      createdAt: Date.now(),
      attachments: pendingAttachments.length ? pendingAttachments : undefined,
    };
    onMessage?.(userMessage);
    setMessages(m => [...m, userMessage, { id: uuid(), role: 'assistant', content: '', createdAt: Date.now(), streaming: true }]);
    setInput('');
    setPendingAttachments([]);
    setIsSending(true);

    // Simulate network latency
    const [min, max] = simulateLatency;
    const latency = min + Math.random() * (max - min);
    await new Promise(r => setTimeout(r, latency));
    try {
      const finalPrompt = parseSlash(userMessage.content);
      await simulateAssistantResponse(finalPrompt);
    } catch (e: any) {
      setMessages(m => m.map(msg => msg.streaming ? { ...msg, streaming: false, error: e?.message || 'Failed' } : msg));
    } finally {
      setIsSending(false);
    }
  }, [input, isSending, pendingAttachments, simulateAssistantResponse, simulateLatency]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setMessages(m => m.map(msg => msg.streaming ? { ...msg, streaming: false } : msg));
  }, []);

  return {
    messages,
    input,
    setInput,
    send,
    stop,
    clear,
    isSending,
    attachFiles,
    removeAttachment,
    pendingAttachments,
  };
};
