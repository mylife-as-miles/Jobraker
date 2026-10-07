import { describe, expect, it } from "vitest";
import {
  applyPattern,
  candidateEmails,
  inferEmailPattern,
  nameParts,
} from "../../backend/supabase/functions/_shared/email-pattern";

describe("nameParts", () => {
  it("normalizes accents, honorifics and suffixes", () => {
    expect(nameParts("Dr. José  García-López, PhD")).toEqual({ first: "jose", last: "garcialopez" });
    expect(nameParts("Madonna")).toBeNull();
  });
});

describe("inferEmailPattern", () => {
  it("is decisive when an address appears next to the person's name", () => {
    const result = inferEmailPattern(
      [
        { email: "jdoe@acme.com", fullName: "Jane Doe" },
        { email: "bsmith@acme.com", fullName: "Bob Smith" },
      ],
      "acme.com",
    );
    expect(result?.pattern).toBe("flast");
    expect(result!.confidence).toBeGreaterThan(0.6);
  });

  it("uses unambiguous shapes and ignores role inboxes and other domains", () => {
    const result = inferEmailPattern(
      [
        { email: "jobs@acme.com" },
        { email: "press@acme.com" },
        { email: "jane.doe@acme.com" },
        { email: "someone@gmail.com" },
      ],
      "acme.com",
    );
    expect(result).toMatchObject({ pattern: "first.last", samples: 1 });
    expect(result!.confidence).toBeLessThan(0.7);
  });

  it("returns null without usable evidence", () => {
    expect(inferEmailPattern([{ email: "info@acme.com" }], "acme.com")).toBeNull();
  });
});

describe("candidateEmails", () => {
  it("tries the learned pattern first, then common formats", () => {
    expect(candidateEmails("Jane Doe", "acme.com", "flast")).toEqual([
      "jdoe@acme.com",
      "jane.doe@acme.com",
      "jane@acme.com",
      "janedoe@acme.com",
    ]);
    expect(candidateEmails("Jane Doe", "acme.com", null, 2)).toEqual([
      "jane.doe@acme.com",
      "jane@acme.com",
    ]);
  });

  it("builds each format", () => {
    const name = { first: "jane", last: "doe" };
    expect(applyPattern("f.last", name, "Acme.com")).toBe("j.doe@acme.com");
    expect(applyPattern("firstl", name, "acme.com")).toBe("janed@acme.com");
  });
});
