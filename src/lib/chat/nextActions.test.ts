import { describe, expect, it } from "vitest";
import { MAX_NEXT_ACTIONS, normalizeNextActions } from "./nextActions";

describe("normalizeNextActions", () => {
  it("reads the event payload and tidies labels", () => {
    expect(
      normalizeNextActions({
        actions: [
          { label: "  Apply to these 3. ", prompt: "Apply to the Stripe,  Airbnb and GitLab roles" },
        ],
      }),
    ).toEqual([
      { label: "Apply to these 3", prompt: "Apply to the Stripe, Airbnb and GitLab roles" },
    ]);
  });

  it("falls back to the prompt when the label is missing", () => {
    expect(normalizeNextActions([{ prompt: "Show my stale applications" }])).toEqual([
      { label: "Show my stale applications", prompt: "Show my stale applications" },
    ]);
  });

  it("drops malformed and duplicate entries and caps the count", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ label: `Job ${i}`, prompt: `Pick job ${i}` }));
    expect(normalizeNextActions([null, "text", { label: "x", prompt: "" }])).toEqual([]);
    expect(
      normalizeNextActions([
        { label: "Same", prompt: "First prompt" },
        { label: "same", prompt: "Second prompt" },
      ]),
    ).toHaveLength(1);
    expect(normalizeNextActions(many)).toHaveLength(MAX_NEXT_ACTIONS);
  });

  it("returns nothing for unexpected shapes", () => {
    expect(normalizeNextActions(undefined)).toEqual([]);
    expect(normalizeNextActions({ questions: ["Can you help?"] })).toEqual([]);
  });
});
