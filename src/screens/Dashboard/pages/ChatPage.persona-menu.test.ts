import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const chatPageSource = readFileSync(
  resolve(process.cwd(), "src/screens/Dashboard/pages/ChatPage.tsx"),
  "utf8",
);

describe("ChatPage persona menu", () => {
  it("uses the portal-based menu instead of a composer-clipped popup", () => {
    expect(chatPageSource).toContain("<DropdownMenuContent");
    expect(chatPageSource).not.toContain(
      "absolute right-0 bottom-full mb-2 z-50",
    );
  });

  it("places the compact presets trigger beside the agent control", () => {
    const controlsStart = chatPageSource.indexOf("{/* Right: Controls */}");
    const presetsTrigger = chatPageSource.indexOf("<ChatPresetsBar", controlsStart);
    const agentMenu = chatPageSource.indexOf("<DropdownMenu>", presetsTrigger);

    expect(controlsStart).toBeGreaterThan(-1);
    expect(presetsTrigger).toBeGreaterThan(controlsStart);
    expect(agentMenu).toBeGreaterThan(presetsTrigger);
    expect(chatPageSource.slice(0, controlsStart)).not.toContain("<ChatPresetsBar");
  });
});
