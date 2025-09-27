# ai-chat Supabase Edge Function

Streaming chat completion proxy for OpenAI-compatible and Perplexity models.

## Endpoint
`POST /functions/v1/ai-chat`

## Request Body
```jsonc
{
  "model": "openai/gpt-4o-mini", // optional, defaults to openai/gpt-4o-mini
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "webSearch": false,             // if true forces perplexity/sonar
  "system": "Optional system message override" // optional
}
```
`messages` may also include `parts: [{ text: string }]` instead of `content`.

## Response (SSE)
Text/event-stream with events:
- `message` → `{ "delta": "partial text" }`
- `done`    → `{}` when complete
- `error`   → `{ "error": "message" }` on upstream failure

## Environment Variables
Set in Supabase project:
- `OPENAI_API_KEY` (required unless only using Perplexity)
- `PERPLEXITY_API_KEY` (required if using perplexity/sonar)

## Example curl
```bash
curl -N \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -d '{"messages":[{"role":"user","content":"Explain embeddings briefly"}]}' \
  https://<PROJECT_REF>.functions.supabase.co/ai-chat
```

## Frontend Consumption Example
```ts
async function streamChat(payload) {
  const res = await fetch(`${SUPABASE_FUNCTION_URL}/ai-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.body) throw new Error('No stream');
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += dec.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const chunk of parts) {
      const lines = chunk.split('\n');
      let event = 'message';
      let dataLine = '';
      for (const l of lines) {
        if (l.startsWith('event:')) event = l.slice(6).trim();
        else if (l.startsWith('data:')) dataLine += l.slice(5).trim();
      }
      if (dataLine) {
        const json = JSON.parse(dataLine);
        if (event === 'message') {
          // append json.delta
        } else if (event === 'done') {
          // finalize
        }
      }
    }
  }
}
```

## Notes
- Aborts automatically after 30s.
- Adds minimal provider-specific params; extend as needed.
- You can add auth by verifying Supabase JWT from `authorization` header.
