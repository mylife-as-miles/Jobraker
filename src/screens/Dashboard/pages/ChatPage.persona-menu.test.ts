import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const chatPageSource = readFileSync(
  resolve(process.cwd(), "src/screens/Dashboard/pages/ChatPage.tsx"),
  "utf8",
);

describe("ChatPage click-first composer", () => {
  it("has no Ask/Agent mode toggle; chat always runs in Agent mode", () => {
    expect(chatPageSource).not.toContain("Ask: plan");
    expect(chatPageSource).not.toContain("handlePersonaChange");
  });

  it("starts tasks from the one-click action grid", () => {
    expect(chatPageSource).toContain("<ChatActionGrid");
    expect(chatPageSource).not.toContain("<ChatPresetsBar");
  });
});
