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
      expect(composioGmail).toMatch(/settingsSendAsGet:\s*"GMAIL_SETTINGS_SEND_AS_GET"/);
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
      expect(composioGmail).toMatch(/export async function composioGmailGetSendAs/);
      expect(composioGmail).toMatch(/export function buildSubjectSenderQuery/);
      expect(composioGmail).toMatch(/export function decodeBase64Url/);
      expect(composioGmail).toMatch(/export function isMessageWithinCutoff/);
    });

    it("handles large listings in data_preview.messages (Pitfall 2)", () => {
      expect(composioGmail).toMatch(/data_preview/);
    });

    it("stops pagination on empty/falsey nextPageToken (Pitfall 1)", () => {
      expect(composioGmail).toMatch(/nextPageToken may be an empty string/);
    });

    it("handles 413 ToolRouterV2_PayloadTooLarge and 429 Retry-After (Pitfalls 2 & 3)", () => {
      expect(composioGmail).toMatch(/ToolRouterV2_PayloadTooLarge/);
      expect(composioGmail).toMatch(/429 rate limit exceeded/);
      expect(composioGmail).toMatch(/Retry-After/);
    });

    it("distinguishes draftId from messageId in draft creation and sending", () => {
      expect(composioGmail).toMatch(/draftId differs from messageId/);
      expect(composioGmail).toMatch(/GMAIL_SEND_DRAFT requires/);
    });

    it("chunks batch modifications to <=1000 items and retries on 429 throttling (Pitfall 5)", () => {
      expect(composioGmail).toMatch(/maxChunk/);
      expect(composioGmail).toMatch(/retrying smaller sub-batches/);
    });

    it("exports composioGmailReplyToThread and handles thread errors defensively (Pitfalls 3, 4, 5)", () => {
      expect(composioGmail).toMatch(/replyToThread:\s*"GMAIL_REPLY_TO_THREAD"/);
      expect(composioGmail).toMatch(/export async function composioGmailReplyToThread/);
      expect(composioGmail).toMatch(/Ensure discovery and hydration use the same mailbox context/);
      expect(composioGmail).toMatch(/locate messages\[\] defensively/);
      expect(composioGmail).toMatch(/payload too large \(HTTP 413\)/);
    });

    it("supports draft management, people search, contacts fallback, and handles attachment token errors", () => {
      expect(composioGmail).toMatch(/updateDraft:\s*"GMAIL_UPDATE_DRAFT"/);
      expect(composioGmail).toMatch(/listDrafts:\s*"GMAIL_LIST_DRAFTS"/);
      expect(composioGmail).toMatch(/getPeople:\s*"GMAIL_GET_PEOPLE"/);
      expect(composioGmail).toMatch(/searchPeople:\s*"GMAIL_SEARCH_PEOPLE"/);
      expect(composioGmail).toMatch(/export async function composioGmailUpdateDraft/);
      expect(composioGmail).toMatch(/export async function composioGmailListDrafts/);
      expect(composioGmail).toMatch(/export async function composioGmailSearchPeople/);
      expect(composioGmail).toMatch(/export async function composioGmailGetPeople/);
      expect(composioGmail).toMatch(/Invalid attachment token/);
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
      expect(gmailAgentTools).toMatch(/export async function agentSearchEmailsBySubjectSender/);
      expect(gmailAgentTools).toMatch(/export async function agentFetchUnreadImportantEmails/);
      expect(gmailAgentTools).toMatch(/export async function agentFetchEmails/);
      expect(gmailAgentTools).toMatch(/export async function agentFetchEmailsByPeriod/);
      expect(gmailAgentTools).toMatch(/export async function agentFetchThreadContext/);
      expect(gmailAgentTools).toMatch(/export const agentFetchEmailRepliesOrThread/);
      expect(gmailAgentTools).toMatch(/export async function agentReplyToThread/);
      expect(gmailAgentTools).toMatch(/export async function agentGetEmailAttachment/);
      expect(gmailAgentTools).toMatch(/export async function agentBatchModifyEmails/);
      expect(gmailAgentTools).toMatch(/export async function agentGetGmailProfile/);
      expect(gmailAgentTools).toMatch(/export async function agentListGmailThreads/);
      expect(gmailAgentTools).toMatch(/export async function agentListGmailLabels/);
      expect(gmailAgentTools).toMatch(/export async function agentCheckGmailConnectionStatus/);
      expect(gmailAgentTools).toMatch(/export async function agentGetGmailSettingsSendAs/);
      expect(gmailAgentTools).toMatch(/export async function agentUpdateJobRelatedDraft/);
      expect(gmailAgentTools).toMatch(/export async function agentListGmailDrafts/);
      expect(gmailAgentTools).toMatch(/export async function agentSearchPeople/);
      expect(gmailAgentTools).toMatch(/export async function agentGetPeople/);
      expect(gmailAgentTools).toMatch(/export function buildTimePeriodQuery/);
    });

    it("supports client-side sorting and top-N extraction for newest-N guarantee (Step 4)", () => {
      expect(gmailAgentTools).toMatch(/sort_newest/);
      expect(gmailAgentTools).toMatch(/top_n/);
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

    it("registers all 25 Gmail tools in GMAIL_AGENT_TOOL_NAMES", () => {
      const toolNames = [
        "search_gmail_job_emails",
        "search_gmail_emails_by_subject_sender",
        "fetch_gmail_unread_important",
        "fetch_gmail_emails",
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
        "check_gmail_connection_status",
        "get_gmail_settings_send_as",
        "reply_gmail_thread",
        "update_gmail_draft",
        "list_gmail_drafts",
        "search_gmail_people",
        "get_gmail_people",
      ];
      for (const name of toolNames) {
        expect(aiChat).toContain('"' + name + '"');
      }
    });

    it("requires explicit user confirmation for sending emails, drafts, and replying to threads", () => {
      expect(aiChat).toMatch(/ALWAYS_APPROVE_TOOLS[\s\S]*?"send_gmail_job_email"/);
      expect(aiChat).toMatch(/ALWAYS_APPROVE_TOOLS[\s\S]*?"send_gmail_draft"/);
      expect(aiChat).toMatch(/ALWAYS_APPROVE_TOOLS[\s\S]*?"reply_gmail_thread"/);
      expect(aiChat).toMatch(/ALWAYS_APPROVE_TOOLS[\s\S]*?"update_gmail_draft"/);
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

    it("documents the 8-step general email fetching workflow in system instructions", () => {
      expect(aiChat).toMatch(/Standard 8-Step Workflow for Fetching Emails from Gmail/);
      expect(aiChat).toMatch(/1\.\s*Confirm mailbox access.*GMAIL_GET_PROFILE/);
      expect(aiChat).toMatch(/2\.\s*Fetch lightweight first page.*GMAIL_FETCH_EMAILS/);
      expect(aiChat).toMatch(/3\.\s*Paginate & de-dupe.*page_token/);
      expect(aiChat).toMatch(/4\.\s*Client-side sort for newest-N.*internalDate\/messageTimestamp/);
      expect(aiChat).toMatch(/5\.\s*Map label name to ID.*GMAIL_LIST_LABELS/);
      expect(aiChat).toMatch(/6\.\s*Hydrate selected items.*GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID/);
      expect(aiChat).toMatch(/7\.\s*Expand conversation context.*GMAIL_FETCH_MESSAGE_BY_THREAD_ID/);
      expect(aiChat).toMatch(/8\.\s*Fallback for empty results.*re-run GMAIL_FETCH_EMAILS with lighter settings/);
    });

    it("documents the 5 critical pitfalls for general email fetching in system instructions", () => {
      expect(aiChat).toMatch(/5 Critical Pitfalls for Fetching Emails from Gmail/);
      expect(aiChat).toMatch(/1\.\s*Capped max_results.*500/);
      expect(aiChat).toMatch(/2\.\s*PayloadTooLarge 413.*ToolRouterV2_PayloadTooLarge.*4345/);
      expect(aiChat).toMatch(/3\.\s*Quota & rate limits \(429\).*Retry-After/);
      expect(aiChat).toMatch(/4\.\s*Varying response shapes.*data vs data_preview/);
      expect(aiChat).toMatch(/5\.\s*Stale ID 404 & mid-flow scope changes.*404 notFound/);
    });

    it("documents the 5-step connection status checking workflow in system instructions", () => {
      expect(aiChat).toMatch(/Standard 5-Step Workflow for Checking Existing Gmail Connection Status/);
      expect(aiChat).toMatch(/1\.\s*Confirm authentication & identity.*GMAIL_GET_PROFILE/);
      expect(aiChat).toMatch(/2\.\s*Prove read\/list access.*GMAIL_FETCH_EMAILS/);
      expect(aiChat).toMatch(/3\.\s*Cross-check threads.*GMAIL_LIST_THREADS/);
      expect(aiChat).toMatch(/4\.\s*Debug label visibility.*GMAIL_LIST_LABELS/);
      expect(aiChat).toMatch(/5\.\s*Verify settings endpoints.*GMAIL_SETTINGS_SEND_AS_GET/);
    });

    it("documents the 5 critical pitfalls for checking Gmail connection status in system instructions", () => {
      expect(aiChat).toMatch(/5 Critical Pitfalls for Checking Gmail Connection Status/);
      expect(aiChat).toMatch(/1\.\s*Non-retryable auth\/precondition errors.*401\/403.*FAILED_PRECONDITION/);
      expect(aiChat).toMatch(/2\.\s*Frequent polling rate limits.*userRateLimitExceeded.*429/);
      expect(aiChat).toMatch(/3\.\s*Capped sample & payload-heavy responses.*max_results is capped/);
      expect(aiChat).toMatch(/4\.\s*Empty string nextPageToken stop.*empty string/);
      expect(aiChat).toMatch(/5\.\s*Missing bodies in lightweight modes.*messages=\[\]/);
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

    it("documents the 7-step subject & sender search workflow in system instructions", () => {
      expect(aiChat).toMatch(/Standard 7-Step Workflow for Searching Emails by Subject and Sender/);
      expect(aiChat).toMatch(/1\.\s*Resolve labels.*GMAIL_LIST_LABELS/);
      expect(aiChat).toMatch(/2\.\s*Search lightweight.*search_gmail_emails_by_subject_sender.*GMAIL_FETCH_EMAILS/);
      expect(aiChat).toMatch(/3\.\s*Paginate.*page_token.*nextPageToken/);
      expect(aiChat).toMatch(/4\.\s*Fallback for empty or broad results.*relaxed constraints/);
      expect(aiChat).toMatch(/5\.\s*Hydrate hits.*GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID/);
      expect(aiChat).toMatch(/6\.\s*Fetch thread context.*GMAIL_FETCH_MESSAGE_BY_THREAD_ID.*choose messages by timestamp/);
      expect(aiChat).toMatch(/7\.\s*Download attachments.*GMAIL_GET_ATTACHMENT.*attachment_id/);
    });

    it("documents the 5 critical pitfalls for searching emails by subject and sender in system instructions", () => {
      expect(aiChat).toMatch(/5 Critical Pitfalls for Searching Emails by Subject and Sender/);
      expect(aiChat).toMatch(/1\.\s*Valid no-match state.*messages can be \[\]/);
      expect(aiChat).toMatch(/2\.\s*Empty nextPageToken stop.*nextPageToken may be ""/);
      expect(aiChat).toMatch(/3\.\s*Lightweight listing.*include_payload\/verbose/);
      expect(aiChat).toMatch(/4\.\s*Message ID vs thread ID.*ID fields vary.*messageId vs id/);
      expect(aiChat).toMatch(/5\.\s*Attachment ID source.*attachment_id must come from the hydrated message’s attachment metadata/);
    });

    it("documents the 7-step unread important fetching workflow in system instructions", () => {
      expect(aiChat).toMatch(/Standard 7-Step Workflow for Fetching Unread Important Emails from Gmail/);
      expect(aiChat).toMatch(/1\.\s*Select mailbox context.*GMAIL_FETCH_EMAILS/);
      expect(aiChat).toMatch(/2\.\s*Fetch unread\/high-priority candidates.*fetch_gmail_unread_important.*is:unread is:important/);
      expect(aiChat).toMatch(/3\.\s*Paginate & track progression.*page_token.*nextPageToken is falsy/);
      expect(aiChat).toMatch(/4\.\s*Client-side post-filter \/ sort.*messages\[\]\.messageTimestamp.*messages\[\]\.labelIds/);
      expect(aiChat).toMatch(/5\.\s*Hydrate shortlist & context.*fetch_gmail_message.*fetch_gmail_thread.*get_gmail_attachment/);
      expect(aiChat).toMatch(/6\.\s*Mailbox batch updates.*batch_modify_gmail_emails.*GMAIL_BATCH_MODIFY_MESSAGES/);
      expect(aiChat).toMatch(/7\.\s*Retry with broader query \/ sanity-check.*list_gmail_labels.*list_gmail_threads.*GMAIL_FETCH_EMAILS/);
    });

    it("documents the 5 critical pitfalls for fetching unread important emails in system instructions", () => {
      expect(aiChat).toMatch(/5 Critical Pitfalls for Fetching Unread Important Emails/);
      expect(aiChat).toMatch(/1\.\s*Valid no-results state.*messages=\[\]/);
      expect(aiChat).toMatch(/2\.\s*Token progression stop.*nextPageToken may be an empty string.*repeat\/stop changing/);
      expect(aiChat).toMatch(/3\.\s*Defensively parse payload shapes.*truncated\/offloaded/);
      expect(aiChat).toMatch(/4\.\s*Stale ID 404 NOT_FOUND.*GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID.*inaccessible\/stale IDs/);
      expect(aiChat).toMatch(/5\.\s*Batch modify limits & throttling.*max ~1000 message IDs per request.*HTTP 429/);
    });

    it("documents the 7-step thread and replies fetching workflow in system instructions", () => {
      expect(aiChat).toMatch(/Standard 7-Step Workflow for Fetching Email Replies or Full Threads from Gmail/);
      expect(aiChat).toMatch(/1\.\s*Resolve thread linkage.*GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID/);
      expect(aiChat).toMatch(/2\.\s*Discover candidate conversations.*GMAIL_FETCH_EMAILS/);
      expect(aiChat).toMatch(/3\.\s*Shortlist candidate thread IDs.*GMAIL_LIST_THREADS/);
      expect(aiChat).toMatch(/4\.\s*Hydrate conversation.*GMAIL_FETCH_MESSAGE_BY_THREAD_ID/);
      expect(aiChat).toMatch(/5\.\s*Fallback for failure, 413 or mailbox mismatch.*GMAIL_FETCH_EMAILS.*GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID/);
      expect(aiChat).toMatch(/6\.\s*Download attachments.*GMAIL_GET_ATTACHMENT/);
      expect(aiChat).toMatch(/7\.\s*Reply in-thread.*GMAIL_REPLY_TO_THREAD/);
    });

    it("documents the 5 critical pitfalls for fetching email replies or full threads in system instructions", () => {
      expect(aiChat).toMatch(/5 Critical Pitfalls for Fetching Email Replies or Full Threads/);
      expect(aiChat).toMatch(/1\.\s*Valid no-results & empty nextPageToken/);
      expect(aiChat).toMatch(/2\.\s*429 Rate limiting during discovery/);
      expect(aiChat).toMatch(/3\.\s*404 NOT_FOUND mailbox mismatch/);
      expect(aiChat).toMatch(/4\.\s*Unexpected nested response shapes/);
      expect(aiChat).toMatch(/5\.\s*Large thread 413 truncation/);
    });

    it("documents the 7-step connecting workflow and 5 pitfalls in system instructions", () => {
      expect(aiChat).toMatch(/Standard 7-Step Workflow for Connecting to Gmail/);
      expect(aiChat).toMatch(/1\.\s*Confirm mailbox selection.*GMAIL_GET_PROFILE/);
      expect(aiChat).toMatch(/2\.\s*Verify mailbox identity.*GMAIL_GET_PROFILE.*user_id='me'/);
      expect(aiChat).toMatch(/3\.\s*Probe read scope.*GMAIL_LIST_LABELS/);
      expect(aiChat).toMatch(/4\.\s*Validate message listing.*GMAIL_FETCH_EMAILS/);
      expect(aiChat).toMatch(/5\.\s*Hydrate candidate & verify attachments.*GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID.*GMAIL_GET_ATTACHMENT/);
      expect(aiChat).toMatch(/6\.\s*Confirm sending identities.*GMAIL_LIST_SEND_AS/);
      expect(aiChat).toMatch(/7\.\s*Probe contacts access.*GMAIL_GET_PEOPLE/);

      expect(aiChat).toMatch(/5 Critical Pitfalls for Connecting to Gmail/);
      expect(aiChat).toMatch(/1\.\s*Connection\/scope blockers.*ConnectedAccountNotFound/);
      expect(aiChat).toMatch(/2\.\s*Delegation denied.*user_id='me'/);
      expect(aiChat).toMatch(/3\.\s*Nested responses & truncation.*response\.data.*response\.data_preview/);
      expect(aiChat).toMatch(/4\.\s*Restrictive query no-results.*messages=\[\]/);
      expect(aiChat).toMatch(/5\.\s*Per-user query quota.*403 quota exceeded/);
    });

    it("documents the 7-step fetching and searching workflow and 5 pitfalls in system instructions", () => {
      expect(aiChat).toMatch(/Standard 7-Step Workflow for Fetching and Searching Emails from Gmail/);
      expect(aiChat).toMatch(/1\.\s*Resolve labels.*GMAIL_LIST_LABELS/);
      expect(aiChat).toMatch(/2\.\s*Search & list messages.*GMAIL_FETCH_EMAILS/);
      expect(aiChat).toMatch(/3\.\s*Paginate & dedupe.*GMAIL_FETCH_EMAILS/);
      expect(aiChat).toMatch(/4\.\s*Simplified query retry.*GMAIL_FETCH_EMAILS/);
      expect(aiChat).toMatch(/5\.\s*Checkpoint pages.*COMPOSIO_REMOTE_WORKBENCH/);
      expect(aiChat).toMatch(/6\.\s*Hydrate selectively.*GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID.*GMAIL_FETCH_MESSAGE_BY_THREAD_ID.*GMAIL_GET_ATTACHMENT/);
      expect(aiChat).toMatch(/7\.\s*Bulk label changes.*GMAIL_BATCH_MODIFY_MESSAGES/);

      expect(aiChat).toMatch(/5 Critical Pitfalls for Fetching and Searching Emails from Gmail/);
      expect(aiChat).toMatch(/1\.\s*500-cap & falsy token completion/);
      expect(aiChat).toMatch(/2\.\s*Large payload offloading/);
      expect(aiChat).toMatch(/3\.\s*Auth & quota error handling/);
      expect(aiChat).toMatch(/4\.\s*Batch modify schema/);
      expect(aiChat).toMatch(/5\.\s*Invalid attachment token/);
    });

    it("documents the 7-step draft creation workflow and 5 pitfalls in system instructions", () => {
      expect(aiChat).toMatch(/Standard 7-Step Workflow for Creating Draft Email in Gmail/);
      expect(aiChat).toMatch(/1\.\s*Determine mode & recipients.*GMAIL_SEARCH_PEOPLE/);
      expect(aiChat).toMatch(/2\.\s*Checkpoint inputs.*COMPOSIO_REMOTE_WORKBENCH/);
      expect(aiChat).toMatch(/3\.\s*Create draft.*GMAIL_CREATE_EMAIL_DRAFT/);
      expect(aiChat).toMatch(/4\.\s*Validate stored draft.*GMAIL_GET_DRAFT/);
      expect(aiChat).toMatch(/5\.\s*Update draft.*GMAIL_UPDATE_DRAFT/);
      expect(aiChat).toMatch(/6\.\s*Send stored draft.*GMAIL_SEND_DRAFT/);
      expect(aiChat).toMatch(/7\.\s*Fallback recovery.*GMAIL_LIST_DRAFTS.*GMAIL_SEND_EMAIL/);

      expect(aiChat).toMatch(/5 Critical Pitfalls for Creating Draft Email in Gmail/);
      expect(aiChat).toMatch(/1\.\s*Multiple identifiers.*data\.id/);
      expect(aiChat).toMatch(/2\.\s*Recipient validation errors/);
      expect(aiChat).toMatch(/3\.\s*Missing scopes\/precondition/);
      expect(aiChat).toMatch(/4\.\s*Full replace on update/);
      expect(aiChat).toMatch(/5\.\s*Exact stored send/);
    });

    it("documents the 8-step sending workflow and 5 pitfalls in system instructions", () => {
      expect(aiChat).toMatch(/Standard 8-Step Workflow for Sending an Email via Gmail/);
      expect(aiChat).toMatch(/1\.\s*Explicit approval & validation.*GMAIL_SEND_EMAIL/);
      expect(aiChat).toMatch(/2\.\s*Mailbox preflight.*GMAIL_GET_PROFILE/);
      expect(aiChat).toMatch(/3\.\s*Allowed sending identities.*GMAIL_LIST_SEND_AS/);
      expect(aiChat).toMatch(/4\.\s*Send within thread.*GMAIL_REPLY_TO_THREAD/);
      expect(aiChat).toMatch(/5\.\s*Create draft checkpoint.*GMAIL_CREATE_EMAIL_DRAFT/);
      expect(aiChat).toMatch(/6\.\s*Verify & send draft.*GMAIL_GET_DRAFT.*GMAIL_SEND_DRAFT/);
      expect(aiChat).toMatch(/7\.\s*Deliver email.*GMAIL_SEND_EMAIL/);
      expect(aiChat).toMatch(/8\.\s*Error handling & single retry.*GMAIL_SEND_EMAIL/);

      expect(aiChat).toMatch(/5 Critical Pitfalls for Sending an Email via Gmail/);
      expect(aiChat).toMatch(/1\.\s*Non-idempotent sends/);
      expect(aiChat).toMatch(/2\.\s*Persistent permission denied/);
      expect(aiChat).toMatch(/3\.\s*Recipient string shape/);
      expect(aiChat).toMatch(/4\.\s*Surprising identifiers/);
      expect(aiChat).toMatch(/5\.\s*Draft vs message ID/);
    });

    it("documents the 6-step limited unread emails workflow and 5 pitfalls in system instructions", () => {
      expect(aiChat).toMatch(/Standard 6-Step Workflow for Fetching a Limited Number of Unread Emails from Gmail/);
      expect(aiChat).toMatch(/1\.\s*Map label names to IDs.*GMAIL_LIST_LABELS/);
      expect(aiChat).toMatch(/2\.\s*Capped unread listing.*GMAIL_FETCH_EMAILS/);
      expect(aiChat).toMatch(/3\.\s*Paginate & de-dupe.*GMAIL_FETCH_EMAILS/);
      expect(aiChat).toMatch(/4\.\s*Hydrate details.*GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID/);
      expect(aiChat).toMatch(/5\.\s*Bulk updates after confirmation.*GMAIL_BATCH_MODIFY_MESSAGES/);
      expect(aiChat).toMatch(/6\.\s*Sanity-check & retry.*GMAIL_LIST_THREADS.*GMAIL_FETCH_EMAILS/);

      expect(aiChat).toMatch(/5 Critical Pitfalls for Fetching a Limited Number of Unread Emails/);
      expect(aiChat).toMatch(/1\.\s*500 cap & small page tokens/);
      expect(aiChat).toMatch(/2\.\s*Missing or empty messages/);
      expect(aiChat).toMatch(/3\.\s*Verbose payload truncation/);
      expect(aiChat).toMatch(/4\.\s*Multipart payload base64url/);
      expect(aiChat).toMatch(/5\.\s*Batch modify schema & silent skips/);
    });
  });
});

