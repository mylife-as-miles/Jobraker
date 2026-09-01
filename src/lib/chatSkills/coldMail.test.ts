import { describe, expect, it } from "vitest";
import {
  extractColdMailJobReferences,
  selectColdMailJobReference,
} from "./coldMail";

describe("Cold Mail current job-search context", () => {
  const searchResult = `I found these jobs:\n1. Backend Engineer at Acme (Remote | rtrvr | verified)\n   https://acme.com/jobs/1\n2. Platform Engineer at Globex (Lagos | direct)\n   https://globex.com/jobs/2`;

  it("extracts individual jobs from the current AI Chat search result", () => {
    expect(extractColdMailJobReferences(searchResult)).toEqual([
      { jobTitle: "Backend Engineer", companyName: "Acme" },
      { jobTitle: "Platform Engineer", companyName: "Globex" },
    ]);
  });

  it("selects an ordinal job requested by the user", () => {
    const references = extractColdMailJobReferences(searchResult);

    expect(selectColdMailJobReference(references, "draft for the second job")).toEqual({
      jobTitle: "Platform Engineer",
      companyName: "Globex",
    });
  });

  it("does not guess when several jobs exist and none is selected", () => {
    const references = extractColdMailJobReferences(searchResult);

    expect(selectColdMailJobReference(references, "create a cold email")).toBeNull();
  });
});
