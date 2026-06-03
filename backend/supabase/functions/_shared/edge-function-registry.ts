export type EdgeFunctionCategory =
  | "chat"
  | "jobs"
  | "applications"
  | "documents"
  | "integrations"
  | "billing"
  | "admin"
  | "system";

export interface EdgeFunctionDefinition {
  name: string;
  category: EdgeFunctionCategory;
  description: string;
  path: string;
  invocableViaAgent?: boolean;
  parameterSchema: Record<string, unknown>;
  notes?: string[];
}

const OPEN_OBJECT_SCHEMA = {
  type: "object",
  additionalProperties: true,
} as const;

export const EDGE_FUNCTIONS: EdgeFunctionDefinition[] = [
  {
    name: "ai-chat",
    category: "chat",
    description: "Primary streaming AI chat endpoint used by the dashboard chat page.",
    path: "/functions/v1/ai-chat",
    invocableViaAgent: false,
    parameterSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
        messages: { type: "array" },
        mode: { type: "string", enum: ["ask", "agent"] },
        webSearch: { type: "boolean" },
        system: { type: "string" },
      },
      required: ["messages"],
      additionalProperties: true,
    },
    notes: ["Not invocable through the agent tool to avoid recursive agent loops."],
  },
  {
    name: "analyze-resume",
    category: "documents",
    description: "Resume analysis endpoint.",
    path: "/functions/v1/analyze-resume",
    parameterSchema: OPEN_OBJECT_SCHEMA,
  },
  {
    name: "apply-to-jobs",
    category: "applications",
    description: "Starts Skyvern-driven application automation for one or more job URLs.",
    path: "/functions/v1/apply-to-jobs",
    parameterSchema: {
      type: "object",
      properties: {
        job_urls: {
          description: "Array of job URLs or a single URL string.",
        },
        jobs: { type: "array" },
        additional_information: { type: "string" },
        resume: { type: "string" },
        resume_text: { type: "string" },
        cover_letter: { type: "string" },
        workflow_id: { type: "string" },
        proxy_location: { type: "string" },
        title: { type: "string" },
        max_steps_override: { type: "number" },
        email: { type: "string" },
      },
      additionalProperties: true,
    },
    notes: ["Consumes automation credits and triggers external automation side effects."],
  },
  {
    name: "calculate-match-score",
    category: "jobs",
    description: "Scores one or more jobs against the user's profile context.",
    path: "/functions/v1/calculate-match-score",
    parameterSchema: {
      type: "object",
      properties: {
        jobs: { type: "array" },
        context: { type: "object" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "composio-gmail-auth",
    category: "integrations",
    description: "Gmail integration auth helper.",
    path: "/functions/v1/composio-gmail-auth",
    parameterSchema: OPEN_OBJECT_SCHEMA,
  },
  {
    name: "evaluate-job-fit",
    category: "jobs",
    description: "Generates a fit evaluation for a job and candidate context.",
    path: "/functions/v1/evaluate-job-fit",
    parameterSchema: {
      type: "object",
      properties: {
        jobId: { type: "string" },
        jobTitle: { type: "string" },
        company: { type: "string" },
        jobDescription: { type: "string" },
        profileSnapshot: { type: "string" },
        resumeText: { type: "string" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "firecrawl-health",
    category: "system",
    description: "Firecrawl provider health probe.",
    path: "/functions/v1/firecrawl-health",
    parameterSchema: OPEN_OBJECT_SCHEMA,
  },
  {
    name: "generate-cover-letter",
    category: "documents",
    description: "Creates a tailored cover letter from a job description and resume text.",
    path: "/functions/v1/generate-cover-letter",
    parameterSchema: {
      type: "object",
      properties: {
        jobDescription: { type: "string" },
        resumeText: { type: "string" },
        instructions: { type: "string" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "generate-title",
    category: "chat",
    description: "Creates a short title for a chat session.",
    path: "/functions/v1/generate-title",
    parameterSchema: {
      type: "object",
      properties: {
        message: { type: "string" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "get-jobs",
    category: "jobs",
    description: "Fetches jobs from the user's jobs dataset.",
    path: "/functions/v1/get-jobs",
    parameterSchema: OPEN_OBJECT_SCHEMA,
  },
  {
    name: "get-interview-prompt",
    category: "documents",
    description: "Generates or fetches interview prompt content.",
    path: "/functions/v1/get-interview-prompt",
    parameterSchema: OPEN_OBJECT_SCHEMA,
  },
  {
    name: "gmail-auth",
    category: "integrations",
    description: "Gmail OAuth connection helper.",
    path: "/functions/v1/gmail-auth",
    parameterSchema: OPEN_OBJECT_SCHEMA,
  },
  {
    name: "init-payment",
    category: "billing",
    description: "Initializes checkout or payment flow.",
    path: "/functions/v1/init-payment",
    parameterSchema: OPEN_OBJECT_SCHEMA,
    notes: ["Mutates billing state and may create provider-side payment intents."],
  },
  {
    name: "intake-job-url",
    category: "jobs",
    description: "Ingests a raw job posting URL, extracts the posting, and stores/evaluates it.",
    path: "/functions/v1/intake-job-url",
    parameterSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        profileSnapshot: { type: "string" },
        resumeText: { type: "string" },
      },
      required: ["url"],
      additionalProperties: true,
    },
  },
  {
    name: "interview-session",
    category: "documents",
    description: "Interview practice/session endpoint.",
    path: "/functions/v1/interview-session",
    parameterSchema: OPEN_OBJECT_SCHEMA,
  },
  {
    name: "jobs-cron",
    category: "jobs",
    description: "Background jobs refresh/cron endpoint.",
    path: "/functions/v1/jobs-cron",
    parameterSchema: OPEN_OBJECT_SCHEMA,
  },
  {
    name: "jobs-search",
    category: "jobs",
    description: "Searches or imports jobs into the user's queue.",
    path: "/functions/v1/jobs-search",
    parameterSchema: {
      type: "object",
      properties: {
        searchQuery: { type: "string" },
        location: { type: "string" },
        limit: { type: "number" },
        sources: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional source focus: web, ats, yc, x, reddit, hackernews, community. X/Twitter uses public/indexed pages only.",
        },
        locationScope: { type: "string", enum: ["city", "country", "global"] },
      },
      additionalProperties: true,
    },
  },
  {
    name: "list-users",
    category: "admin",
    description: "Administrative user listing function.",
    path: "/functions/v1/list-users",
    parameterSchema: OPEN_OBJECT_SCHEMA,
  },
  {
    name: "admin-delete-user",
    category: "admin",
    description: "Deletes an auth user and cascaded public data (admin only). Body: { userId }.",
    path: "/functions/v1/admin-delete-user",
    parameterSchema: {
      type: "object",
      properties: { userId: { type: "string" } },
      required: ["userId"],
      additionalProperties: false,
    },
  },
  {
    name: "parse-resume",
    category: "documents",
    description: "Resume parsing endpoint.",
    path: "/functions/v1/parse-resume",
    parameterSchema: OPEN_OBJECT_SCHEMA,
  },
  {
    name: "paystack-webhook",
    category: "billing",
    description: "Payment-provider webhook receiver for Paystack.",
    path: "/functions/v1/paystack-webhook",
    parameterSchema: OPEN_OBJECT_SCHEMA,
    notes: ["Usually driven by provider payloads rather than manual agent invocation."],
  },
  {
    name: "polish-content",
    category: "documents",
    description: "Improves or rewrites professional text.",
    path: "/functions/v1/polish-content",
    parameterSchema: {
      type: "object",
      properties: {
        content: { type: "string" },
        instruction: { type: "string" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "process-job-search",
    category: "jobs",
    description: "Processes broader job-search workflows.",
    path: "/functions/v1/process-job-search",
    parameterSchema: OPEN_OBJECT_SCHEMA,
  },
  {
    name: "provider-credits",
    category: "admin",
    description: "Provider credit status and management endpoint.",
    path: "/functions/v1/provider-credits",
    parameterSchema: OPEN_OBJECT_SCHEMA,
  },
  {
    name: "proxy-image",
    category: "system",
    description: "Image proxy helper.",
    path: "/functions/v1/proxy-image",
    parameterSchema: OPEN_OBJECT_SCHEMA,
  },
  {
    name: "proxy-resume",
    category: "system",
    description: "Resume proxy endpoint for externally fetchable resume downloads.",
    path: "/functions/v1/proxy-resume",
    parameterSchema: OPEN_OBJECT_SCHEMA,
    notes: ["Primarily used as a GET endpoint with a signed token."],
  },
  {
    name: "referrals-agent",
    category: "applications",
    description: "Referral discovery or referral-agent workflow.",
    path: "/functions/v1/referrals-agent",
    parameterSchema: OPEN_OBJECT_SCHEMA,
  },
  {
    name: "schedule-interview",
    category: "applications",
    description: "Parses interview emails and drafts interview-booking replies.",
    path: "/functions/v1/schedule-interview",
    parameterSchema: {
      type: "object",
      properties: {
        emailText: { type: "string" },
        applicantName: { type: "string" },
        companyName: { type: "string" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "skyvern-webhook",
    category: "applications",
    description: "Receives Skyvern workflow completion and status webhooks.",
    path: "/functions/v1/skyvern-webhook",
    parameterSchema: OPEN_OBJECT_SCHEMA,
    notes: ["Usually driven by provider payloads rather than manual agent invocation."],
  },
  {
    name: "sync-gmail-application-events",
    category: "applications",
    description: "Scans Gmail for application pipeline events and updates tracked applications.",
    path: "/functions/v1/sync-gmail-application-events",
    parameterSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        maxResults: { type: "number" },
        force: { type: "boolean" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "sync-provider-status",
    category: "applications",
    description: "Refreshes the latest provider status for a given automation run.",
    path: "/functions/v1/sync-provider-status",
    parameterSchema: {
      type: "object",
      properties: {
        run_id: { type: "string" },
      },
      required: ["run_id"],
      additionalProperties: true,
    },
  },
  {
    name: "tailor-resume",
    category: "documents",
    description: "Tailors a resume to a target job description.",
    path: "/functions/v1/tailor-resume",
    parameterSchema: {
      type: "object",
      properties: {
        jobDescription: { type: "string" },
        resumeText: { type: "string" },
        instructions: { type: "string" },
      },
      additionalProperties: true,
    },
  },
];

export function getEdgeFunctionDefinition(
  name: string | null | undefined,
): EdgeFunctionDefinition | null {
  if (!name) return null;
  const normalized = name.trim().toLowerCase();
  return (
    EDGE_FUNCTIONS.find((entry) => entry.name.toLowerCase() === normalized) ||
    null
  );
}
