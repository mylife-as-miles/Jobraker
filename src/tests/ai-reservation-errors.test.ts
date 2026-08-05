import { describe, expect, it } from "vitest";
import { getAiReservationErrorMessage } from "../../backend/supabase/functions/_shared/ai-usage-errors";

describe("getAiReservationErrorMessage", () => {
  it("turns a limit rejection without a database message into an actionable status", () => {
    expect(getAiReservationErrorMessage("AI_USAGE_LIMIT_REACHED")).toBe(
      "You’ve reached your AI usage limit for now. It becomes available again as your 24-hour allowance rolls forward.",
    );
  });

  it("does not expose an internal reservation error when the reason is unknown", () => {
    expect(getAiReservationErrorMessage("UNKNOWN")).toBe(
      "We couldn’t reserve AI capacity for this request. Please try again.",
    );
  });
});
