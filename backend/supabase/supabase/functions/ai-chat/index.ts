// @ts-nocheck
/**
 * Supabase Edge Function: ai-chat
 * Streaming chat completion proxy supporting OpenAI (default) and Perplexity (when webSearch or model prefixed with "perplexity/").
 *
 * Request (POST JSON):
 * {
 *   model?: string;             // e.g. "openai/gpt-4o-mini" (default) or "perplexity/sonar"
 *   messages: UIMessage[];      // { id: string; role: 'user'|'assistant'|'system'; content?: string; parts?: { text?: string }[] }
 *   webSearch?: boolean;        // if true forces perplexity/sonar (if PERPLEXITY_API_KEY set)
 *   system?: string;            // optional system override
 * }
 *
 * Response: Server Sent Events (text/event-stream) with lines:
 *   event: message  data: { "delta": "..." }
 *   event: done     data: { "usage": { ... } }
 *   event: error    data: { "error": "..." }
 *
 * CORS enabled (allow *). Max duration ~30s enforced with AbortController.
 */

import { getCorsHeaders } from "../_shared/types.ts";

interface UIMessagePart { text?: string }
interface UIMessage { id?: string; role: string; content?: string; parts?: UIMessagePart[] }
interface ChatBody { model?: string; messages: UIMessage[]; webSearch?: boolean; system?: string; previous_response_id?: string }

const FALLBACK_MODEL = 'openai/gpt-4o-mini';
const OPENAI_BASE = 'https://api.openai.com/v1/responses';
const PERPLEXITY_BASE = 'https://api.perplexity.ai/chat/completions';
const MAX_DURATION_MS = 30_000; // 30s

/** Convert UIMessage[] → provider chat messages */
function toProviderMessages(msgs: UIMessage[], systemOverride?: string) {
  const out: any[] = [];
  if (systemOverride) out.push({ role: 'system', content: systemOverride });
  for (const m of msgs) {
    const role = m.role === 'assistant' || m.role === 'system' || m.role === 'user' ? m.role : 'user';
    const text = (m.parts?.map(p => p.text).filter(Boolean).join('\n') || m.content || '').trim();
    if (!text) continue;
    out.push({ role, content: text });
  }
  return out;
}

function sseEncode(obj: any) {
  return `event: message\ndata: ${JSON.stringify(obj)}\n\n`;
}

function sseEvent(event: string, payload: any) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'content-type': 'application/json' } });
  }

  let body: ChatBody | null = null;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } });
  }
  if (!body || !Array.isArray(body.messages)) {
    return new Response(JSON.stringify({ error: 'messages array required' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } });
  }

  // Determine provider & model
  const forcedPerplexity = body.webSearch === true;
  let model = body.model || FALLBACK_MODEL;
  if (forcedPerplexity) model = 'perplexity/sonar';

  const isPerplexity = model.startsWith('perplexity/');
  const isOpenAI = model.startsWith('openai/') || !isPerplexity;

  // Strip provider prefix for underlying API call
  const providerModel = model.replace(/^openai\//, '').replace(/^perplexity\//, '');

  const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';
  const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY') || '';

  if (isOpenAI && !openaiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } });
  }
  if (isPerplexity && !perplexityKey) {
    return new Response(JSON.stringify({ error: 'PERPLEXITY_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } });
  }

  const providerMessages = toProviderMessages(body.messages, body.system);
  if (!providerMessages.length) {
    return new Response(JSON.stringify({ error: 'No non-empty messages supplied' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('timeout'), MAX_DURATION_MS);

  const stream = new ReadableStream({
    async start(controllerStream) {
      try {
        const url = isPerplexity ? PERPLEXITY_BASE : OPENAI_BASE;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: isPerplexity ? `Bearer ${perplexityKey}` : `Bearer ${openaiKey}`,
        };

        const payload: any = {
          model: providerModel,
          stream: true,
        };

        if (isOpenAI) {
          payload.store = true;
          payload.temperature = 0.7;

          if (body.previous_response_id) {
            payload.previous_response_id = body.previous_response_id;
            const lastMessage = body.messages.at(-1);
            payload.input = lastMessage ? (lastMessage.parts?.map(p => p.text).filter(Boolean).join('\n') || lastMessage.content || '').trim() : '';
          } else {
            // First turn of a conversation
            payload.input = toProviderMessages(body.messages); // just messages, no system prompt
            if (body.system) {
              payload.instructions = body.system;
            }
          }
        } else { // isPerplexity
          payload.messages = providerMessages; // this one includes the system prompt
          payload.temperature = 0.7;
        }

        const resp = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!resp.ok || !resp.body) {
          const text = await resp.text().catch(() => resp.statusText);
            controllerStream.enqueue(new TextEncoder().encode(sseEvent('error', { error: `Upstream error ${resp.status}: ${text}` })));
            controllerStream.enqueue(new TextEncoder().encode(sseEvent('done', {})));
            controllerStream.close();
            return;
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = '';
        let responseId: string | null = null;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split(/\n/);
          buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;

              if (trimmed.startsWith('event:')) continue; // Handled by data parsing below

              if (trimmed.startsWith('data:')) {
                const data = trimmed.substring(5).trim();
                if (data === '[DONE]') {
                  controllerStream.enqueue(encoder.encode(sseEvent('done', {})));
                  controllerStream.close();
                  clearTimeout(timeout);
                  return;
                }
                try {
                  const parsed = JSON.parse(data);

                  if (isOpenAI) {
                    // Responses API stream parsing
                    if (parsed.id && parsed.object === 'response' && !responseId) {
                        responseId = parsed.id;
                        controllerStream.enqueue(encoder.encode(sseEvent('response_id', { response_id: responseId })));
                    }
                    if (parsed.type === 'message_delta' && parsed.delta?.text) {
                        controllerStream.enqueue(encoder.encode(sseEncode({ delta: parsed.delta.text })));
                    }
                  } else { // isPerplexity (or old OpenAI)
                      const delta = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || '';
                      if (delta) {
                        controllerStream.enqueue(encoder.encode(sseEncode({ delta })));
                      }
                  }
                } catch {
                  // JSON parse error is expected for some lines, ignore.
                }
              }
            }
        }

        // Flush remainder if any
        if (buffer) {
          try {
            const parsed = JSON.parse(buffer.replace(/^data:\s*/, ''));
            const delta = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || '';
            if (delta) controllerStream.enqueue(new TextEncoder().encode(sseEncode({ delta })));
          } catch {}
        }

        controllerStream.enqueue(encoder.encode(sseEvent('done', {})));
        controllerStream.close();
        clearTimeout(timeout);
      } catch (e) {
        const msg = (e && e.message) ? String(e.message) : 'stream error';
        try { controllerStream.enqueue(new TextEncoder().encode(sseEvent('error', { error: msg }))); } catch {}
        try { controllerStream.enqueue(new TextEncoder().encode(sseEvent('done', {}))); } catch {}
        controllerStream.close();
        clearTimeout(timeout);
      }
    },
    cancel() {
      clearTimeout(timeout);
      try { controller.abort(); } catch {}
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // for nginx proxies
    }
  });
});
