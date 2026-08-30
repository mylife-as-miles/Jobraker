import { describe, expect, it } from "vitest";
import { sanitizeClientAiError } from "../services/supabase/invokeProtectedFunction";

describe("sanitizeClientAiError", () => {
  it("sanitizes raw 429 Google Generative AI stack traces", () => {
    const rawError =
      "[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent: [429 Too Many Requests] RESOURCE_EXHAUSTED: Resource has been exhausted (e.g. check quota).\n    at file:///vercel/path0/node_modules/@google/genai/dist/index.js:123:45";

    const sanitized = sanitizeClientAiError(rawError);
    expect(sanitized).not.toContain("GoogleGenerativeAI");
    expect(sanitized).not.toContain("https://generativelanguage.googleapis.com");
    expect(sanitized).not.toContain("RESOURCE_EXHAUSTED");
    expect(sanitized).not.toContain("at file:///");
    expect(sanitized).toBe("AI generation is temporarily experiencing high demand. Please try again in a few moments.");
  });

  it("sanitizes 429 HTTP status with empty message", () => {
    const sanitized = sanitizeClientAiError("", 429);
    expect(sanitized).toBe("AI capacity is temporarily limited due to high demand. Please try again in a moment.");
  });

  it("sanitizes quota exceeded messages", () => {
    const rawError = "Quota exceeded for quota metric 'Generative Language API requests' and limit 'Requests per minute'";
    const sanitized = sanitizeClientAiError(rawError);
    expect(sanitized).toBe("AI generation is temporarily experiencing high demand. Please try again in a few moments.");
  });

  it("sanitizes permission denied messages", () => {
    const rawError = "Permission denied: project has been denied access to model gemini-3.6-flash";
    const sanitized = sanitizeClientAiError(rawError);
    expect(sanitized).toBe("The AI service is temporarily undergoing maintenance. Please try again shortly.");
  });

  it("strips JavaScript stack traces from generic errors", () => {
    const rawError = "Failed to process data\n    at Object.parse (file:///app/src/index.js:10:5)\n    at main (file:///app/src/main.js:20:3)";
    const sanitized = sanitizeClientAiError(rawError);
    expect(sanitized).toBe("Failed to process data");
    expect(sanitized).not.toContain("at Object.parse");
  });
});
