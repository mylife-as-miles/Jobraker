import { describe, expect, it } from "vitest";
import {
  commitVoiceInterimTranscript,
  mergeVoiceTranscript,
} from "./voiceTranscript";

describe("mergeVoiceTranscript", () => {
  it("keeps finalized speech when recognition resumes after a pause", () => {
    const firstRun = mergeVoiceTranscript({
      baseText: "Find product roles",
      finalizedTranscript: "",
      newFinalTranscript: "in Lagos",
      interimTranscript: "that support remote work",
    });

    const resumedRun = mergeVoiceTranscript({
      baseText: "Find product roles",
      finalizedTranscript: commitVoiceInterimTranscript(
        firstRun.finalizedTranscript,
        "that support remote work",
      ),
      newFinalTranscript: "and pay competitively",
      interimTranscript: "",
    });

    expect(resumedRun.draft).toBe(
      "Find product roles in Lagos that support remote work and pay competitively",
    );
  });
});
