import { describe, expect, it } from "vitest";
import { selectColdMailRecipient } from "../../backend/supabase/functions/_shared/cold-mail-contract";

const contact = (overrides: Record<string, unknown>) => ({
  fullName: "Jane Doe",
  title: "Senior Technical Recruiter",
  workEmail: "jane.doe@acme.com",
  emailStatus: "provider_verified",
  emailSourceUrl: "https://www.reoon.com/email-verifier/",
  safeToContact: true,
  emailConfidence: 0.95,
  relevanceScore: 90,
  ...overrides,
});

describe("selectColdMailRecipient", () => {
  it("prefers a verified recruiter", () => {
    const recipient = selectColdMailRecipient({
      recruiterContacts: [
        contact({ fullName: "Likely Lee", workEmail: "llee@acme.com", emailStatus: "pattern_only", safeToContact: false, emailSourceUrl: "https://acme.com", relevanceScore: 99 }),
        contact({}),
      ],
    });
    expect(recipient).toMatchObject({ email: "jane.doe@acme.com", confidence: "high" });
  });

  it("falls back to a likely address with low confidence", () => {
    const recipient = selectColdMailRecipient({
      recruiterContacts: [
        contact({ workEmail: "jdoe@acme.com", emailStatus: "pattern_only", safeToContact: false, emailSourceUrl: "https://acme.com" }),
      ],
    });
    expect(recipient).toMatchObject({ email: "jdoe@acme.com", confidence: "low", name: "Jane Doe" });
  });

  it("returns nothing when no address exists", () => {
    expect(selectColdMailRecipient({ recruiterContacts: [contact({ workEmail: "", emailStatus: "not_found", safeToContact: false })] })).toBeNull();
  });
});
