import { describe, expect, it } from "vitest";
import { getAiCapacityErrorMessage } from "./aiCapacityMessages";

describe("getAiCapacityErrorMessage", () => {
  it("explains the legacy reservation rejection as an exhausted allowance", () => {
    expect(getAiCapacityErrorMessage("AI usage reservation rejected")).toBe(
      "Your AI allowance has been used for now. It becomes available gradually as your rolling 24-hour allowance refreshes.",
    );
  });

  it("leaves unrelated errors alone", () => {
    expect(getAiCapacityErrorMessage("Network unavailable")).toBeNull();
  });
});
