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
const footerSource = readFileSync(
  resolve(process.cwd(), "src/components/chat/StreamedAnswerFooter.tsx"),
  "utf8",
);
const rtrvrToolsSource = readFileSync(
  resolve(process.cwd(), "backend/supabase/functions/rtrvr-tools/index.ts"),
  "utf8",
);
const rtrvrMeteringSource = readFileSync(
  resolve(
    process.cwd(),
    "backend/supabase/functions/_shared/metered-provider-credits.ts",
  ),
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

  it("streams AI-generated follow-up questions without exposing their envelope", () => {
    expect(serverSource).toContain('const FOLLOW_UP_OPEN_TAG = "<jobraker-follow-ups>"');
    expect(serverSource).toContain('await enqueueEvent("follow_ups", {');
    expect(serverSource).toContain("const visibleText = consumeFollowUpEnvelope(followUpStream, text);");
    expect(clientSource).toContain('currentEvent === "follow_ups"');
  });

  it("does not fall back to generic keyword-driven follow-up prompts", () => {
    expect(footerSource).not.toContain("followUpsFor");
    expect(footerSource).toContain("questions?: string[];");
  });

  it("turns failed in-flight agent steps into failures instead of leaving them running", () => {
    expect(clientSource).toContain("const finishRunningToolCalls");
    expect(clientSource).toContain("The chat stream ended before this step reported a result.");
    expect(serverSource).toContain("network_error: true");
  });

  it("returns RTRVR network failures without charging reserved provider credits", () => {
    expect(rtrvrToolsSource).toContain("async function fetchWithTimeout");
    expect(rtrvrToolsSource).toContain('code: "rtrvr_unreachable"');
    expect(rtrvrMeteringSource).toContain("if (executionResult.completed === false)");
    expect(rtrvrMeteringSource).toContain('p_reason: "provider_request_failed"');
  });
});
