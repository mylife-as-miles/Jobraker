import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "backend/supabase/functions/ai-chat/index.ts"),
  "utf8",
);

describe("AI chat Gemini thought-signature continuity", () => {
  it("preserves model-generated parts instead of mutating signed function calls", () => {
    expect(source).toContain("accumulatedParts.push(...parts);");
    expect(source).not.toContain(
      "part.functionCall.name = part.functionCall.name.replace",
    );
    expect(source).toContain("Normalize a copy for local dispatch");
  });

  it("does not synthesize unsigned function-call history from persisted UI messages", () => {
    expect(source).not.toContain("const fnCalls = m.toolCalls.map");
    expect(source).not.toMatch(
      /history\.push\(\{\s*role: "model",\s*parts: synthesizedParts/,
    );
    expect(source).toContain(
      "UI-persisted tool calls do not contain Gemini's encrypted",
    );
  });

  it("keeps approved execution local and hands its results back as text", () => {
    expect(source).toContain(
      "const executingApprovedToolCalls = executableApprovedToolCalls.length > 0;",
    );
    expect(source).toContain(
      "These pseudo-parts are a local execution queue only.",
    );
    expect(source).toContain(
      "The user approved these actions and the server executed them.",
    );
    expect(source).toContain("message: resultMessage");
  });

  it("responds to live signed calls using the model's original name and id", () => {
    expect(source).toContain("asString(fc.modelFunctionName)");
    expect(source).toContain("if (functionCallId) functionResponse.id = functionCallId;");
    expect(source).toContain("toolResults.push({ functionResponse });");
  });
});
