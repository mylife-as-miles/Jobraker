import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuid } from 'uuid';
import type { ChatMessageRecord } from '../hooks/useChat';

export interface ChatSnippet {
  id: string;
  messageId: string;
  content: string;
  createdAt: number;
  tags: string[];
  title: string;
}

export interface ChatSessionMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  pinned: string[]; // message ids
}

interface ChatSessionsState {
  sessions: Record<string, ChatSessionMeta>;
  messages: Record<string, ChatMessageRecord[]>; // keyed by sessionId
  activeSessionId: string | null;
  snippets: ChatSnippet[];
  createSession: (title?: string) => string;
  renameSession: (id: string, title: string) => void;
  deleteSession: (id: string) => void;
  // soft rename already included; add explicit updater for pinned
  setActiveSession: (id: string) => void;
  addMessage: (sessionId: string, msg: ChatMessageRecord) => void;
  replaceMessages: (sessionId: string, msgs: ChatMessageRecord[]) => void;
  pinMessage: (sessionId: string, messageId: string) => void;
  unpinMessage: (sessionId: string, messageId: string) => void;
  saveSnippet: (messageId: string, content: string) => void;
  deleteSnippet: (id: string) => void;
  search: (sessionId: string, query: string) => { message: ChatMessageRecord; score: number }[];
}

const tokenize = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

export const useChatSessions = create<ChatSessionsState>()(persist((set, get) => ({
  sessions: {},
  messages: {},
  activeSessionId: null,
  snippets: [],
  createSession: (title = 'New Session') => {
    const id = uuid();
    const now = Date.now();
    set(s => ({
      sessions: { ...s.sessions, [id]: { id, title, createdAt: now, updatedAt: now, messageCount: 0, pinned: [] } },
      messages: { ...s.messages, [id]: [] },
      activeSessionId: id,
    }));
    return id;
  },
  renameSession: (id, title) => set(s => ({ sessions: { ...s.sessions, [id]: { ...s.sessions[id], title } }})),
  deleteSession: (id) => set(s => {
    const { [id]:_, ...rest } = s.sessions;
    const { [id]:__ , ...restMsgs } = s.messages;
    const activeSessionId = s.activeSessionId === id ? Object.keys(rest)[0] || null : s.activeSessionId;
    return { sessions: rest, messages: restMsgs, activeSessionId };
  }),
  setActiveSession: (id) => set({ activeSessionId: id }),
  addMessage: (sessionId, msg) => set(s => {
    const list = s.messages[sessionId] || [];
    const updatedSession = { ...s.sessions[sessionId], updatedAt: Date.now(), messageCount: list.length + 1 };
    return { messages: { ...s.messages, [sessionId]: [...list, msg] }, sessions: { ...s.sessions, [sessionId]: updatedSession } };
  }),
  replaceMessages: (sessionId, msgs) => set(s => ({
    messages: { ...s.messages, [sessionId]: msgs },
    sessions: { ...s.sessions, [sessionId]: { ...s.sessions[sessionId], updatedAt: Date.now(), messageCount: msgs.length } }
  })),
  pinMessage: (sessionId, messageId) => set(s => ({ sessions: { ...s.sessions, [sessionId]: { ...s.sessions[sessionId], pinned: Array.from(new Set([...(s.sessions[sessionId].pinned||[]), messageId])) }}})),
  unpinMessage: (sessionId, messageId) => set(s => ({ sessions: { ...s.sessions, [sessionId]: { ...s.sessions[sessionId], pinned: (s.sessions[sessionId].pinned||[]).filter(id => id !== messageId) }}})),
  saveSnippet: (messageId, content) => set(s => ({ snippets: [...s.snippets, { id: uuid(), messageId, content, createdAt: Date.now(), tags: [], title: content.slice(0, 48) + (content.length>48?'…':'') }] })),
  deleteSnippet: (id) => set(s => ({ snippets: s.snippets.filter(sn => sn.id !== id) })),
  search: (sessionId, query) => {
    const qTokens = tokenize(query);
    const msgs = get().messages[sessionId] || [];
    const scored = msgs.map(m => {
      const text = `${m.content}`.toLowerCase();
      let score = 0;
      for (const t of qTokens) if (text.includes(t)) score += 1;
      return { message: m, score };
    }).filter(r => r.score > 0);
    return scored.sort((a,b)=>b.score - a.score).slice(0, 50);
  }
}), { name: 'chat.sessions.v1' }));
