import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const aiChat = read("backend/supabase/functions/ai-chat/index.ts");
const composioGmail = read("backend/supabase/functions/_shared/composio-gmail.ts");
const gmailAgentTools = read("backend/supabase/functions/_shared/gmail-job-agent-tools.ts");

describe("AI Chat Composio Gmail Integration", () => {
  describe("Composio Gmail Tool Slugs & Helpers", () => {
    it("defines the full set of Composio Gmail tools including listSendAs, getDraft, sendDraft, fetchMessageById, fetchThreadById, getAttachment, batchModifyMessages, getProfile, listThreads", () => {
      expect(composioGmail).toMatch(/listSendAs:\s*"GMAIL_LIST_SEND_AS"/);
      expect(composioGmail).toMatch(/getDraft:\s*"GMAIL_GET_DRAFT"/);
      expect(composioGmail).toMatch(/sendDraft:\s*"GMAIL_SEND_DRAFT"/);
      expect(composioGmail).toMatch(/fetchMessageById:\s*"GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID"/);
      expect(composioGmail).toMatch(/sendEmail:\s*"GMAIL_SEND_EMAIL"/);
      expect(composioGmail).toMatch(/createDraft:\s*"GMAIL_CREATE_EMAIL_DRAFT"/);
      expect(composioGmail).toMatch(/fetchEmails:\s*"GMAIL_FETCH_EMAILS"/);
      expect(composioGmail).toMatch(/fetchThreadById:\s*"GMAIL_FETCH_MESSAGE_BY_THREAD_ID"/);
      expect(composioGmail).toMatch(/getAttachment:\s*"GMAIL_GET_ATTACHMENT"/);
      expect(composioGmail).toMatch(/batchModifyMessages:\s*"GMAIL_BATCH_MODIFY_MESSAGES"/);
      expect(composioGmail).toMatch(/getProfile:\s*"GMAIL_GET_PROFILE"/);
      expect(composioGmail).toMatch(/listThreads:\s*"GMAIL_LIST_THREADS"/);
    });

    it("exports helper functions for the complete email workflow", () => {
      expect(composioGmail).toMatch(/export async function composioGmailListSendAs/);
      expect(composioGmail).toMatch(/export async function composioGmailGetDraft/);
      expect(composioGmail).toMatch(/export async function composioGmailSendDraft/);
      expect(composioGmail).toMatch(/export async function composioGmailFetchMessageById/);
      expect(composioGmail).toMatch(/export async function composioGmailFetchThreadById/);
      expect(composioGmail).toMatch(/export async function composioGmailGetAttachment/);
      expect(composioGmail).toMatch(/export async function composioGmailBatchModify/);
      expect(composioGmail).toMatch(/export async function composioGmailFetchEmails/);
      expect(composioGmail).toMatch(/export async function composioGmailGetProfile/);
      expect(composioGmail).toMatch(/export async function composioGmailListThreads/);
      expect(composioGmail).toMatch(/export async function composioGmailListLabels/);
      expect(composioGmail).toMatch(/export function decodeBase64Url/);
      expect(composioGmail).toMatch(/export function isMessageWithinCutoff/);
    });

    it("handles large listings in data_preview.messages (Pitfall 2)", () => {
      expect(composioGmail).toMatch(/data_preview/);
    });

    it("stops pagination on empty/falsey nextPageToken (Pitfall 1)", () => {
      expect(composioGmail).toMatch(/nextPageToken may be an empty string/);
    });

    it("distinguishes draftId from messageId in draft creation and sending", () => {
      expect(composioGmail).toMatch(/draftId differs from messageId/);
      expect(composioGmail).toMatch(/GMAIL_SEND_DRAFT requires/);
    });
  });

  describe("Agent Tools Guardrails & API", () => {
    it("exports agent tools for all steps of the Gmail sending and fetching workflow", () => {
      expect(gmailAgentTools).toMatch(/export async function agentCreateJobRelatedDraft/);
      expect(gmailAgentTools).toMatch(/export async function agentSendJobRelatedEmail/);
      expect(gmailAgentTools).toMatch(/export async function agentListSendAsIdentities/);
      expect(gmailAgentTools).toMatch(/export async function agentGetJobRelatedDraft/);
      expect(gmailAgentTools).toMatch(/export async function agentSendJobRelatedDraft/);
      expect(gmailAgentTools).toMatch(/export async function agentFetchMessageMetadata/);
      expect(gmailAgentTools).toMatch(/export async function agentFetchEmailsByPeriod/);
      expect(gmailAgentTools).toMatch(/export async function agentFetchThreadContext/);
      expect(gmailAgentTools).toMatch(/export async function agentGetEmailAttachment/);
      expect(gmailAgentTools).toMatch(/export async function agentBatchModifyEmails/);
      expect(gmailAgentTools).toMatch(/export async function agentGetGmailProfile/);
      expect(gmailAgentTools).toMatch(/export async function agentListGmailThreads/);
      expect(gmailAgentTools).toMatch(/export async function agentListGmailLabels/);
      expect(gmailAgentTools).toMatch(/export function buildTimePeriodQuery/);
    });

    it("handles stale IDs with 404 in message hydration (Pitfall 5)", () => {
      expect(gmailAgentTools).toMatch(/gmail_message_not_found/);
    });

    it("supports time period query construction with calendar-day and rolling window semantics", () => {
      expect(gmailAgentTools).toMatch(/newer_than/);
      expect(gmailAgentTools).toMatch(/last_7_days/);
      expect(gmailAgentTools).toMatch(/last_30_days/);
      expect(gmailAgentTools).toMatch(/today/);
      expect(gmailAgentTools).toMatch(/yesterday/);
      expect(gmailAgentTools).toMatch(/after/);
      expect(gmailAgentTools).toMatch(/before/);
      expect(gmailAgentTools).toMatch(/category/);
    });

    it("performs client-side UTC cutoff filtering and deduplication", () => {
      expect(gmailAgentTools).toMatch(/isMessageWithinCutoff/);
      expect(gmailAgentTools).toMatch(/seen\.has\(msg\.id\)/);
    });

    it("validates recipients, subjects, bodies, and handles 400 validation edge cases", () => {
      expect(gmailAgentTools).toMatch(/Invalid recipient email/);
      expect(gmailAgentTools).toMatch(/Subject is required/);
      expect(gmailAgentTools).toMatch(/Body must be between 5 and 25000 characters/);
      expect(gmailAgentTools).toMatch(/Invalid CC recipient email/);
      expect(gmailAgentTools).toMatch(/Invalid BCC recipient email/);
    });
  });

  describe("AI Chat System Instructions & Function Declarations", () => {
    it("includes Gmail in COMPOSIO_AGENT_INTEGRATIONS", () => {
      expect(aiChat).toMatch(/\{\s*slug:\s*"gmail",\s*label:\s*"Gmail",\s*toolkitSlug:\s*"gmail"\s*\}/);
    });

    it("registers all 15 Gmail tools in GMAIL_AGENT_TOOL_NAMES", () => {
      const toolNames = [
        "search_gmail_job_emails",
        "fetch_gmail_emails_by_period",
        "fetch_gmail_thread",
        "get_gmail_attachment",
        "batch_modify_gmail_emails",
        "create_gmail_job_draft",
        "send_gmail_job_email",
        "label_gmail_job_emails",
        "list_gmail_send_as",
        "get_gmail_draft",
        "send_gmail_draft",
        "fetch_gmail_message",
        "get_gmail_profile",
        "list_gmail_threads",
        "list_gmail_labels",
      ];
      for (const name of toolNames) {
        expect(aiChat).toContain('"' + name + '"');
      }
    });

    it("requires explicit user confirmation for sending emails and drafts", () => {
      expect(aiChat).toMatch(/ALWAYS_APPROVE_TOOLS[\s\S]*?"send_gmail_job_email"/);
      expect(aiChat).toMatch(/ALWAYS_APPROVE_TOOLS[\s\S]*?"send_gmail_draft"/);
    });

    it("documents the 7-step fetching workflow in system instructions", () => {
      expect(aiChat).toMatch(/Standard 7-Step Workflow for Fetching Emails for a Specific Time Period/);
      expect(aiChat).toMatch(/1\.\s*Define timezone & cutoff semantics.*GMAIL_FETCH_EMAILS/);
      expect(aiChat).toMatch(/2\.\s*Retrieve first page.*GMAIL_FETCH_EMAILS/);
      expect(aiChat).toMatch(/3\.\s*Paginate & de-dupe.*page_token/);
      expect(aiChat).toMatch(/4\.\s*Validate UTC cutoff.*internalDate/);
      expect(aiChat).toMatch(/5\.\s*Hydrate content \/ context.*GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID.*GMAIL_FETCH_MESSAGE_BY_THREAD_ID.*GMAIL_GET_ATTACHMENT/);
      expect(aiChat).toMatch(/6\.\s*Tag \/ mark processed.*GMAIL_BATCH_MODIFY_MESSAGES/);
      expect(aiChat).toMatch(/7\.\s*Fallback for empty results.*broader time window/);
    });

    it("documents the 5 critical pitfalls for fetching emails in system instructions", () => {
      expect(aiChat).toMatch(/5 Critical Pitfalls for Fetching Emails/);
      expect(aiChat).toMatch(/1\.\s*Stop on falsey token/);
      expect(aiChat).toMatch(/2\.\s*Truncated \/ Preview listings.*response\.data_preview\.messages/);
      expect(aiChat).toMatch(/3\.\s*Mailbox vs UTC timezone drift/);
      expect(aiChat).toMatch(/4\.\s*Scan 403 errors/);
      expect(aiChat).toMatch(/5\.\s*Base64url body decoding.*payload\.parts\[\]\.body\.data/);
    });

    it("documents the 6-step date range and category fetching workflow in system instructions", () => {
      expect(aiChat).toMatch(/Standard 6-Step Workflow for Fetching Emails within a Date Range and Optional Categories/);
      expect(aiChat).toMatch(/1\.\s*Validate access \/ identity.*GMAIL_GET_PROFILE/);
      expect(aiChat).toMatch(/2\.\s*Resolve category \/ label IDs.*GMAIL_LIST_LABELS/);
      expect(aiChat).toMatch(/3\.\s*List message stubs.*GMAIL_FETCH_EMAILS.*max_results up to 500/);
      expect(aiChat).toMatch(/4\.\s*Paginate & enforce cutoffs.*page_token.*messages\[\]\.id/);
      expect(aiChat).toMatch(/5\.\s*Hydrate shortlist & attachments.*GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID.*GMAIL_GET_ATTACHMENT/);
      expect(aiChat).toMatch(/6\.\s*Thread grouping fallback.*GMAIL_LIST_THREADS.*GMAIL_FETCH_MESSAGE_BY_THREAD_ID/);
    });

    it("documents the 5 critical pitfalls for date range and category fetching in system instructions", () => {
      expect(aiChat).toMatch(/5 Critical Pitfalls for Date Range & Category Fetching/);
      expect(aiChat).toMatch(/1\.\s*Falsey nextPageToken stop condition/);
      expect(aiChat).toMatch(/2\.\s*Lightweight metadata-first.*include_payload=true.*413/);
      expect(aiChat).toMatch(/3\.\s*Preview listing shapes.*response\.data_preview/);
      expect(aiChat).toMatch(/4\.\s*Profile 403 scope issues/);
      expect(aiChat).toMatch(/5\.\s*Stale ID 404 handling.*refresh IDs via fetch_gmail_emails_by_period/);
    });

    it("documents the 5-step sending workflow in system instructions", () => {
      expect(aiChat).toMatch(/Standard 5-Step Workflow for Sending an Email to Someone/);
      expect(aiChat).toMatch(/1\.\s*Confirm final details.*GMAIL_SEND_EMAIL/);
      expect(aiChat).toMatch(/2\.\s*Sender identity \/ Alias.*GMAIL_LIST_SEND_AS/);
      expect(aiChat).toMatch(/3\.\s*Send-now execution.*GMAIL_SEND_EMAIL/);
      expect(aiChat).toMatch(/4\.\s*Fallback \/ Draft-first flow.*GMAIL_CREATE_EMAIL_DRAFT.*GMAIL_GET_DRAFT.*GMAIL_SEND_DRAFT/);
      expect(aiChat).toMatch(/5\.\s*Post-send verification.*GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID/);
    });

    it("documents the 5 critical pitfalls for sending emails in system instructions", () => {
      expect(aiChat).toMatch(/5 Critical Pitfalls to Avoid/);
      expect(aiChat).toMatch(/1\.\s*Non-idempotent/);
      expect(aiChat).toMatch(/2\.\s*400 validation/);
      expect(aiChat).toMatch(/3\.\s*403 \/ 400 Scope errors/);
      expect(aiChat).toMatch(/4\.\s*Outbound persistence/);
      expect(aiChat).toMatch(/5\.\s*Draft identifier mismatch/);
    });
  });
});
