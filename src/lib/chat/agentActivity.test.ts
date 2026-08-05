import { describe, expect, it } from "vitest";
import { isUserVisibleAgentActivity } from "./agentActivity";

describe("isUserVisibleAgentActivity", () => {
  it("keeps model thinking frames out of the user-facing timeline", () => {
    expect(isUserVisibleAgentActivity("thinking")).toBe(false);
    expect(isUserVisibleAgentActivity("thought_summary")).toBe(false);
    expect(isUserVisibleAgentActivity("status")).toBe(true);
    expect(isUserVisibleAgentActivity("billing")).toBe(true);
  });
});
