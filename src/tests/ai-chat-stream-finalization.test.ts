import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientSource = readFileSync(
  resolve(process.cwd(), "src/screens/Dashboard/pages/ChatPage.tsx"),
  "utf8",
);
const serverSource = readFileSync(
  resolve(process.cwd(), "backend/supabase/functions/ai-chat/index.ts"),
  "utf8",
);

describe("AI chat stream finalization", () => {
  it("treats an SSE error as terminal in the client", () => {
    expect(clientSource).toMatch(
      /currentEvent === "error"[\s\S]*?await waitForAgentProgressPaint\(\);\s*return true;/,
    );
  });

  it("sends a done frame after an SSE error on the server", () => {
    expect(serverSource).toMatch(
      /await enqueueEvent\("error", \{ error: userMessage \}\);\s*await enqueueEvent\("done", "\[DONE\]"\);\s*controller\.close\(\);/,
    );
  });
});
