import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const aiChat = read("backend/supabase/functions/ai-chat/index.ts");
const composioGmail = read("backend/supabase/functions/_shared/composio-gmail.ts");
const gmailAgentTools = read("backend/supabase/functions/_shared/gmail-job-agent-tools.ts");

describe("AI Chat Composio Gmail Integration", () => {
  describe("Composio Gmail Tool Slugs & Helpers", () => {
    it("defines the full set of Composio Gmail tools including listSendAs, getDraft, sendDraft, fetchMessageById", () => {
      expect(composioGmail).toMatch(/listSendAs:\s*"GMAIL_LIST_SEND_AS"/);
      expect(composioGmail).toMatch(/getDraft:\s*"GMAIL_GET_DRAFT"/);
      expect(composioGmail).toMatch(/sendDraft:\s*"GMAIL_SEND_DRAFT"/);
      expect(composioGmail).toMatch(/fetchMessageById:\s*"GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID"/);
      expect(composioGmail).toMatch(/sendEmail:\s*"GMAIL_SEND_EMAIL"/);
      expect(composioGmail).toMatch(/createDraft:\s*"GMAIL_CREATE_EMAIL_DRAFT"/);
    });

    it("exports helper functions for the complete workflow", () => {
      expect(composioGmail).toMatch(/export async function composioGmailListSendAs/);
      expect(composioGmail).toMatch(/export async function composioGmailGetDraft/);
      expect(composioGmail).toMatch(/export async function composioGmailSendDraft/);
      expect(composioGmail).toMatch(/export async function composioGmailFetchMessageById/);
    });

    it("distinguishes draftId from messageId in draft creation and sending", () => {
      expect(composioGmail).toMatch(/draftId differs from messageId/);
      expect(composioGmail).toMatch(/GMAIL_SEND_DRAFT requires/);
    });
  });

  describe("Agent Tools Guardrails & API", () => {
    it("exports agent tools for all steps of the Gmail workflow", () => {
      expect(gmailAgentTools).toMatch(/export async function agentCreateJobRelatedDraft/);
      expect(gmailAgentTools).toMatch(/export async function agentSendJobRelatedEmail/);
      expect(gmailAgentTools).toMatch(/export async function agentListSendAsIdentities/);
      expect(gmailAgentTools).toMatch(/export async function agentGetJobRelatedDraft/);
      expect(gmailAgentTools).toMatch(/export async function agentSendJobRelatedDraft/);
      expect(gmailAgentTools).toMatch(/export async function agentFetchMessageMetadata/);
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

    it("registers all 8 Gmail tools in GMAIL_AGENT_TOOL_NAMES", () => {
      const toolNames = [
        "search_gmail_job_emails",
        "create_gmail_job_draft",
        "send_gmail_job_email",
        "label_gmail_job_emails",
        "list_gmail_send_as",
        "get_gmail_draft",
        "send_gmail_draft",
        "fetch_gmail_message",
      ];
      for (const name of toolNames) {
        expect(aiChat).toContain('"' + name + '"');
      }
    });

    it("requires explicit user confirmation for sending emails and drafts", () => {
      expect(aiChat).toMatch(/ALWAYS_APPROVE_TOOLS[\s\S]*?"send_gmail_job_email"/);
      expect(aiChat).toMatch(/ALWAYS_APPROVE_TOOLS[\s\S]*?"send_gmail_draft"/);
    });

    it("documents the 5-step workflow in system instructions", () => {
      expect(aiChat).toMatch(/Standard 5-Step Workflow for Sending an Email to Someone/);
      expect(aiChat).toMatch(/1\.\s*Confirm final details.*GMAIL_SEND_EMAIL/);
      expect(aiChat).toMatch(/2\.\s*Sender identity \/ Alias.*GMAIL_LIST_SEND_AS/);
      expect(aiChat).toMatch(/3\.\s*Send-now execution.*GMAIL_SEND_EMAIL/);
      expect(aiChat).toMatch(/4\.\s*Fallback \/ Draft-first flow.*GMAIL_CREATE_EMAIL_DRAFT.*GMAIL_GET_DRAFT.*GMAIL_SEND_DRAFT/);
      expect(aiChat).toMatch(/5\.\s*Post-send verification.*GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID/);
    });

    it("documents the 5 critical pitfalls in system instructions", () => {
      expect(aiChat).toMatch(/5 Critical Pitfalls to Avoid/);
      expect(aiChat).toMatch(/1\.\s*Non-idempotent/);
      expect(aiChat).toMatch(/2\.\s*400 validation/);
      expect(aiChat).toMatch(/3\.\s*403 \/ 400 Scope errors/);
      expect(aiChat).toMatch(/4\.\s*Outbound persistence/);
      expect(aiChat).toMatch(/5\.\s*Draft identifier mismatch/);
    });
  });
});
