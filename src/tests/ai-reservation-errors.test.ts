import { describe, expect, it } from "vitest";
import { getAiReservationErrorMessage } from "../../backend/supabase/functions/_shared/ai-usage-errors";

describe("getAiReservationErrorMessage", () => {
  it("turns a limit rejection without a database message into an actionable status", () => {
    expect(getAiReservationErrorMessage("AI_USAGE_LIMIT_REACHED")).toBe(
      "You’ve reached your AI usage limit for now. You can continue with available credits, or wait as capacity refreshes gradually over your rolling 5-hour allowance.",
    );
  });

  it("does not expose an internal reservation error when the reason is unknown", () => {
    expect(getAiReservationErrorMessage("UNKNOWN")).toBe(
      "We couldn’t reserve AI capacity for this request. Please try again.",
    );
  });
});
