import { describe, expect, it } from "vitest";
import { getAiCapacityErrorMessage } from "./aiCapacityMessages";

describe("getAiCapacityErrorMessage", () => {
  it("explains the legacy reservation rejection as an exhausted allowance", () => {
    expect(getAiCapacityErrorMessage("AI usage reservation rejected")).toBe(
      "Your AI allowance has been used for now. You can continue with available credits, or wait as capacity becomes available gradually over your rolling 5-hour allowance.",
    );
  });

  it("leaves unrelated errors alone", () => {
    expect(getAiCapacityErrorMessage("Network unavailable")).toBeNull();
  });
});
