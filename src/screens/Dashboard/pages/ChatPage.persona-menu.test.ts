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
});
