import { describe, expect, it } from "vitest";
import {
  initialResumeEditorState,
  resumeEditorReducer,
  type ResumeEditorEvent,
} from "@/lib/resumeEditorState";

const reduce = (events: ResumeEditorEvent[]) =>
  events.reduce(resumeEditorReducer, initialResumeEditorState);

describe("resume editor state machine", () => {
  it("moves through loading, ready, dirty, saving, and saved", () => {
    expect(reduce([
      { type: "READY" },
      { type: "CHANGE" },
      { type: "SAVE" },
      { type: "SAVED" },
    ])).toEqual({ status: "saved", error: null });
  });

  it("records save failures and clears them on retry", () => {
    const failed = reduce([
      { type: "READY" },
      { type: "CHANGE" },
      { type: "SAVE" },
      { type: "FAIL", error: "Network unavailable" },
    ]);
    expect(failed).toEqual({ status: "error", error: "Network unavailable" });
    expect(resumeEditorReducer(failed, { type: "SAVE" }))
      .toEqual({ status: "saving", error: null });
  });

  it("does not mark changes while loading or saving", () => {
    expect(resumeEditorReducer(initialResumeEditorState, { type: "CHANGE" }).status)
      .toBe("loading");
    expect(resumeEditorReducer({ status: "saving", error: null }, { type: "CHANGE" }).status)
      .toBe("saving");
  });
});
