import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Contract for how process-auto-apply-queue reads the RTRVR agent response.
// A run that stopped with status "requires_input" was once recorded as Applied.
const source = readFileSync(
  resolve(process.cwd(), "backend/supabase/functions/process-auto-apply-queue/index.ts"),
  "utf8",
);

describe("RTRVR result classification", () => {
  it("treats requires_input, input questions and blocked terminal states as waiting for the user", () => {
    expect(source).toMatch(/result\?\.status === "requires_input"/);
    expect(source).toMatch(/result\?\.inputRequest\?\.questions/);
    expect(source).toMatch(/\/\^blocked\/i\.test\(rtrvrTerminalState\)/);
    expect(source).toMatch(/const isWaitingForUser =\s*rtrvrRequiresInput \|\|/);
  });

  it("only counts a run as submitted on explicit provider success", () => {
    expect(source).toMatch(
      /rtrvrConfirmedSuccess =\s*result\?\.success === true && result\?\.terminalResult\?\.taskComplete !== false/,
    );
    expect(source).toMatch(/isDraftOnly = [^;]*submissionUnconfirmed/);
    expect(source).toMatch(/"submission_uncertain"/);
  });
});
