// Clean AI-elements only Chat Page implementation
import { useState, useCallback } from 'react';
// Temporary lightweight chat hook placeholder (remove when real ai/react is available)
interface BasicMessage { id: string; role: 'user' | 'assistant'; content: string; parts?: { type: 'text'; text: string }[]; streaming?: boolean; createdAt: number }
interface UseChatReturn { messages: BasicMessage[]; status: 'idle' | 'in_progress'; append: (m: { role: 'user'; content: string }) => void }
const useChat = (_opts: { api: string }): UseChatReturn => {
  const [messages, setMessages] = useState<BasicMessage[]>([]);
  const [status, setStatus] = useState<'idle' | 'in_progress'>('idle');

  const streamAssistant = (assistantId: string, tokens: string[], i: number) => {
    setMessages(prev => prev.map(msg => msg.id === assistantId
      ? { ...msg, parts: [{ type: 'text', text: tokens.slice(0, i + 1).join(' ') }], streaming: i + 1 < tokens.length }
      : msg));
    if (i + 1 < tokens.length) {
      setTimeout(() => streamAssistant(assistantId, tokens, i + 1), 40 + Math.random()*60);
    } else {
      setStatus('idle');
    }
  };

  const append = (m: { role: 'user'; content: string }) => {
    const userId = Math.random().toString(36).slice(2);
  setMessages(prev => [...prev, { id: userId, role: m.role, content: m.content, createdAt: Date.now(), parts: [{ type: 'text', text: m.content }] }]);
    // Simulated streaming assistant reply
    setStatus('in_progress');
    const assistantId = Math.random().toString(36).slice(2);
    const reply = `You said: "${m.content}". This is a simulated streaming response demonstrating incremental token updates.`;
    const tokens = reply.split(/\s+/);
  setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: reply, createdAt: Date.now(), parts: [{ type: 'text', text: '' }], streaming: true }]);
    // start token streaming
    setTimeout(() => streamAssistant(assistantId, tokens, 0), 120);
  };
  return { messages, status, append };
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
import { Message, MessageContent } from '@/components/ai-elements/message';
import { Response } from '@/components/ai-elements/response';


const models = [
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'claude-opus-4-20250514', name: 'Claude 4 Opus' },
];

export const ChatPage = () => {
  const [text, setText] = useState('');
  const [model, setModel] = useState(models[0].id);
  const [useMicrophone, setUseMicrophone] = useState(false);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const { messages, status, append } = useChat({ api: '/api/chat' });

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = !!message.text?.trim();
    const hasFiles = !!message.files?.length;
    if (!hasText && !hasFiles) return;
    append({ role: 'user', content: message.text || 'Sent with attachments' });
    setText('');
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col p-6">
      <div className="flex-1 min-h-0 flex flex-col rounded-xl border bg-neutral-950/70 backdrop-blur">
        <Conversation className="flex-1">
          <ConversationContent>
            {messages.map((m: BasicMessage) => (
              <Message key={m.id} from={m.role}>
                <MessageContent>
                  {Array.isArray(m.parts)
                    ? m.parts.map((p: { type: 'text'; text: string }, i: number) => p.type === 'text' ? (
                        <Response key={i}>{`${p.text}${m.streaming && i === m.parts!.length - 1 ? ' ▌' : ''}`}</Response>
                      ) : null)
                    : m.content}
                </MessageContent>
              </Message>
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        <div className="border-t bg-neutral-900/60">
          <PromptInput onSubmit={handleSubmit} className="p-2" multiple globalDrop>
            <PromptInputBody>
              <PromptInputAttachments>
                {(file) => <PromptInputAttachment data={file} />}
              </PromptInputAttachments>
              <PromptInputTextarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ask something..."
              />
            </PromptInputBody>
            <PromptInputToolbar>
              <PromptInputTools>
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments />
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>
                <PromptInputButton
                  onClick={() => setUseMicrophone((v) => !v)}
                  variant={useMicrophone ? 'default' : 'ghost'}
                >
                  <MicIcon size={16} />
                  <span className="sr-only">Microphone</span>
                </PromptInputButton>
                <PromptInputButton
                  onClick={() => setUseWebSearch((v) => !v)}
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
                    {models.map((m) => (
                      <PromptInputModelSelectItem key={m.id} value={m.id}>
                        {m.name}
                      </PromptInputModelSelectItem>
                    ))}
                  </PromptInputModelSelectContent>
                </PromptInputModelSelect>
              </PromptInputTools>
              <PromptInputSubmit
                disabled={!text && status !== 'in_progress'}
                status={status === 'in_progress' ? 'in_progress' : undefined as any}
              />
            </PromptInputToolbar>
          </PromptInput>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;