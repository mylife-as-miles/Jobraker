import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  confirmGmailDraftResult,
  createColdMailPreparationToken,
  selectColdMailRecipient,
  verifyColdMailPreparationToken,
  type ColdMailPreparation,
} from "../../backend/supabase/functions/_shared/cold-mail-contract";
import {
  buildComposioExecuteBody,
  GMAIL_TOOLKIT_VERSION,
  unwrapComposioToolData,
} from "../../backend/supabase/functions/_shared/composio-tool-contract";
import {
  fingerprintColdMailPreparationToken,
  resolveColdMailDraftAttempt,
} from "../../backend/supabase/functions/_shared/cold-mail-draft-idempotency";

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

describe("cold-mail Gmail draft idempotency", () => {
  it("creates a stable non-secret request fingerprint", async () => {
    const fingerprint = await fingerprintColdMailPreparationToken(
      "signed-preparation-token",
    );

    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprint).toBe(
      await fingerprintColdMailPreparationToken("signed-preparation-token"),
    );
    expect(fingerprint).not.toContain("signed-preparation-token");
  });

  it("replays a previously confirmed Gmail draft without another provider write", () => {
    expect(
      resolveColdMailDraftAttempt({
        id: "record-1",
        status: "created",
        provider_draft_id: "draft-123",
        provider_message_id: "message-123",
        provider_thread_id: "thread-123",
        draft_from: "candidate@gmail.com",
        recipient_email: "recruiter@acme.com",
      }),
    ).toEqual({
      action: "replay",
      response: {
        success: true,
        draftId: "draft-123",
        messageId: "message-123",
        threadId: "thread-123",
        draftFrom: "candidate@gmail.com",
        to: "recruiter@acme.com",
        idempotentReplay: true,
      },
    });
  });

  it.each(["creating", "uncertain"] as const)(
    "blocks another provider write while the stored attempt is %s",
    (status) => {
      expect(
        resolveColdMailDraftAttempt({
          id: "record-1",
          status,
          provider_draft_id: null,
          provider_message_id: null,
          provider_thread_id: null,
          draft_from: null,
          recipient_email: "recruiter@acme.com",
        }),
      ).toMatchObject({
        action: "block",
        response: { success: false, code: "gmail_draft_state_uncertain" },
      });
    },
  );

  it("ships a server-owned RLS migration for the draft ledger", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "backend/supabase/migrations/20260905064539_cold_mail_draft_idempotency.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("create table public.cold_mail_drafts");
    expect(migration).toContain("unique (user_id, request_fingerprint)");
    expect(migration).toContain(
      "alter table public.cold_mail_drafts enable row level security",
    );
    expect(migration).toContain(
      "revoke all on table public.cold_mail_drafts from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant all on table public.cold_mail_drafts to service_role",
    );
  });
});

describe("Composio Gmail execution contract", () => {
  it("pins the dated Gmail toolkit version for programmatic draft parsing", () => {
    expect(
      buildComposioExecuteBody("user-123", { subject: "Hello" }),
    ).toEqual({
      user_id: "user-123",
      arguments: { subject: "Hello" },
      version: GMAIL_TOOLKIT_VERSION,
    });
    expect(GMAIL_TOOLKIT_VERSION).toMatch(/^\d{8}_\d{2}$/);
  });

  it("unwraps a nested Gmail draft ID before confirmation", () => {
    expect(
      unwrapComposioToolData({
        successful: true,
        data: {
          response_data: {
            draft_id: "draft-123",
            message: { id: "message-123" },
          },
        },
      }),
    ).toEqual({
      draft_id: "draft-123",
      message: { id: "message-123" },
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
