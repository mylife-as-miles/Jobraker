Replaced `EventSource` with the standard `fetch` API and `ReadableStream` to handle the streaming response.
*   **POST Support**: The full conversation history is now correctly sent in the request body.
*   **Cancellation**: The "Stop" button correctly aborts the fetch request.
*   **Error Handling**: Network errors and stream errors are caught and displayed in the chat.

## Notes
*   **Fix**: Removed `sessions` from the dependency array of this `useEffect` so it only runs when `activeSessionId` changes.

6.  **Created Missing Edge Function**:
    *   Investigated the backend and discovered that the `ai-chat` Supabase Edge Function was completely missing from the project.
    *   **Fix**: Created `supabase/functions/ai-chat/index.ts` with a standard OpenAI streaming implementation using `gpt-4o-mini`.

### Code Snippet (New Implementation)

```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const fnUrl = `${supabaseUrl}/functions/v1/ai-chat`;
```
This fix removes the dependency on any `EventSource` polyfills and uses standard browser APIs compatible with Supabase Edge Functions streaming.
