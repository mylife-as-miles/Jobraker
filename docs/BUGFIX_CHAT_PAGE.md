Replaced `EventSource` with the standard `fetch` API and `ReadableStream` to handle the streaming response.
*   **POST Support**: The full conversation history is now correctly sent in the request body.
*   **Cancellation**: The "Stop" button correctly aborts the fetch request.
*   **Error Handling**: Network errors and stream errors are caught and displayed in the chat.

## Notes
*   **Fix**: Removed `sessions` from the dependency array of this `useEffect` so it only runs when `activeSessionId` changes.

6.  **Created Missing Edge Function**:
    *   Investigated the backend and discovered that the `ai-chat` Supabase Edge Function was completely missing from the project.
    *   **Fix**: Created `backend/supabase/functions/ai-chat/index.ts` with a standard OpenAI streaming implementation using `gpt-4o-mini`.

7.  **Fixed SSE Parser Bug**:
    *   The `currentEvent` variable was being reset to `'message'` inside the streaming loop. This meant that if an `event: ...` line and its corresponding `data: ...` line were split across different chunks, the parser would forget the event type and default to 'message'.
    *   **Fix**: Moved `let currentEvent = 'message';` outside the `while (true)` loop to persist the state across chunks.

### Code Snippet (New Implementation)

```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const fnUrl = `${supabaseUrl}/functions/v1/ai-chat`;
```
This fix removes the dependency on any `EventSource` polyfills and uses standard browser APIs compatible with Supabase Edge Functions streaming.

8.  **Missing .env File**:
    *   The backend was missing the `.env` file required to load the `OPENAI_API_KEY`.
    *   **Fix**: Created `backend/supabase/.env` with a placeholder for the API key. The user needs to populate this file.

## Deployment
Since a new Edge Function (`ai-chat`) was created, you must deploy it for the chat to work in production.

**For Local Development:**
1.  Ensure `backend/supabase/.env` exists and contains `OPENAI_API_KEY=your_key`.
2.  Restart your local Supabase instance:
```bash
npm run supabase:stop
npm run supabase:start
```

**For Production:**
1.  Set the `OPENAI_API_KEY` secret in your Supabase project:
```bash
npx supabase secrets set OPENAI_API_KEY=your_key
```
2.  Deploy the function:
```bash
cd backend/supabase
npx supabase functions deploy ai-chat
```
