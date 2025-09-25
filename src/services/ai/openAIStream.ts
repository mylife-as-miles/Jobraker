import { useOpenAiStore } from '../../client/stores/openai';
import { buildContext } from './buildContext';
import type { ChatMessageRecord } from '../../hooks/useChat';

// Streaming handler using OpenAI's /v1/chat/completions with fetch.
// NOTE: This expects the user's API key to be stored locally (never sent to our server).

export async function* openAIStream(history: ChatMessageRecord[], userPrompt: string): AsyncGenerator<string, void, unknown> {
  const { apiKey, model, baseURL } = useOpenAiStore.getState();
  if (!apiKey) {
    yield '[OpenAI API key missing – set it in settings]';
    return;
  }
  const ctx = await buildContext();

  const system = `You are JobRaker AI. Provide precise, structured career guidance. Current data summary: ${ctx.summary}`;
  const messages = [
    { role: 'system', content: system },
    ...history.slice(-12).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userPrompt }
  ];

  const body = {
    model: model || 'gpt-4o-mini',
    stream: true,
    temperature: 0.4,
    messages,
  } as any;

  const endpoint = (baseURL || 'https://api.openai.com/v1') + '/chat/completions';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    yield `[OpenAI error: ${res.status} ${res.statusText}]`;
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (line === 'data: [DONE]') {
        return;
      }
      if (line.startsWith('data: ')) {
        try {
          const json = JSON.parse(line.slice(6));
          const token = json.choices?.[0]?.delta?.content;
          if (token) yield token;
        } catch (_) {}
      }
    }
    buffer = lines[lines.length - 1];
  }
}
