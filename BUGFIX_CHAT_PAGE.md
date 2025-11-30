Replaced `EventSource` with the standard `fetch` API and `ReadableStream` to handle the streaming response.
*   **POST Support**: The full conversation history is now correctly sent in the request body.
*   **Cancellation**: The "Stop" button correctly aborts the fetch request.
*   **Error Handling**: Network errors and stream errors are caught and displayed in the chat.

## Notes
This fix removes the dependency on any `EventSource` polyfills and uses standard browser APIs compatible with Supabase Edge Functions streaming.
