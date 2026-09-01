import { describe, expect, it } from "vitest";
import {
  confirmGmailDraftResult,
  createColdMailPreparationToken,
  selectColdMailRecipient,
  verifyColdMailPreparationToken,
  type ColdMailPreparation,
} from "../../backend/supabase/functions/_shared/cold-mail-contract";

const preparation: ColdMailPreparation = {
  userId: "user-123",
  jobId: "job-456",
  companyName: "Acme",
  jobTitle: "Backend Engineer",
  recipient: {
    email: "ada@acme.com",
    name: "Ada Recruiter",
    title: "Technical Recruiter",
    source: "https://acme.com/careers",
    confidence: "high",
  },
  subject: "backend engineering",
  body: "Hi Ada,\n\nYour backend opening matches my distributed systems work. Worth a conversation?",
};

describe("cold-mail preparation contract", () => {
  it("round-trips the exact reviewed draft through a signed token", async () => {
    const token = await createColdMailPreparationToken(
      preparation,
      "test-signing-secret",
      { nowMs: 1_000, ttlMs: 60_000 },
    );

    const verified = await verifyColdMailPreparationToken(
      token,
      "test-signing-secret",
      { nowMs: 30_000 },
    );

    expect(verified).toEqual(preparation);
  });

  it("rejects a preparation token changed by the browser", async () => {
    const token = await createColdMailPreparationToken(
      preparation,
      "test-signing-secret",
      { nowMs: 1_000, ttlMs: 60_000 },
    );
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    await expect(
      verifyColdMailPreparationToken(tampered, "test-signing-secret", {
        nowMs: 30_000,
      }),
    ).rejects.toThrow("invalid");
  });

  it("rejects an expired preparation token", async () => {
    const token = await createColdMailPreparationToken(
      preparation,
      "test-signing-secret",
      { nowMs: 1_000, ttlMs: 5_000 },
    );

    await expect(
      verifyColdMailPreparationToken(token, "test-signing-secret", {
        nowMs: 7_000,
      }),
    ).rejects.toThrow("expired");
  });
});

describe("confirmGmailDraftResult", () => {
  it("confirms creation only when Gmail returns a draft ID", () => {
    expect(
      confirmGmailDraftResult({
        success: true,
        draftId: "draft-123",
        messageId: "message-123",
        threadId: "thread-123",
        draftFrom: "candidate@gmail.com",
        to: "ada@acme.com",
      }),
    ).toMatchObject({ success: true, draftId: "draft-123" });
  });

  it("fails closed when the provider reports success without a draft ID", () => {
    expect(confirmGmailDraftResult({ success: true, draftId: null })).toEqual({
      success: false,
      error: "Gmail did not return a draft ID, so draft creation could not be confirmed.",
      code: "gmail_draft_unconfirmed",
    });
  });
});

describe("selectColdMailRecipient", () => {
  it("selects the highest-relevance provider-verified recruiter", () => {
    expect(
      selectColdMailRecipient({
        recruiterContacts: [
          {
            fullName: "Ada Recruiter",
            title: "Technical Recruiter",
            workEmail: "ada@acme.com",
            emailStatus: "provider_verified",
            emailConfidence: 0.94,
            emailSourceUrl: "https://verifier.example",
            relevanceScore: 91,
            safeToContact: true,
          },
          {
            fullName: "Lower Match",
            title: "Recruiter",
            workEmail: "lower@acme.com",
            emailStatus: "source_verified",
            emailConfidence: 0.91,
            emailSourceUrl: "https://acme.com/team",
            relevanceScore: 72,
            safeToContact: true,
          },
        ],
      }),
    ).toEqual({
      email: "ada@acme.com",
      name: "Ada Recruiter",
      title: "Technical Recruiter",
      source: "https://verifier.example",
      confidence: "high",
    });
  });

  it("accepts a verified public recruitment inbox with source evidence", () => {
    expect(
      selectColdMailRecipient({
        contactEmail: "careers@acme.com",
        confidence: "medium",
        publicContactChannels: [
          "Verified recruitment inbox | careers@acme.com | source=https://acme.com/careers",
        ],
      }),
    ).toEqual({
      email: "careers@acme.com",
      source: "https://acme.com/careers",
      confidence: "medium",
    });
  });

  it("rejects an address without verification evidence", () => {
    expect(
      selectColdMailRecipient({
        contactEmail: "recruitment@acme.com",
        confidence: "high",
        publicContactChannels: [],
      }),
    ).toBeNull();
  });

  it("rejects a provider contact whose verification source is not a web URL", () => {
    expect(
      selectColdMailRecipient({
        recruiterContacts: [
          {
            fullName: "Ada Recruiter",
            workEmail: "ada@acme.com",
            emailStatus: "provider_verified",
            emailSourceUrl: "provider assertion without a source URL",
            relevanceScore: 91,
            safeToContact: true,
          },
        ],
      }),
    ).toBeNull();
  });
});
