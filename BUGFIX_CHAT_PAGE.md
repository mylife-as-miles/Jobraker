# Bug Fix: Chat Page EventSource Error

## Issue
The `ChatPage.tsx` component was using the `EventSource` API to stream responses from the AI chat backend. However, it was attempting to use `EventSource` with a `POST` method and a JSON body:

```typescript
eventSourceRef.current = new EventSource(fnUrl, {
  method: 'POST',
  headers: { ... },
  body: JSON.stringify({ ... })
} as any);
```

**This is not supported by the standard `EventSource` API in browsers.**
Standard `EventSource` only supports `GET` requests and does not allow setting custom headers (except via cookies) or a request body. The `as any` cast was hiding the type error, but it would fail at runtime (ignoring the body/method or throwing an error).

## Fix
Replaced `EventSource` with the standard `fetch` API and `ReadableStream` to handle the streaming response.
*   **POST Support**: The full conversation history is now correctly sent in the request body.
*   **Cancellation**: The "Stop" button correctly aborts the fetch request.
*   **Error Handling**: Network errors and stream errors are caught and displayed in the chat.

## Notes
This fix removes the dependency on any `EventSource` polyfills and uses standard browser APIs compatible with Supabase Edge Functions streaming.
