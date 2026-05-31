// Clean AI-elements only Chat Page implementation
import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type Dispatch,
  type SetStateAction,
} from "react";
import { flushSync } from "react-dom";
import { nanoid } from "nanoid";
import SyntaxHighlighter from "react-syntax-highlighter/dist/esm/light";
import atomOneDarkStyle from "react-syntax-highlighter/dist/esm/styles/hljs/atom-one-dark";
import js from "react-syntax-highlighter/dist/esm/languages/hljs/javascript";
import ts from "react-syntax-highlighter/dist/esm/languages/hljs/typescript";
import python from "react-syntax-highlighter/dist/esm/languages/hljs/python";
import bash from "react-syntax-highlighter/dist/esm/languages/hljs/bash";
import json from "react-syntax-highlighter/dist/esm/languages/hljs/json";
import css from "react-syntax-highlighter/dist/esm/languages/hljs/css";
import sql from "react-syntax-highlighter/dist/esm/languages/hljs/sql";
import xml from "react-syntax-highlighter/dist/esm/languages/hljs/xml";

SyntaxHighlighter.registerLanguage("javascript", js);
SyntaxHighlighter.registerLanguage("js", js);
SyntaxHighlighter.registerLanguage("typescript", ts);
SyntaxHighlighter.registerLanguage("ts", ts);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("shell", bash);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("css", css);
SyntaxHighlighter.registerLanguage("sql", sql);
SyntaxHighlighter.registerLanguage("html", xml);
SyntaxHighlighter.registerLanguage("xml", xml);
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from "recharts";
import { useNavigate } from "react-router-dom";
import { createClient } from "../../../lib/supabaseClient";
import {
  cacheChatAttachments,
  getChatAttachment,
} from "../../../lib/chatAttachmentIdb";
import {
  generateChatStarters,
  type ChatStarterIcon,
  type ChatStarterSuggestion,
} from "../../../services/ai/generateChatStarters";
import { ChatSkillCommandPalette } from "@/components/chat/ChatSkillCommandPalette";
import {
  executeChatSkill,
  getPrimarySkillAlias,
  getSkillById,
  getSkillSuggestions,
} from "@/lib/chatSkills/registry";
import {
  detectSkillPaletteTrigger,
  parseSkillCall,
  replaceSkillPaletteTrigger,
} from "@/lib/chatSkills/parser";
import type { ChatSkillCall, ParsedSkillCall } from "@/lib/chatSkills/types";
import {
  MessageSquare,
  Wand2,
  Target,
  FileText,
  Sparkles,
  Zap,
  Plus,
  Search,
  Trash2,
  Edit2,
  Bot,
  Bolt,
  BookOpen,
  Paperclip,
  ArrowUp,
  ArrowDown,
  PanelLeft,
  X,
  Coins,
  History,
  Brain,
  ReceiptText,
  AlertTriangle,
  ListChecks,
  ChevronDown,
  Mic,
  Loader2,
} from "lucide-react";
import { UpgradePrompt } from "../../../components/UpgradePrompt";
import { useToast } from "../../../components/ui/toast-provider";
import { useSubscriptionTier } from "@/hooks/useSubscriptionTier";
import { hasSubscriptionAccess } from "@/lib/subscriptionAccess";
import { motion } from "framer-motion";

// Custom styles for the new design
const customStyles = `
  .glass-panel {
    background: hsl(var(--card) / 0.72);
    backdrop-filter: blur(12px);
    border: 1px solid hsl(var(--border) / 0.7);
  }
  .suggestion-card:hover {
    border-color: hsl(var(--brand) / 0.55);
    background: hsl(var(--brand) / 0.08);
  }
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: hsl(var(--border) / 0.85);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--foreground) / 0.2);
  }
`;

const waitForAgentProgressPaint = () =>
  new Promise<void>((resolve) => {
    // A real frame boundary keeps SSE updates visible even when many frames
    // arrive in one network chunk and React would otherwise look "dumped".
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.setTimeout(resolve, 35));
    });
  });

const parseSseFrame = (frame: string) => {
  let event = "message";
  const dataLines: string[] = [];

  for (const rawLine of frame.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      event = line.slice(6).trim() || "message";
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (!dataLines.length) return null;
  return {
    event,
    data: dataLines.join("\n"),
  };
};

const parseSseData = (dataStr: string) => {
  if (dataStr === "[DONE]") return null;
  try {
    return JSON.parse(dataStr);
  } catch (error) {
    console.warn("[ai-chat] Could not parse SSE frame", {
      data: dataStr.slice(0, 240),
      error,
    });
    return null;
  }
};

// Real-deal streaming useChat hook
type Persona = "concise" | "friendly" | "analyst" | "coach";
type ChatMode = "ask" | "agent";
type ChatRequestOptions = {
  model?: string;
  webSearch?: boolean;
  system?: string;
  mode?: ChatMode;
};
type ChatUiAction = {
  type?: string;
  route?: string;
  replace?: boolean;
  pageId?: string | null;
  pageTitle?: string | null;
};
interface ToolCallEntry {
  id?: string;
  name: string;
  args?: Record<string, unknown>;
  status: "running" | "done" | "error";
  result?: Record<string, unknown>;
  startedAt?: number;
  finishedAt?: number;
  creditsCharged?: number;
}
interface AgentActivityEntry {
  id: string;
  kind:
    | "thinking"
    | "tool_batch"
    | "tool_result"
    | "billing"
    | "limit"
    | "status"
    | "error";
  title: string;
  detail?: string;
  status: "running" | "done" | "error";
  createdAt: number;
  finishedAt?: number;
  round?: number;
  creditsCharged?: number;
  toolCount?: number;
}
interface BasicMessage {
  id: string;
  role: "user" | "assistant" | "skill";
  content: string;
  parts?: { type: "text"; text: string }[];
  streaming?: boolean;
  createdAt: number;
  meta?: { persona?: Persona; parent?: string };
  toolCalls?: ToolCallEntry[];
  agentEvents?: AgentActivityEntry[];
  streamFrameCount?: number;
  skillCall?: ChatSkillCall;
  /** Persisted: user message included an image (bytes live in IndexedDB). */
  hasPastedImage?: boolean;
  attachmentCount?: number;
}

type ChatUserPayload = {
  role: "user";
  content: string;
  images?: { mimeType: string; data: string; name?: string }[];
};
interface UseChatOptions {
  api: string;
  initialMessages?: BasicMessage[];
  onFinish?: (msg: BasicMessage) => void;
  /** Fired when agent mode charges extra credits for tool use */
  onCreditsUpdated?: () => void;
  onUiAction?: (action: ChatUiAction) => void;
}
interface UseChatReturn {
  messages: BasicMessage[];
  status: "idle" | "in_progress";
  append: (m: ChatUserPayload, opts?: ChatRequestOptions) => void;
  regenerate: () => void;
  stop: () => void;
  setMessages: Dispatch<SetStateAction<BasicMessage[]>>;
  responseId: string | null;
  setResponseId: (id: string | null) => void;
  requestStartedAt: number | null;
}

type ChatSessionRecord = {
  id: string;
  title?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  messages?: unknown;
  response_id?: string | null;
  responseId?: string | null;
  persona?: string | null;
  model?: string | null;
};

type ChatSessionState = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  created_at?: string;
  updated_at?: string;
  messages: BasicMessage[];
  responseId?: string | null;
  persona?: string | null;
  model?: string | null;
};

const DEFAULT_CHAT_MODEL = "gemini-3-flash-preview";
const MAX_CHAT_ATTACHMENTS = 3;
const CHAT_EXTENDED_WAIT_MS = 30_000;
const CHAT_TIMEOUT_MS = 30 * 60_000;

// Fallback starters removed in favor of dynamic AI suggestions and skeleton loaders.

const CHAT_STARTER_ICONS: Record<
  ChatStarterIcon,
  React.ComponentType<{ className?: string }>
> = {
  resume: FileText,
  jobs: Search,
  interview: MessageSquare,
  "cover-letter": BookOpen,
  applications: Target,
  strategy: Bolt,
};

const normalizeBasicMessage = (message: any): BasicMessage => ({
  id: typeof message?.id === "string" ? message.id : nanoid(),
  role:
    message?.role === "assistant" || message?.role === "skill"
      ? message.role
      : "user",
  content: typeof message?.content === "string" ? message.content : "",
  parts:
    Array.isArray(message?.parts) && message.parts.length > 0
      ? message.parts
      : [
          {
            type: "text" as const,
            text: typeof message?.content === "string" ? message.content : "",
          },
        ],
  streaming: Boolean(message?.streaming),
  createdAt:
    typeof message?.createdAt === "number" ? message.createdAt : Date.now(),
  meta:
    message?.meta && typeof message.meta === "object"
      ? message.meta
      : undefined,
  toolCalls: Array.isArray(message?.toolCalls)
    ? message.toolCalls
        .filter((entry: any) => entry && typeof entry.name === "string")
        .map((entry: any) => ({
          id: typeof entry.id === "string" ? entry.id : undefined,
          name: entry.name,
          args:
            entry.args && typeof entry.args === "object"
              ? (entry.args as Record<string, unknown>)
              : undefined,
          status:
            entry.status === "running" ||
            entry.status === "error" ||
            entry.status === "done"
              ? entry.status
              : "done",
          result:
            entry.result && typeof entry.result === "object"
              ? (entry.result as Record<string, unknown>)
              : undefined,
          startedAt:
            typeof entry.startedAt === "number" ? entry.startedAt : undefined,
          finishedAt:
            typeof entry.finishedAt === "number"
              ? entry.finishedAt
              : undefined,
          creditsCharged:
            typeof entry.creditsCharged === "number"
              ? entry.creditsCharged
              : undefined,
        }))
    : undefined,
  agentEvents: Array.isArray(message?.agentEvents)
    ? message.agentEvents
        .filter((entry: any) => entry && typeof entry.title === "string")
        .map((entry: any) => ({
          id: typeof entry.id === "string" ? entry.id : nanoid(),
          kind:
            entry.kind === "thinking" ||
            entry.kind === "tool_batch" ||
            entry.kind === "tool_result" ||
            entry.kind === "billing" ||
            entry.kind === "limit" ||
            entry.kind === "error"
              ? entry.kind
              : "status",
          title: entry.title,
          detail: typeof entry.detail === "string" ? entry.detail : undefined,
          status:
            entry.status === "running" ||
            entry.status === "error" ||
            entry.status === "done"
              ? entry.status
              : "done",
          createdAt:
            typeof entry.createdAt === "number" ? entry.createdAt : Date.now(),
          finishedAt:
            typeof entry.finishedAt === "number"
              ? entry.finishedAt
              : undefined,
          round: typeof entry.round === "number" ? entry.round : undefined,
          creditsCharged:
            typeof entry.creditsCharged === "number"
              ? entry.creditsCharged
              : undefined,
          toolCount:
            typeof entry.toolCount === "number" ? entry.toolCount : undefined,
        }))
    : undefined,
  skillCall:
    message?.skillCall && typeof message.skillCall === "object"
      ? (message.skillCall as ChatSkillCall)
      : undefined,
  hasPastedImage: Boolean(message?.hasPastedImage),
  attachmentCount:
    typeof message?.attachmentCount === "number"
      ? message.attachmentCount
      : undefined,
});

const toolDisplayName = (
  name: string,
  args?: Record<string, unknown>,
): string => {
  const query = String(args?.query || "").trim();
  const title = String(args?.title || args?.job_title || "").trim();
  const company = String(args?.company || "").trim();

  const labels: Record<string, string> = {
    get_account_snapshot: "Read account snapshot",
    run_job_search: query ? `Search jobs: "${query}"` : "Search jobs",
    search_public_job_sources: query
      ? `Search public job sources: "${query}"`
      : "Search public job sources",
    get_user_profile: "Read profile",
    list_profile_records: "List profile records",
    get_public_profile_site: "Read public portfolio",
    update_public_profile_site: "Update public portfolio",
    list_answer_bank_entries: "Read Answer Bank",
    add_answer_bank_entry: "Save Answer Bank entry",
    update_answer_bank_entry: "Update Answer Bank entry",
    delete_answer_bank_entry: "Delete Answer Bank entry",
    generate_answer_bank_entries: "Generate Answer Bank entries",
    list_applications: "List applications",
    create_application_tracker_entry:
      title && company
        ? `Track application: ${title} at ${company}`
        : "Create application tracker entry",
    find_company_contact_channels: "Find hiring contact channels",
    refresh_application_processes: "Refresh application processes",
    list_resumes: "List resumes",
    get_credits_balance: "Check credits",
    list_recent_jobs: "List recent jobs",
    list_app_pages: "Read app pages",
    open_app_page: "Open app page",
    apply_to_job: title ? `Apply to job: ${title}` : "Start application",
    auto_apply_from_url: "Start URL auto-apply",
    reapply_job: "Retry application automation",
    analyze_resume: "Analyze resume",
    generate_cover_letter: "Generate cover letter",
    evaluate_job_fit: "Evaluate job fit",
    intake_job_url: "Import job URL",
    update_profile: "Update profile",
    add_skill: `Add skill${args?.name ? `: ${String(args.name)}` : ""}`,
    remove_skill: `Remove skill${args?.name ? `: ${String(args.name)}` : ""}`,
    add_experience:
      title && company
        ? `Add experience: ${title} at ${company}`
        : "Add experience",
    update_experience: "Update experience",
    delete_experience: "Delete experience",
    add_education: "Add education",
    update_education: "Update education",
    delete_education: "Delete education",
    save_cover_letter: args?.name
      ? `Save cover letter: ${String(args.name)}`
      : "Save cover letter",
    update_resume: "Update resume",
    update_application_status: args?.status
      ? `Move application to ${String(args.status)}`
      : "Update application status",
    update_application: "Update application",
    delete_application: "Delete application",
    bookmark_job: args?.bookmarked ? "Bookmark job" : "Remove job bookmark",
    hide_job: "Dismiss job",
    polish_content: "Polish content",
    list_edge_functions: "List edge functions",
    get_edge_function_details: "Inspect edge function",
    invoke_edge_function: "Invoke edge function",
    list_database_schema: "Inspect database schema",
    search_gmail_job_emails: "Search job-related Gmail",
    create_gmail_job_draft: "Create Gmail draft",
    send_gmail_job_email: "Send Gmail email",
    label_gmail_job_emails: "Label Gmail messages",
    semantic_search: query ? `Semantic search: "${query}"` : "Semantic search",
    get_profile_graph_proof_paths: "Trace profile proof paths",
    create_reminder: "Create reminder",
  };

  return labels[name] || name.replace(/_/g, " ");
};

const getToolResultPayload = (
  result?: Record<string, unknown>,
): Record<string, unknown> => {
  if (
    result?.data &&
    typeof result.data === "object" &&
    !Array.isArray(result.data)
  ) {
    return result.data as Record<string, unknown>;
  }
  return result || {};
};

const getToolResultError = (result?: Record<string, unknown>) => {
  const payload = getToolResultPayload(result);
  return typeof payload.error === "string"
    ? payload.error
    : typeof result?.error === "string"
      ? result.error
      : typeof payload.message === "string" && payload.success === false
        ? payload.message
        : null;
};

const isInternalToolFailure = (entry: ToolCallEntry) => {
  const error = getToolResultError(entry.result);
  if (!error) return false;
  return (
    /jobDescription and resumeText are required/i.test(error) ||
    /missing required fields:\s*resumeText,\s*profileSummary/i.test(error) ||
    /invalid response structure from Gemini embedContent/i.test(error) ||
    /took longer than \d+ seconds/i.test(error) ||
    /stopped waiting/i.test(error) ||
    /required$/i.test(error)
  );
};

const summarizeToolResult = (entry: ToolCallEntry): string | undefined => {
  const result = getToolResultPayload(entry.result);
  const error = getToolResultError(entry.result);
  if (isInternalToolFailure(entry)) return undefined;
  if (error) return error.slice(0, 160);

  const imported =
    Number(result.imported_count ?? result.imported ?? result.saved_count) || 0;
  const count =
    imported ||
    (Array.isArray(result.jobs) ? result.jobs.length : 0) ||
    (Array.isArray(result.results) ? result.results.length : 0) ||
    (Array.isArray(result.applications) ? result.applications.length : 0) ||
    (Array.isArray(result.resumes) ? result.resumes.length : 0);

  if (
    entry.name === "run_job_search" ||
    entry.name === "search_public_job_sources"
  ) {
    return count > 0
      ? `${count} job${count === 1 ? "" : "s"} found or saved`
      : "Search completed";
  }
  if (entry.name === "get_credits_balance") {
    const turns = Number(result.total_available_chat_turns);
    const paid = Number(result.paid_ai_credit_balance);
    if (!Number.isNaN(turns) && turns > 0) {
      return `${turns} total chat turn${turns === 1 ? "" : "s"} available`;
    }
    if (!Number.isNaN(paid)) {
      return `${paid} paid credit${paid === 1 ? "" : "s"} available`;
    }
  }
  return undefined;
};

const buildAgentFinalFallback = (message: BasicMessage): string | undefined => {
  const completedTools = (message.toolCalls || []).filter(
    (tool) => tool.status !== "running",
  );
  if (!completedTools.length) return undefined;
  const hiddenNoopTools = new Set([
    "list_applications",
    "list_notifications",
    "refresh_application_processes",
    "search_gmail_job_emails",
    "label_gmail_job_emails",
    "semantic_search",
    "list_profile_records",
    "list_recent_jobs",
    "get_account_snapshot",
    "evaluate_job_fit",
    "analyze_resume",
    "polish_content",
    "invoke_edge_function",
  ]);

  const jobResults = completedTools
    .filter(
      (tool) =>
        tool.name === "run_job_search" ||
        tool.name === "search_public_job_sources",
    )
    .flatMap((tool) => {
      const payload = getToolResultPayload(tool.result);
      const jobs = Array.isArray(payload.jobs)
        ? payload.jobs
        : Array.isArray(payload.results)
          ? payload.results
          : [];
      return jobs
        .filter(
          (job): job is Record<string, unknown> =>
            Boolean(job) && typeof job === "object" && !Array.isArray(job),
        )
        .map((job) => ({
          title:
            typeof job.title === "string" && job.title.trim()
              ? job.title.trim()
              : "Untitled role",
          company:
            typeof job.company === "string" && job.company.trim()
              ? job.company.trim()
              : "Unknown company",
          location:
            typeof job.location === "string" && job.location.trim()
              ? job.location.trim()
              : "",
          url:
            typeof job.url === "string" && job.url.trim()
              ? job.url.trim()
              : "",
          verification:
            typeof job.verification_status === "string" &&
            job.verification_status.trim()
              ? job.verification_status.trim()
              : "",
        }));
    });

  const uniqueJobs = Array.from(
    new Map(
      jobResults.map((job) => [
        `${job.title}|${job.company}|${job.url}`,
        job,
      ]),
    ).values(),
  ).slice(0, 8);

  const contactResults = completedTools
    .filter((tool) => tool.name === "find_company_contact_channels")
    .flatMap((tool) => {
      const payload = getToolResultPayload(tool.result);
      return Array.isArray(payload.contacts) ? payload.contacts : [];
    })
    .filter(
      (contact): contact is Record<string, unknown> =>
        Boolean(contact) &&
        typeof contact === "object" &&
        !Array.isArray(contact),
    )
    .filter((contact) => {
      const confidence =
        typeof contact.confidence === "string"
          ? contact.confidence.toLowerCase()
          : "";
      return (
        contact.safeToDraft === true ||
        confidence === "high" ||
        confidence === "medium"
      );
    })
    .slice(0, 8);

  const lines: string[] = [];
  if (uniqueJobs.length) {
    lines.push(
      `I found ${uniqueJobs.length} job lead${uniqueJobs.length === 1 ? "" : "s"} from the tool results:`,
      "",
      ...uniqueJobs.map((job) => {
        const meta = [job.company, job.location, job.verification]
          .filter(Boolean)
          .join(" - ");
        return `- ${job.title}${meta ? ` (${meta})` : ""}${job.url ? `: ${job.url}` : ""}`;
      }),
    );
  }

  if (contactResults.length) {
    if (lines.length) lines.push("");
    lines.push(
      `I also found ${contactResults.length} company contact channel${contactResults.length === 1 ? "" : "s"} for review:`,
      "",
      ...contactResults.map((contact) => {
        const company =
          typeof contact.companyName === "string"
            ? contact.companyName
            : "Company";
        const email =
          typeof contact.contactEmail === "string"
            ? contact.contactEmail
            : "no email found";
        const confidence =
          typeof contact.confidence === "string"
            ? `, ${contact.confidence} confidence`
            : "";
        return `- ${company}: ${email}${confidence}`;
      }),
    );
  }

  if (!lines.length) {
    const summaries = completedTools
      .filter((tool) => !hiddenNoopTools.has(tool.name))
      .map((tool) => {
        const payload = getToolResultPayload(tool.result);
        const count = Number(payload.count);
        if (Number.isFinite(count) && count <= 0) return undefined;
        return summarizeToolResult(tool);
      })
      .filter(Boolean);
    if (!summaries.length) {
      return "I checked the available JobRaker data, but I did not find a new actionable result to show yet. Tell me to continue and I will keep working from the last step.";
    }
    lines.push("I found these actionable results:", "");
    summaries.forEach((summary) => lines.push(`- ${summary}`));
  }

  return lines.join("\n");
};

const estimateAgentTimeSavedMinutes = (message: BasicMessage): number => {
  const completedToolCount = (message.toolCalls || []).filter(
    (tool) => tool.status !== "running" && !isInternalToolFailure(tool),
  ).length;
  const chargedCredits = (message.agentEvents || []).reduce(
    (sum, event) => sum + (event.creditsCharged || 0),
    0,
  );
  const workUnits = Math.max(completedToolCount, chargedCredits);
  return workUnits > 0 ? Math.min(180, Math.max(8, workUnits * 8)) : 0;
};

const AgentWorkTimeline = ({
  message,
  elapsedLabel,
}: {
  message: BasicMessage;
  elapsedLabel: string;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const toolCalls = message.toolCalls || [];
  const agentEvents = message.agentEvents || [];

  const skillCall = message.skillCall;
  const isSkillCall = !!skillCall;
  const isStreaming =
    message.streaming ||
    (isSkillCall &&
      (skillCall.status === "running" || skillCall.status === "queued"));

  const skillRows: {
    id: string;
    at: number;
    kind: string;
    status: "running" | "done" | "error";
    label: string;
  }[] = [];

  if (skillCall) {
    const progressList = skillCall.progress || [];
    progressList.forEach((step, index) => {
      const isLastStep = index === progressList.length - 1;
      let stepStatus: "running" | "done" | "error" = "done";
      if (isLastStep) {
        if (skillCall.status === "running" || skillCall.status === "queued") {
          stepStatus = "running";
        } else if (skillCall.status === "failed") {
          stepStatus = "error";
        }
      }

      skillRows.push({
        id: `skill-step-${index}-${step}`,
        at: message.createdAt + index * 10,
        kind: stepStatus === "running" ? "thinking" : "limit",
        status: stepStatus,
        label: step,
      });
    });

    if (skillCall.status === "completed") {
      skillRows.push({
        id: `skill-completed`,
        at: message.createdAt + progressList.length * 10 + 5,
        kind: "billing",
        status: "done",
        label:
          "Agent completed work using 1 credit - Ran 1 work step for this task. Estimated time saved: 8 minutes. Balance: updated.",
      });
    } else if (skillCall.status === "failed") {
      skillRows.push({
        id: `skill-failed`,
        at: message.createdAt + progressList.length * 10 + 5,
        kind: "error",
        status: "error",
        label: skillCall.error || "Skill execution failed",
      });
    }
  }

  const timelineRows = isSkillCall
    ? skillRows
    : [
        ...agentEvents
          .filter((event) =>
            ["thinking", "billing", "limit", "error"].includes(event.kind),
          )
          .map((event) => ({
            id: event.id,
            at: event.createdAt,
            kind: event.kind,
            status: event.status,
            label:
              event.kind === "billing"
                ? [event.title, event.detail].filter(Boolean).join(" - ")
                : event.kind === "thinking" && event.detail
                  ? `Thinking: ${event.detail}`
                  : event.detail
                    ? `${event.title} - ${event.detail}`
                    : event.title,
          })),
        ...toolCalls
          .filter((tool) => !isInternalToolFailure(tool))
          .map((tool) => {
            const resultSummary = summarizeToolResult(tool);
            const prefix =
              tool.status === "running"
                ? "Running"
                : tool.status === "error"
                  ? "Failed"
                  : "Finished";
            return {
              id: tool.id || `${tool.name}-${tool.startedAt || ""}`,
              at: tool.startedAt || tool.finishedAt || 0,
              kind: "tool",
              status: tool.status,
              label: [
                `${prefix} ${toolDisplayName(tool.name, tool.args)}`,
                resultSummary,
              ]
                .filter(Boolean)
                .join(" - "),
            };
          }),
      ]
        .sort((a, b) => a.at - b.at)
        .slice(-50);

  const hiddenStepCount = isSkillCall
    ? 0
    : Math.max(0, agentEvents.length + toolCalls.length - timelineRows.length);
  const totalStepCount = isSkillCall
    ? timelineRows.length
    : agentEvents.length + toolCalls.length;
  const estimatedTimeSaved = isSkillCall
    ? Math.min(180, Math.max(8, (skillCall.progress?.length || 1) * 8))
    : estimateAgentTimeSavedMinutes(message);
  const latestRow = timelineRows[timelineRows.length - 1];
  const fallbackLabel = elapsedLabel
    ? `Connecting to JobRaker agent (${elapsedLabel})`
    : "Connecting to JobRaker agent";
  const summaryLabel = latestRow?.label || fallbackLabel;
  const stepLabel =
    totalStepCount > 0
      ? `${totalStepCount} step${totalStepCount === 1 ? "" : "s"}`
      : "Waiting";

  if (!timelineRows.length && !isStreaming) return null;

  const rowClass =
    "flex max-w-full items-center gap-2 rounded-lg border border-brand/20 bg-brand/[0.06] px-3 py-2 text-[13px] leading-5 text-muted-foreground";
  const iconForRow = (row: { kind: string; status: string }) => {
    if (row.status === "error") {
      return <AlertTriangle className='h-3.5 w-3.5 shrink-0 text-red-400' />;
    }
    if (row.status === "running") {
      return <Loader2 className='h-3.5 w-3.5 shrink-0 animate-spin text-brand' />;
    }
    if (row.kind === "thinking") {
      return <Brain className='h-3.5 w-3.5 shrink-0 text-brand' />;
    }
    if (row.kind === "billing") {
      return <ReceiptText className='h-3.5 w-3.5 shrink-0 text-brand' />;
    }
    if (row.kind === "limit") {
      return <ListChecks className='h-3.5 w-3.5 shrink-0 text-brand' />;
    }
    return <span className='h-1.5 w-1.5 shrink-0 rounded-full bg-brand' />;
  };

  return (
    <div className='mb-3 space-y-2'>
      <button
        type='button'
        onClick={() => setExpanded((value) => !value)}
        className={`${rowClass} w-full text-left transition-colors hover:bg-brand/[0.09]`}
        aria-expanded={expanded}
      >
        <ListChecks className='h-3.5 w-3.5 shrink-0 text-brand' />
        <span className='shrink-0 font-medium text-foreground/80'>
          Working process
        </span>
        <span className='shrink-0 text-muted-foreground/70'>-</span>
        <span className='shrink-0'>{stepLabel}</span>
        {estimatedTimeSaved > 0 ? (
          <>
            <span className='hidden shrink-0 text-muted-foreground/70 md:inline'>
              -
            </span>
            <span className='hidden shrink-0 text-brand/90 md:inline'>
              ~{estimatedTimeSaved} min saved
            </span>
          </>
        ) : null}
        <span className='hidden shrink-0 text-muted-foreground/70 sm:inline'>
          -
        </span>
        <span className='min-w-0 flex-1 truncate text-muted-foreground/80'>
          {summaryLabel}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {expanded && (
        <div className='space-y-2'>
          {timelineRows.map((row) => {
            const isRowExpanded = !!expandedRows[row.id];
            return (
              <div
                key={row.id}
                onClick={() => {
                  setExpandedRows((prev) => ({
                    ...prev,
                    [row.id]: !prev[row.id],
                  }));
                }}
                className={`${rowClass} cursor-pointer hover:bg-brand/[0.09] transition-colors ${
                  isRowExpanded ? "items-start" : "items-center"
                }`}
                title={row.label}
              >
                {iconForRow(row)}
                <span
                  className={
                    isRowExpanded
                      ? "break-words whitespace-pre-wrap flex-1 text-left"
                      : "truncate flex-1 text-left"
                  }
                >
                  {row.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {expanded && hiddenStepCount > 0 && (
        <div className={rowClass}>
          <ListChecks className='h-3.5 w-3.5 shrink-0 text-brand' />
          <span className='truncate'>
            +{hiddenStepCount} earlier working step
            {hiddenStepCount === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {expanded && isStreaming && timelineRows.length === 0 && (
        <div className={rowClass}>
          <Brain className='h-3.5 w-3.5 shrink-0 text-brand' />
          <span className='truncate'>{fallbackLabel}</span>
        </div>
      )}
    </div>
  );
};

const AgentResultPreview = ({ message }: { message: BasicMessage }) => {
  if (!message.streaming) return null;

  const jobResults = (message.toolCalls || [])
    .filter(
      (tool) =>
        tool.status !== "running" &&
        (tool.name === "run_job_search" ||
          tool.name === "search_public_job_sources"),
    )
    .flatMap((tool) => {
      const payload = getToolResultPayload(tool.result);
      const jobs = Array.isArray(payload.jobs)
        ? payload.jobs
        : Array.isArray(payload.results)
          ? payload.results
          : [];
      return jobs
        .filter(
          (job): job is Record<string, unknown> =>
            Boolean(job) && typeof job === "object" && !Array.isArray(job),
        )
        .map((job) => ({
          title:
            typeof job.title === "string" && job.title.trim()
              ? job.title.trim()
              : "Untitled role",
          company:
            typeof job.company === "string" && job.company.trim()
              ? job.company.trim()
              : "Unknown company",
          location:
            typeof job.location === "string" && job.location.trim()
              ? job.location.trim()
              : "",
          url:
            typeof job.url === "string" && job.url.trim()
              ? job.url.trim()
              : "",
          source:
            typeof job.source_kind === "string" && job.source_kind.trim()
              ? job.source_kind.trim()
              : "",
          verification:
            typeof job.verification_status === "string" &&
            job.verification_status.trim()
              ? job.verification_status.trim()
              : "",
        }));
    });

  if (!jobResults.length) return null;

  const uniqueJobs = Array.from(
    new Map(
      jobResults.map((job) => [
        `${job.title}|${job.company}|${job.url}`,
        job,
      ]),
    ).values(),
  ).slice(0, 6);

  return (
    <div className='mb-3 rounded-xl border border-brand/20 bg-brand/[0.04] p-3 text-[13px] text-muted-foreground'>
      <div className='mb-2 flex items-center gap-2 font-medium text-foreground/85'>
        <ListChecks className='h-3.5 w-3.5 text-brand' />
        Live results while JobRaker keeps working - {uniqueJobs.length} job
        {uniqueJobs.length === 1 ? "" : "s"} found
      </div>
      <div className='space-y-2'>
        {uniqueJobs.map((job) => (
          <div
            key={`${job.title}-${job.company}-${job.url}`}
            className='rounded-lg border border-border/70 bg-background/40 px-3 py-2'
          >
            <div className='font-medium text-foreground'>{job.title}</div>
            <div className='mt-1 text-xs'>
              {[job.company, job.location, job.source, job.verification]
                .filter(Boolean)
                .join(" - ")}
            </div>
            {job.url ? (
              <a
                href={job.url}
                target='_blank'
                rel='noreferrer'
                className='mt-1 block truncate text-xs text-brand hover:underline'
              >
                {job.url}
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};

type ChatRequestMessage = {
  role: "user" | "assistant";
  content: string;
  images?: { mimeType: string; data: string; name?: string }[];
};

const summarizeSkillCallForHistory = (skillCall?: ChatSkillCall) => {
  if (!skillCall) return "";

  const lines = [
    `Chat skill result: ${skillCall.skillName}`,
    `Status: ${skillCall.status.replace(/_/g, " ")}`,
  ];
  const output = skillCall.output as Record<string, any> | undefined;

  if (output?.needsClarification?.reason) {
    lines.push(`Needs clarification: ${output.needsClarification.reason}`);
  }

  if (Array.isArray(output?.results)) {
    const resultLines = output.results.slice(0, 8).map((result: any) => {
      const company = result?.companyName || "Unknown company";
      const role = result?.role || "Unknown role";
      const channel = result?.channelValue || "No channel";
      const confidence =
        result?.confidence && result?.confidenceScore
          ? `${result.confidence} ${result.confidenceScore}%`
          : result?.confidence || "unknown confidence";
      const status = result?.draftStatus
        ? `draft ${String(result.draftStatus).replace(/_/g, " ")}`
        : "draft status unknown";

      return `- ${company}: ${role}; ${channel}; ${confidence}; ${status}.`;
    });

    if (resultLines.length) {
      lines.push("Results:");
      lines.push(...resultLines);
    }
  }

  if (skillCall.error) {
    lines.push(`Error: ${skillCall.error}`);
  }

  lines.push(
    "If the user replies with approval, treat it as approval for this skill result only and still respect safety rules before sending, applying, deleting, or charging.",
  );

  return lines.join("\n").slice(0, 5000);
};

const buildChatRequestMessages = (
  history: BasicMessage[],
  currentPayload: ChatUserPayload,
): ChatRequestMessage[] => {
  const mapped = history
    .map((msg, idx, arr): ChatRequestMessage | null => {
      const isLast = idx === arr.length - 1;
      if (msg.role === "skill") {
        const content =
          summarizeSkillCallForHistory(msg.skillCall) || msg.content.trim();
        return content ? { role: "assistant", content } : null;
      }

      if (isLast && msg.role === "user" && currentPayload.images?.length) {
        return {
          role: "user",
          content: msg.content.trim(),
          images: currentPayload.images.map(({ mimeType, data, name }) => ({
            mimeType,
            data,
            ...(name ? { name } : {}),
          })),
        };
      }

      const content = msg.content.trim();
      if (!content && !(isLast && msg.role === "user" && currentPayload.images?.length)) {
        return null;
      }

      return { role: msg.role as "user" | "assistant", content };
    })
    .filter((msg): msg is ChatRequestMessage => Boolean(msg));

  return mapped.reduce<ChatRequestMessage[]>((acc, msg) => {
    const previous = acc[acc.length - 1];
    if (previous && previous.role === msg.role && !previous.images?.length && !msg.images?.length) {
      previous.content = `${previous.content}\n\n${msg.content}`.trim();
      return acc;
    }
    acc.push({ ...msg });
    return acc;
  }, []);
};

const normalizeChatSession = (session: ChatSessionRecord): ChatSessionState => {
  const createdAtMs = session.created_at
    ? new Date(session.created_at).getTime()
    : Date.now();
  const updatedAtMs = session.updated_at
    ? new Date(session.updated_at).getTime()
    : createdAtMs;

  return {
    id: session.id,
    title:
      typeof session.title === "string" && session.title.trim()
        ? session.title
        : "New Chat",
    createdAt: createdAtMs,
    updatedAt: updatedAtMs,
    created_at: session.created_at ?? undefined,
    updated_at: session.updated_at ?? undefined,
    messages: Array.isArray(session.messages)
      ? session.messages.map(normalizeBasicMessage)
      : [],
    responseId: session.responseId ?? session.response_id ?? null,
    persona: session.persona ?? null,
    model: session.model ?? null,
  };
};

const useChat = (opts: UseChatOptions): UseChatReturn => {
  const [messages, setMessages] = useState<BasicMessage[]>(
    opts.initialMessages || [],
  );
  const [status, setStatus] = useState<"idle" | "in_progress">("idle");
  const [responseId, setResponseId] = useState<string | null>(null);
  const [requestStartedAt, setRequestStartedAt] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestTimedOutRef = useRef(false);
  const lastTurnRef = useRef<{
    message: ChatUserPayload;
    chatOpts?: ChatRequestOptions;
    historyBeforeUser: BasicMessage[];
  } | null>(null);

  const sendMessage = useCallback(
    async (
      baseMessages: BasicMessage[],
      m: ChatUserPayload,
      chatOpts?: ChatRequestOptions,
      previousResponseId?: string | null,
    ) => {
      if (status === "in_progress") return;

      const textContent = m.content.trim();
  const userMessage: BasicMessage = {
        id: nanoid(),
        role: "user",
        content: textContent,
        hasPastedImage: Boolean(m.images?.length),
        attachmentCount: m.images?.length || 0,
        createdAt: Date.now(),
        parts: [
          {
            type: "text",
            text: textContent || (m.images?.length ? " " : ""),
          },
        ],
      };

      if (m.images?.length) {
        void cacheChatAttachments(
          userMessage.id,
          m.images
            .filter((img) => Boolean(img.data))
            .map((img) => ({
              mimeType: img.mimeType || "image/png",
              name: img.name || "attachment",
              base64: img.data,
            })),
        );
      }

      const history = [...baseMessages, userMessage];
      lastTurnRef.current = {
        message: m,
        chatOpts,
        historyBeforeUser: baseMessages,
      };
      setMessages(history);
      setStatus("in_progress");
      setRequestStartedAt(Date.now());
      requestTimedOutRef.current = false;

      const assistantId = nanoid();
      const assistantMessage: BasicMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        parts: [{ type: "text", text: "" }],
        streaming: true,
        agentEvents:
          (chatOpts?.mode || "ask") === "agent"
            ? [
                {
                  id: nanoid(),
                  kind: "thinking",
                  title: "Starting agent",
                  detail: "Connecting to JobRaker and preparing the first step.",
                  status: "running",
                  createdAt: Date.now(),
                  round: 0,
                },
              ]
            : undefined,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      const supabase = createClient();
      const supabaseUrl =
        import.meta.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
      const fnUrl = `${supabaseUrl}/functions/v1/ai-chat`;

      abortControllerRef.current = new AbortController();
      const timeoutId = window.setTimeout(() => {
        requestTimedOutRef.current = true;
        abortControllerRef.current?.abort();
      }, CHAT_TIMEOUT_MS);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const requestMessages = buildChatRequestMessages(history, m);

        const response = await fetch(fnUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            model: chatOpts?.model || DEFAULT_CHAT_MODEL,
            messages: requestMessages,
            mode: chatOpts?.mode || "ask",
            webSearch: chatOpts?.webSearch ?? false,
            system: chatOpts?.system,
            previous_response_id: previousResponseId ?? responseId,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "");
          let errorMessage = response.statusText || "Chat request failed";
          try {
            const parsed = JSON.parse(errorBody);
            if (parsed.code === "insufficient_credits") {
              errorMessage =
                parsed.error ||
                "Your Career Command Center has used its included capacity. Upgrade to Pro or add credits to keep Agent Mode searching, evaluating, and drafting for you.";
            } else if (
              parsed.code === "rate_limit" ||
              parsed.code === "daily_limit"
            ) {
              errorMessage =
                parsed.error || "Too many messages. Please wait a moment.";
            } else if (parsed.error) {
              errorMessage = parsed.error;
            }
          } catch {
            if (errorBody) errorMessage = errorBody;
          }
          throw new Error(errorMessage);
        }

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const handleSsePayload = async (
          currentEvent: string,
          dataStr: string,
        ) => {
          if (dataStr === "[DONE]") return true;
          try {
            const data = parseSseData(dataStr);
            if (!data) return false;

            const markStreamFrame = (msg: BasicMessage) => ({
              ...msg,
              streamFrameCount: (msg.streamFrameCount || 0) + 1,
            });

            if (currentEvent === "done") {
              return true;
            }
            if (currentEvent === "message") {
              if (data.delta) {
                flushSync(() => {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantId
                        ? {
                            ...markStreamFrame(msg),
                            content: msg.content + data.delta,
                            parts: [
                              {
                                type: "text",
                                text: msg.content + data.delta,
                              },
                            ],
                          }
                        : msg,
                    ),
                  );
                });
                await waitForAgentProgressPaint();
              }
            } else if (currentEvent === "response_id") {
              if (data.response_id) {
                setResponseId(data.response_id);
              }
            } else if (currentEvent === "error") {
              const errorText = `Error: ${data.error}`;
              flushSync(() => {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? {
                          ...markStreamFrame(msg),
                          content: errorText,
                          parts: [{ type: "text", text: errorText }],
                          streaming: false,
                        }
                      : msg,
                  ),
                );
              });
              await waitForAgentProgressPaint();
            } else if (currentEvent === "agent_activity") {
              const activity: AgentActivityEntry = {
                id: data.id || nanoid(),
                kind: data.kind || "status",
                title: data.title || "Working",
                detail:
                  typeof data.detail === "string" ? data.detail : undefined,
                status:
                  data.status === "error" ||
                  data.status === "done" ||
                  data.status === "running"
                    ? data.status
                    : "done",
                createdAt:
                  typeof data.created_at === "number"
                    ? data.created_at
                    : Date.now(),
                finishedAt:
                  typeof data.finished_at === "number"
                    ? data.finished_at
                    : undefined,
                round:
                  typeof data.round === "number" ? data.round : undefined,
                creditsCharged:
                  typeof data.credits_charged === "number"
                    ? data.credits_charged
                    : undefined,
                toolCount:
                  typeof data.tool_count === "number"
                    ? data.tool_count
                    : undefined,
              };
              flushSync(() => {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? {
                          ...markStreamFrame(msg),
                          agentEvents: [...(msg.agentEvents || []), activity],
                        }
                      : msg,
                  ),
                );
              });
              await waitForAgentProgressPaint();
            } else if (currentEvent === "tool_start") {
              const toolEntry: ToolCallEntry = {
                id: data.id || nanoid(),
                name: data.name,
                args: data.args,
                status: "running",
                startedAt: Date.now(),
              };
              flushSync(() => {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? {
                          ...markStreamFrame(msg),
                          toolCalls: [...(msg.toolCalls || []), toolEntry],
                        }
                      : msg,
                  ),
                );
              });
              await waitForAgentProgressPaint();
            } else if (currentEvent === "tool_call") {
              const toolEntry: ToolCallEntry = {
                id: data.id,
                name: data.name,
                args: data.args,
                status:
                  data.result?.error || data.result?.success === false
                    ? "error"
                    : "done",
                result: data.result,
                startedAt:
                  typeof data.started_at === "number"
                    ? data.started_at
                    : undefined,
                finishedAt:
                  typeof data.finished_at === "number"
                    ? data.finished_at
                    : Date.now(),
              };
              flushSync(() => {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id !== assistantId
                      ? msg
                      : {
                          ...markStreamFrame(msg),
                          toolCalls: data.id
                            ? (msg.toolCalls || []).some(
                                (entry) => entry.id === data.id,
                              )
                              ? (msg.toolCalls || []).map((entry) =>
                                  entry.id === data.id
                                    ? {
                                        ...entry,
                                        ...toolEntry,
                                        startedAt:
                                          toolEntry.startedAt ||
                                          entry.startedAt,
                                      }
                                    : entry,
                                )
                              : [...(msg.toolCalls || []), toolEntry]
                            : [...(msg.toolCalls || []), toolEntry],
                        },
                  ),
                );
              });
              await waitForAgentProgressPaint();
            } else if (currentEvent === "agent_surcharge") {
              const creditsCharged = Number(data.credits_charged || 0);
              const toolCount = Number(data.tool_count || 0);
              const estimatedMinutesSaved = Math.max(
                8,
                Math.min(180, Math.max(toolCount, creditsCharged) * 8),
              );
              const activity: AgentActivityEntry = {
                id: data.id || nanoid(),
                kind: "billing",
                status: "done",
                title: `Agent completed work using ${creditsCharged} credit${creditsCharged === 1 ? "" : "s"}`,
                detail: toolCount
                  ? `Ran ${toolCount} work step${toolCount === 1 ? "" : "s"} for this task. Estimated time saved: ${estimatedMinutesSaved} minutes. Balance: ${data.balance ?? "updated"}.`
                  : `Estimated time saved: ${estimatedMinutesSaved} minutes. Balance: ${data.balance ?? "updated"}.`,
                createdAt: Date.now(),
                creditsCharged,
                toolCount,
                round:
                  typeof data.round === "number" ? data.round : undefined,
              };
              flushSync(() => {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? {
                          ...markStreamFrame(msg),
                          agentEvents: [...(msg.agentEvents || []), activity],
                        }
                      : msg,
                  ),
                );
              });
              await waitForAgentProgressPaint();
              opts.onCreditsUpdated?.();
            } else if (currentEvent === "ui_action") {
              opts.onUiAction?.(data as ChatUiAction);
            }
          } catch (e) {
            console.warn("[ai-chat] Could not handle SSE frame", e);
          }
          return false;
        };

        const handleSseFrame = async (frame: string) => {
          const parsedFrame = parseSseFrame(frame);
          if (!parsedFrame) return false;
          return handleSsePayload(parsedFrame.event, parsedFrame.data);
        };

        let currentEvent = "message";
        let streamFinished = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done || streamFinished) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || "";

          for (const rawLine of lines) {
            const line = rawLine.trimEnd();
            if (!line || line.startsWith(":")) continue;
            if (line.startsWith("event:")) {
              currentEvent = line.slice(6).trim() || "message";
              continue;
            }
            if (line.startsWith("data:")) {
              const dataStr = line.slice(5).trimStart();
              const shouldStop = await handleSsePayload(currentEvent, dataStr);
              if (shouldStop) {
                streamFinished = true;
                break;
              }
            }
          }
        }
        const trailing = streamFinished ? "" : buffer.trim();
        if (trailing) await handleSseFrame(trailing);

        // Done
        setMessages((prev) => {
          let finalAssistantMessage: BasicMessage | undefined;
          const finalMessages = prev.map((msg) => {
            if (msg.id === assistantId) {
              const fallbackContent = msg.content.trim()
                ? msg.content
                : buildAgentFinalFallback(msg) || "";
              finalAssistantMessage = {
                ...msg,
                content: fallbackContent,
                parts: [{ type: "text", text: fallbackContent }],
                streaming: false,
              };
              return finalAssistantMessage;
            }
            return msg;
          });
          if (opts.onFinish && finalAssistantMessage) {
            opts.onFinish(finalAssistantMessage);
          }
          return finalMessages;
        });
        setStatus("idle");
        setRequestStartedAt(null);
      } catch (err: any) {
        if (err.name === "AbortError") {
          const stoppedText = requestTimedOutRef.current
            ? "This request took too long and was stopped. Try a shorter request or send it again."
            : "Request stopped.";
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    content: msg.content.trim() ? msg.content : stoppedText,
                    parts: [
                      {
                        type: "text",
                        text: msg.content.trim() ? msg.content : stoppedText,
                      },
                    ],
                    streaming: false,
                  }
                : msg,
            ),
          );
          setStatus("idle");
          setRequestStartedAt(null);
          return;
        }
        const errorText = `Fetch Error: ${err.message || "Could not connect to the chat function."}`;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content: errorText,
                  parts: [{ type: "text", text: errorText }],
                  streaming: false,
                }
              : msg,
          ),
        );
        setStatus("idle");
        setRequestStartedAt(null);
      } finally {
        window.clearTimeout(timeoutId);
        abortControllerRef.current = null;
      }
    },
    [
      responseId,
      status,
      opts.onFinish,
      opts.onCreditsUpdated,
      opts.onUiAction,
    ],
  );

  const append = useCallback(
    (m: ChatUserPayload, chatOpts?: ChatRequestOptions) => {
      void sendMessage(messages, m, chatOpts, responseId);
    },
    [messages, responseId, sendMessage],
  );

  const regenerate = () => {
    if (status === "in_progress" || !lastTurnRef.current) return;
    const lastTurn = lastTurnRef.current;
    setMessages(lastTurn.historyBeforeUser);
    setResponseId(null);
    void sendMessage(
      lastTurn.historyBeforeUser,
      lastTurn.message,
      lastTurn.chatOpts,
      null,
    );
  };

  const stop = () => {
    requestTimedOutRef.current = false;
    abortControllerRef.current?.abort();
  };

  return {
    messages,
    status,
    append,
    regenerate,
    stop,
    setMessages,
    responseId,
    setResponseId,
    requestStartedAt,
  };
};

async function fileToChatImagePart(
  file: File,
): Promise<{ mimeType: string; data: string; name: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  const mimeType = match?.[1] || file.type || "image/png";
  const data = match?.[2] || "";
  return { mimeType, data, name: file.name || "attachment" };
}

function UserChatAttachment({
  messageId,
  hasPastedImage,
}: {
  messageId: string;
  hasPastedImage?: boolean;
}) {
  const [images, setImages] = useState<
    Array<{ src: string; name: string }>
  >([]);
  useEffect(() => {
    if (!hasPastedImage) return;
    let cancelled = false;
    void getChatAttachment(messageId).then((row) => {
      if (cancelled || !row) return;
      const cachedImages = row.images?.length
        ? row.images
        : [{ mimeType: row.mimeType, base64: row.base64, name: row.name }];
      setImages(
        cachedImages.map((img) => ({
          src: `data:${img.mimeType};base64,${img.base64}`,
          name: img.name,
        })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [messageId, hasPastedImage]);
  if (!hasPastedImage || images.length === 0) return null;
  return (
    <div className='mb-2 flex flex-wrap gap-2'>
      {images.map((image, index) => (
        <img
          key={`${image.name}-${index}`}
          src={image.src}
          alt={image.name}
          className='rounded-lg max-h-56 max-w-full border border-primary-foreground/25 object-contain bg-black/10'
        />
      ))}
    </div>
  );
}

export const ChatPage = () => {
  const { error: toastError } = useToast();
  const navigate = useNavigate();
  // UI state
  const [text, setText] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggleListening = useCallback(() => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
    } else {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        toastError("Speech recognition is not supported in this browser.");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        toastError(`Speech recognition error: ${event.error}`);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };

      recognitionRef.current = recognition;
      recognition.start();
    }
  }, [isListening, toastError]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);
  const [skillStatus, setSkillStatus] = useState<"idle" | "in_progress">(
    "idle",
  );
  const [caretPosition, setCaretPosition] = useState(0);
  const [skillPaletteActiveIndex, setSkillPaletteActiveIndex] = useState(0);
  const [dismissedSkillPaletteToken, setDismissedSkillPaletteToken] = useState<
    string | null
  >(null);
  const [persona, setPersona] = useState<Persona>("analyst");
  const [sessions, setSessions] = useState<ChatSessionState[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "history">("chat");
  const [isMultiline, setIsMultiline] = useState(false);

  useEffect(() => {
    if (textareaRef.current) {
      const multiline = textareaRef.current.scrollHeight > 36;
      if (multiline !== isMultiline) {
        setIsMultiline(multiline);
      }
    } else if (text === "") {
      setIsMultiline(false);
    }
  }, [text, isMultiline]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(
    null,
  );
  const [renamingTitle, setRenamingTitle] = useState("");
  const [starterSuggestions, setStarterSuggestions] = useState<
    ChatStarterSuggestion[]
  >([]);
  const [loadingStarterSuggestions, setLoadingStarterSuggestions] =
    useState(true);
  const supabase = useMemo(() => createClient(), []);
  const { subscriptionTier, loadingTier } = useSubscriptionTier();
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentPreviewUrls = useMemo(
    () =>
      attachments.map((attachment) =>
        attachment.type?.startsWith("image/")
          ? URL.createObjectURL(attachment)
          : null,
      ),
    [attachments],
  );

  useEffect(() => {
    return () => {
      attachmentPreviewUrls.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [attachmentPreviewUrls]);

  const hasChatAccess = hasSubscriptionAccess(subscriptionTier, "Pro");

  const [chatQuota, setChatQuota] = useState<{
    free_remaining: number;
    free_total: number;
    credit_balance: number;
    plan_name?: string;
  } | null>(null);

  const fetchChatQuota = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user?.id) return;
      const { data } = await supabase.rpc("get_chat_quota_status", {
        p_user_id: userData.user.id,
      });
      if (data) setChatQuota(data);
    } catch {
      // Quota display is non-critical
    }
  }, [supabase]);

  useEffect(() => {
    if (hasChatAccess) fetchChatQuota();
  }, [hasChatAccess, fetchChatQuota]);

  useEffect(() => {
    if (!hasChatAccess) {
      setLoadingStarterSuggestions(false);
      return;
    }

    let cancelled = false;

    const loadStarterSuggestions = async () => {
      setLoadingStarterSuggestions(true);
      try {
        const suggestions = await generateChatStarters();
        if (!cancelled && suggestions.length > 0) {
          setStarterSuggestions(suggestions);
        }
      } catch (error) {
        console.error("Failed to load AI chat starters", error);
      } finally {
        if (!cancelled) setLoadingStarterSuggestions(false);
      }
    };

    void loadStarterSuggestions();

    return () => {
      cancelled = true;
    };
  }, [hasChatAccess]);

  // Chat logic
  const chat = useChat({
    api: "/api/ai-chat",
    onFinish: () => {
      fetchChatQuota();
    },
    onCreditsUpdated: fetchChatQuota,
    onUiAction: (action) => {
      if (action?.type !== "navigate" || !action.route) return;
      navigate(action.route, { replace: Boolean(action.replace) });
    },
  });
  const {
    messages,
    status,
    append,
    regenerate,
    stop,
    setMessages,
    responseId,
    setResponseId,
    requestStartedAt,
  } = chat;
  const [now, setNow] = useState(() => Date.now());
  const requestElapsedMs =
    status === "in_progress" && requestStartedAt ? now - requestStartedAt : 0;
  const showExtendedWait = requestElapsedMs >= CHAT_EXTENDED_WAIT_MS;
  const requestElapsedLabel = useMemo(() => {
    const totalSeconds = Math.max(0, Math.floor(requestElapsedMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  }, [requestElapsedMs]);
  const isChatBusy = status === "in_progress" || skillStatus === "in_progress";

  useEffect(() => {
    if (status !== "in_progress") return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [status, requestStartedAt]);

  // Session management with Supabase -----------------------------------------
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  const createSession = useCallback(
    async (activate = true) => {
      const sessionMode: ChatMode = persona === "analyst" ? "agent" : "ask";
      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({
          title: "New Chat",
          persona: sessionMode,
          model: DEFAULT_CHAT_MODEL,
        })
        .select()
        .single();

      if (error) {
        toastError("Could not create chat", error.message);
        return null;
      }
      if (data) {
        const normalized = normalizeChatSession(data as ChatSessionRecord);
        setSessions((prev) =>
          [normalized, ...prev].sort(
            (a, b) =>
              new Date(b.updated_at || 0).getTime() -
              new Date(a.updated_at || 0).getTime(),
          ),
        );
        if (activate) setActiveSessionId(normalized.id);
        return normalized.id;
      }
      return null;
    },
    [persona, supabase, toastError],
  );

  const loadSessions = useCallback(async () => {
    const { data, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      toastError("Could not load chats", error.message);
      return;
    }
    if (data && data.length > 0) {
      const normalizedSessions = (data as ChatSessionRecord[]).map(
        normalizeChatSession,
      );
      setSessions(normalizedSessions);
      setActiveSessionId(normalizedSessions[0]?.id || null);
    } else {
      // No sessions, create one
      await createSession(true);
    }
  }, [createSession, supabase, toastError]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const prevSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeSessionId) return;
    if (status === "in_progress") return;
    if (activeSessionId === prevSessionIdRef.current) return;
    prevSessionIdRef.current = activeSessionId;

    const active = sessions.find((s) => s.id === activeSessionId);
    if (active) {
      setMessages(active.messages || []);
      setResponseId(active.responseId || null);
      if (active.persona === "agent") {
        setPersona("analyst");
      } else if (active.persona === "ask") {
        setPersona("concise");
      }
    }
  }, [activeSessionId, sessions, setMessages, setResponseId, status]);

  // Debounced save to DB
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!activeSessionId || status === "in_progress") return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      const currentMessages = messages;
      const currentResponseId = responseId;
      const active = sessionsRef.current.find((s) => s.id === activeSessionId);

      if (active) {
        const hasChanged =
          JSON.stringify(active.messages) !== JSON.stringify(currentMessages) ||
          active.responseId !== currentResponseId;
        if (!hasChanged) return;

        const { error } = await supabase
          .from("chat_sessions")
          .update({
            messages: currentMessages as any,
            response_id: currentResponseId,
          })
          .eq("id", activeSessionId);

        if (!error) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSessionId
                ? {
                    ...s,
                    messages: currentMessages,
                    responseId: currentResponseId,
                    persona:
                      s.persona || (persona === "analyst" ? "agent" : "ask"),
                    model: s.model || DEFAULT_CHAT_MODEL,
                    updated_at: new Date().toISOString(),
                  }
                : s,
            ),
          );
        }
      }
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [messages, persona, responseId, activeSessionId, status, supabase]);

  const deleteSession = async (id: string) => {
    const originalSessions = sessions;
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (renamingSessionId === id) {
      setRenamingSessionId(null);
      setRenamingTitle("");
    }
    if (activeSessionId === id) {
      const remaining = originalSessions.filter((s) => s.id !== id);
      setActiveSessionId(remaining[0]?.id || null);
    }

    const { error } = await supabase
      .from("chat_sessions")
      .delete()
      .eq("id", id);

    if (error) {
      toastError("Could not delete chat", error.message);
      setSessions(originalSessions);
    }
  };

  const startRenamingSession = (session: ChatSessionState) => {
    setRenamingSessionId(session.id);
    setRenamingTitle(session.title || "New Chat");
  };

  const cancelRenamingSession = () => {
    setRenamingSessionId(null);
    setRenamingTitle("");
  };

  const saveRenamedSession = async (id: string) => {
    const title = renamingTitle.trim().slice(0, 80);
    if (!title) {
      cancelRenamingSession();
      return;
    }

    const originalSessions = sessions;
    setSessions((prev) =>
      prev.map((session) =>
        session.id === id
          ? { ...session, title, updated_at: new Date().toISOString() }
          : session,
      ),
    );
    cancelRenamingSession();

    const { error } = await supabase
      .from("chat_sessions")
      .update({ title })
      .eq("id", id);

    if (error) {
      toastError("Could not rename chat", error.message);
      setSessions(originalSessions);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;

    const imageFiles = selectedFiles.filter((file) =>
      file.type.startsWith("image/"),
    );
    if (imageFiles.length !== selectedFiles.length) {
      toastError("Unsupported file type", "AI chat attachments must be images.");
    }

    setAttachments((current) => {
      const next = [...current, ...imageFiles].slice(0, MAX_CHAT_ATTACHMENTS);
      if (current.length + imageFiles.length > MAX_CHAT_ATTACHMENTS) {
        toastError(
          "Attachment limit",
          `You can attach up to ${MAX_CHAT_ATTACHMENTS} images at once.`,
        );
      }
      return next;
    });
  };

  const handlePasteImage = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items?.length) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind !== "file") continue;
        const file = item.getAsFile();
        if (file) files.push(file);
      }
      const imageFile = files.find((f) => f.type.startsWith("image/"));
      if (!imageFile) return;

      e.preventDefault();
      const ext =
        imageFile.name.split(".").pop()?.toLowerCase() ||
        imageFile.type.split("/")[1]?.split("+")[0] ||
        "png";
      const needsName =
        !imageFile.name ||
        !imageFile.name.includes(".") ||
        imageFile.name === "image.png";
      const file = needsName
        ? new File([imageFile], `pasted-screenshot-${Date.now()}.${ext}`, {
            type: imageFile.type || "image/png",
          })
        : imageFile;

      setAttachments((current) =>
        [...current, file].slice(0, MAX_CHAT_ATTACHMENTS),
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [],
  );

  const touchSessionMessages = useCallback(
    (
      sessionId: string,
      nextMessages: BasicMessage[],
      nextResponseId = responseId,
    ) => {
      const updatedAt = new Date();
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                messages: nextMessages,
                responseId: nextResponseId,
                persona:
                  session.persona || (persona === "analyst" ? "agent" : "ask"),
                model: session.model || DEFAULT_CHAT_MODEL,
                updatedAt: updatedAt.getTime(),
                updated_at: updatedAt.toISOString(),
              }
            : session,
        ),
      );
      void supabase
        .from("chat_sessions")
        .update({
          messages: nextMessages as any,
          response_id: nextResponseId,
        })
        .eq("id", sessionId)
        .then(({ error }) => {
          if (error) console.error("Failed to persist skill chat turn", error);
        });
    },
    [persona, responseId, supabase],
  );

  const runSkillCall = useCallback(
    async (parsed: ParsedSkillCall, rawContent: string) => {
      const skill = getSkillById(parsed.skillId);
      if (!skill) {
        toastError(
          "Skill not found",
          "That chat skill is not registered in JobRaker yet.",
        );
        return;
      }

      const sessionId = activeSessionId || (await createSession(true));
      if (!sessionId) {
        toastError("Could not start chat", "Please try again.");
        return;
      }

      const currentMessages =
        sessionId === activeSessionId
          ? messages
          : sessions.find((session) => session.id === sessionId)?.messages || [];
      const conversationContext = currentMessages
        .filter((message) => message.role !== "skill" && message.content.trim())
        .slice(-8)
        .map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content.slice(0, 2000),
        }));
      const nowMs = Date.now();
      const userMessage: BasicMessage = {
        id: nanoid(),
        role: "user",
        content: rawContent.trim(),
        createdAt: nowMs,
        parts: [{ type: "text", text: rawContent.trim() }],
      };
      const skillCall: ChatSkillCall = {
        id: nanoid(),
        skillId: skill.id,
        skillName: skill.name,
        status: "running",
        input: {
          trigger: parsed.trigger,
          rawCommand: parsed.rawCommand,
          userInstruction: parsed.userInstruction,
          args: parsed.args,
        },
        progress: ["Queued chat skill"],
      };
      const skillMessage: BasicMessage = {
        id: nanoid(),
        role: "skill",
        content: `${skill.name} is reading the request.`,
        createdAt: nowMs + 1,
        parts: [
          {
            type: "text",
            text: `${skill.name} is reading the request.`,
          },
        ],
        skillCall,
      };
      const nextMessages = [...currentMessages, userMessage, skillMessage];

      setMessages(nextMessages);
      touchSessionMessages(sessionId, nextMessages, null);
      setResponseId(null);
      setSkillStatus("in_progress");

      const isFirstMessage =
        currentMessages.filter((message) => message.role === "user").length ===
        0;
      if (isFirstMessage) {
        const optimisticTitle = rawContent.trim().slice(0, 40) || skill.name;
        setSessions((prev) =>
          prev.map((session) =>
            session.id === sessionId
              ? { ...session, title: optimisticTitle }
              : session,
          ),
        );
        void supabase
          .from("chat_sessions")
          .update({ title: optimisticTitle })
          .eq("id", sessionId);
      }

      const updateSkillMessage = (
        updater: (call: ChatSkillCall) => ChatSkillCall,
        finalContent?: string,
      ) => {
        setMessages((prev) => {
          const updated = prev.map((message) => {
            if (message.id !== skillMessage.id || !message.skillCall) {
              return message;
            }
            const updatedSkillCall = updater(message.skillCall);
            const contentText =
              finalContent !== undefined
                ? finalContent
                : updatedSkillCall.error ||
                  `${skill.name} ${updatedSkillCall.status.replace(/_/g, " ")}.`;

            return {
              ...message,
              content: contentText,
              parts: [
                {
                  type: "text" as const,
                  text: contentText,
                },
              ],
              skillCall: updatedSkillCall,
            };
          });
          touchSessionMessages(sessionId, updated, null);
          return updated;
        });
      };

      try {
        const result = await executeChatSkill({
          invocationId: skillCall.id,
          skillId: skill.id,
          trigger: parsed.trigger,
          rawCommand: parsed.rawCommand,
          userInstruction: parsed.userInstruction,
          args: parsed.args,
          conversationContext,
          progress: (label) => {
            updateSkillMessage((call) => ({
              ...call,
              status: "running",
              progress: Array.from(new Set([...(call.progress || []), label])),
            }));
          },
        });

        updateSkillMessage(
          (call) => ({
            ...call,
            status: result.status,
            output: result.output,
            progress: Array.from(
              new Set([...(call.progress || []), "Ready for review"]),
            ),
          }),
          result.content,
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "The skill failed before returning a result.";
        updateSkillMessage(
          (call) => ({
            ...call,
            status: "failed",
            error: message,
          }),
          `### ❌ Error executing ${skill.name}\n\n${message}`,
        );
      } finally {
        setSkillStatus("idle");
      }
    },
    [
      activeSessionId,
      createSession,
      messages,
      sessions,
      setMessages,
      setResponseId,
      supabase,
      toastError,
      touchSessionMessages,
    ],
  );

  const handleSubmit = async (message: { text: string }) => {
    if ((!message.text.trim() && attachments.length === 0) || isChatBusy)
      return;

    const attachmentFiles = attachments;
    setText("");
    setCaretPosition(0);
    setAttachments([]);
    const textarea = textareaRef.current;
    if (textarea) textarea.style.height = "auto";

    const content = message.text || "";
    const parsedSkillCall = parseSkillCall(content);
    if (parsedSkillCall.detected && attachmentFiles.length === 0) {
      await runSkillCall(parsedSkillCall, content);
      return;
    }

    let images: { mimeType: string; data: string; name: string }[] | undefined;
    if (attachmentFiles.length) {
      try {
        images = await Promise.all(attachmentFiles.map(fileToChatImagePart));
      } catch (e) {
        console.error(e);
        toastError(
          "Could not read the images. Try again or use smaller files.",
        );
        return;
      }
    }

    const systemInstruction = {
      concise: "You are a concise and direct assistant.",
      friendly: "You are a friendly and encouraging assistant.",
      analyst:
        "You are JobRaker Agent, a high-performance career assistant with access to the user's JobRaker profile, resume, tracked jobs, applications, app pages, and edge functions. Use your tools to search for jobs, analyze fit, generate documents, refresh multi-stage application pipelines, open the right app pages, and launch URL-first apply flows. Be proactive, professional, and data-driven.",
      coach: "You are a career coach who gives actionable advice.",
    }[persona];

    const sessionId = activeSessionId || (await createSession(true));
    if (!sessionId) {
      toastError("Could not start chat", "Please try again.");
      return;
    }

    const currentMessages =
      sessions.find((s) => s.id === sessionId)?.messages || [];

    const mode = persona === "analyst" ? "agent" : "ask";
    const model = DEFAULT_CHAT_MODEL;

    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId ? { ...s, persona: mode, model } : s,
      ),
    );
    void supabase
      .from("chat_sessions")
      .update({ persona: mode, model })
      .eq("id", sessionId);

    append(
      {
        role: "user",
        content: content.trim(),
        ...(images ? { images } : {}),
      },
      {
        model,
        webSearch: mode === "agent",
        system: currentMessages.length === 0 ? systemInstruction : undefined,
        mode,
      },
    );

    const isFirstMessage =
      currentMessages.filter((m) => m.role === "user").length === 0;

    if (isFirstMessage && sessionId) {
      const optimisticTitle = (
        message.text.trim() ||
        (attachmentFiles.length ? "Images" : "New Chat")
      ).slice(0, 40);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, title: optimisticTitle } : s,
        ),
      );

      (async () => {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const supabaseUrl =
            import.meta.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
          const fnUrl = `${supabaseUrl}/functions/v1/generate-title`;

          const response = await fetch(fnUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              message:
                message.text.trim() ||
                (attachmentFiles.length ? "User shared screenshots" : ""),
            }),
          });

          if (response.ok) {
            const { title } = await response.json();
            if (title) {
              setSessions((prev) =>
                prev.map((s) => (s.id === sessionId ? { ...s, title } : s)),
              );
              await supabase
                .from("chat_sessions")
                .update({ title })
                .eq("id", sessionId);
            }
          }
        } catch (error) {
          console.error("Failed to generate AI title", error);
        }
      })();
    }

    setText("");
    setCaretPosition(0);
  };

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const skillPaletteTrigger = useMemo(() => {
    const normalizedCaretPosition = Math.min(
      Math.max(caretPosition, 0),
      text.length,
    );

    return (
      detectSkillPaletteTrigger(text, normalizedCaretPosition) ||
      detectSkillPaletteTrigger(text, text.length)
    );
  }, [caretPosition, text]);
  const skillPaletteSkills = useMemo(
    () =>
      skillPaletteTrigger
        ? getSkillSuggestions(skillPaletteTrigger.query, skillPaletteTrigger.mode)
        : [],
    [skillPaletteTrigger],
  );
  const skillPaletteOpen = Boolean(
    skillPaletteTrigger &&
      skillPaletteSkills.length > 0 &&
      dismissedSkillPaletteToken !== skillPaletteTrigger.token,
  );

  useEffect(() => {
    setSkillPaletteActiveIndex(0);
  }, [skillPaletteTrigger?.query, skillPaletteTrigger?.mode]);

  useEffect(() => {
    if (skillPaletteTrigger) return;
    setDismissedSkillPaletteToken(null);
  }, [skillPaletteTrigger]);

  const selectSkillFromPalette = useCallback(
    (skill: (typeof skillPaletteSkills)[number]) => {
      if (!skillPaletteTrigger) return;
      const alias = getPrimarySkillAlias(skill, skillPaletteTrigger.mode);
      const nextText = replaceSkillPaletteTrigger(
        text,
        skillPaletteTrigger,
        alias,
      );
      setText(nextText);
      setCaretPosition(skillPaletteTrigger.start + alias.length + 1);
      setDismissedSkillPaletteToken(null);
      window.requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const cursor = skillPaletteTrigger.start + alias.length + 1;
        textarea.focus();
        textarea.setSelectionRange(cursor, cursor);
      });
    },
    [skillPaletteTrigger, text],
  );

  const updateScrollState = useCallback(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollToBottom(distanceFromBottom > 160);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const streamingUpdateKey = useMemo(
    () =>
      messages
        .map(
          (message) =>
            [
              message.id,
              message.content.length,
              message.streamFrameCount || 0,
              message.agentEvents?.length || 0,
              message.toolCalls?.length || 0,
              message.streaming ? 1 : 0,
            ].join(":"),
        )
        .join("|"),
    [messages],
  );

  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) {
      updateScrollState();
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const shouldFollowStream = status === "in_progress" && distanceFromBottom < 240;

    updateScrollState();

    if (shouldFollowStream) {
      window.requestAnimationFrame(() => scrollToBottom("auto"));
    }
  }, [scrollToBottom, status, streamingUpdateKey, updateScrollState]);

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(query) ||
        s.messages.some((m) => m.content.toLowerCase().includes(query)),
    );
  }, [sessions, searchQuery]);

  return (
    <div className='relative flex flex-col md:flex-row h-full w-full font-sans bg-background overflow-hidden text-foreground'>
      <style>{customStyles}</style>

      {loadingTier && (
        <div className='absolute inset-0 z-50 flex items-center justify-center bg-background'>
          <div className='text-foreground text-center'>
            <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4'></div>
            <p className='text-foreground/90'>Loading...</p>
          </div>
        </div>
      )}

      {!loadingTier && !hasChatAccess && (
        <div className='flex items-center justify-center h-full w-full p-4 sm:p-6 z-40'>
          <UpgradePrompt
            title='AI Chat Assistant'
            description='Unlock intelligent job search conversations with our advanced AI assistant.'
            features={[
              {
                icon: <MessageSquare className='h-5 w-5' />,
                title: "AI Conversations",
                description:
                  "50 free messages/month on Pro, 200 on Ultimate, then 1 credit each",
              },
              {
                icon: <Wand2 className='h-5 w-5' />,
                title: "Resume Optimization",
                description:
                  "Get AI-powered suggestions to improve your resume",
              },
              {
                icon: <FileText className='h-5 w-5' />,
                title: "Cover Letter Generation",
                description:
                  "Create tailored cover letters for any job posting",
              },
              {
                icon: <Target className='h-5 w-5' />,
                title: "Job Match Analysis",
                description: "Understand how well you fit each opportunity",
              },
              {
                icon: <Sparkles className='h-5 w-5' />,
                title: "Smart Recommendations",
                description: "Receive personalized career advice and insights",
              },
              {
                icon: <Zap className='h-5 w-5' />,
                title: "Priority Support",
                description: "Get faster responses and dedicated assistance",
              },
            ]}
            requiredTier='Pro'
            icon={<MessageSquare className='h-12 w-12 text-brand' />}
          />
        </div>
      )}

      {!loadingTier && hasChatAccess && (
        <>
          {isMobile && (
            <div className="flex flex-col border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 z-30 shrink-0">
              {/* Mobile Page Header */}
              <div className="h-14 flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-sm text-foreground">
                    AI Assistant
                  </h2>
                  <span className="bg-brand/10 text-brand text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-brand/20">
                    BETA
                  </span>
                </div>
                
                <div className="flex items-center gap-2 overflow-hidden min-w-0">
                  {chatQuota && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-card/70 border border-border shrink-0">
                      <Coins size={12} className="text-brand shrink-0" />
                      <span className="text-[10px] font-medium text-foreground whitespace-nowrap">
                        {chatQuota.free_remaining > 0
                          ? `${chatQuota.free_remaining}/${chatQuota.free_total} (+${chatQuota.credit_balance})`
                          : `${chatQuota.credit_balance} paid`}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-card/70 border border-border shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand"></div>
                    <span className="text-[10px] font-medium text-foreground whitespace-nowrap">
                      Ready
                    </span>
                  </div>
                </div>
              </div>

              {/* Mobile Premium Tabs */}
              <div className="px-4 pb-3 pt-1 flex justify-center">
                <div className="relative flex p-1 bg-foreground/5 rounded-full border border-foreground/10 backdrop-blur-md w-full">
                  <button
                    onClick={() => setMobileTab("chat")}
                    className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-full transition-all duration-300 ${
                      mobileTab === "chat"
                        ? "text-background"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mobileTab === "chat" && (
                      <motion.div
                        layoutId="activeMobileTab"
                        className="absolute inset-0 bg-brand rounded-full -z-10 shadow-[0_2px_10px_rgba(29,255,0,0.25)]"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <MessageSquare size={13} />
                    <span>Chat</span>
                  </button>
                  <button
                    onClick={() => setMobileTab("history")}
                    className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-full transition-all duration-300 ${
                      mobileTab === "history"
                        ? "text-background"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mobileTab === "history" && (
                      <motion.div
                        layoutId="activeMobileTab"
                        className="absolute inset-0 bg-brand rounded-full -z-10 shadow-[0_2px_10px_rgba(29,255,0,0.25)]"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <History size={13} />
                    <span>History</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <aside
            className={`bg-card/40 flex-col h-full z-20 transition-all duration-300 overflow-hidden ${
              isMobile
                ? mobileTab === "history"
                  ? "flex w-full flex-1 border-r border-border"
                  : "hidden"
                : `flex shrink-0 ${
                    sidebarCollapsed
                      ? "w-0 border-r-0 opacity-0 pointer-events-none"
                      : "w-72 border-r border-border opacity-100"
                  }`
            }`}
          >
            <div className='p-6'>
              <button
                onClick={() => {
                  createSession();
                  if (isMobile) setMobileTab("chat");
                }}
                className='w-full bg-brand hover:bg-brand/90 text-primary-foreground font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-brand/20'
              >
                <Plus size={20} />
                New Chat
              </button>
            </div>

            <div className='px-6 mb-4'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4' />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='w-full bg-background/60 border border-border focus:ring-1 focus:ring-brand focus:border-brand rounded-xl pl-10 py-2.5 text-sm outline-none text-foreground placeholder:text-muted-foreground'
                  placeholder='Search conversations...'
                  type='text'
                />
              </div>
            </div>

            <div className='flex-1 overflow-y-auto px-4 custom-scrollbar'>
              <div className='mb-4'>
                <p className='px-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2'>
                  Recent Chats
                </p>
                <div className='space-y-1'>
                  {filteredSessions.length > 0 ? (
                    filteredSessions.map((s) => (
                      <div
                        key={s.id}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors group text-left ${
                          s.id === activeSessionId
                            ? "bg-accent/50 border border-border"
                            : "hover:bg-accent/30 border border-transparent"
                        }`}
                      >
                        <MessageSquare
                          className={`w-5 h-5 ${s.id === activeSessionId ? "text-brand" : "text-muted-foreground group-hover:text-brand"} transition-colors`}
                        />
                        <button
                          type='button'
                          onClick={() => {
                            setActiveSessionId(s.id);
                            if (isMobile) setMobileTab("chat");
                          }}
                          className='min-w-0 flex-1 overflow-hidden text-left bg-transparent'
                        >
                          {renamingSessionId === s.id ? (
                            <input
                              autoFocus
                              value={renamingTitle}
                              onChange={(event) =>
                                setRenamingTitle(event.target.value)
                              }
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void saveRenamedSession(s.id);
                                }
                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  cancelRenamingSession();
                                }
                              }}
                              onBlur={() => void saveRenamedSession(s.id)}
                              className='w-full rounded-md border border-brand/40 bg-background/80 px-2 py-1 text-sm font-medium text-foreground outline-none ring-1 ring-brand/30'
                              maxLength={80}
                            />
                          ) : (
                            <p className='text-sm font-medium truncate text-foreground'>
                              {s.title || "New Chat"}
                            </p>
                          )}
                          <p className='text-[11px] text-muted-foreground mt-0.5'>
                            {new Date(
                              s.updated_at || s.updatedAt || Date.now(),
                            ).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        </button>
                        <div className='opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center gap-1'>
                          <button
                            type='button'
                            onClick={(e) => {
                              e.stopPropagation();
                              startRenamingSession(s);
                            }}
                            className='p-1 hover:text-brand text-foreground/60 rounded'
                            aria-label={`Rename ${s.title || "chat"}`}
                            title='Rename chat'
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type='button'
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSession(s.id);
                            }}
                            className='p-1 hover:text-brand text-foreground/60 rounded'
                            aria-label={`Delete ${s.title || "chat"}`}
                            title='Delete chat'
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className='px-3 py-4 text-center text-muted-foreground text-xs'>
                      No conversations found
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>

          <main
            className={`min-h-0 relative flex-col bg-background overflow-hidden h-full ${
              isMobile
                ? mobileTab === "chat"
                  ? "flex w-full pb-0 flex-1"
                  : "hidden"
                : "flex flex-1"
            }`}
          >
            {!isMobile && (
              <header className='relative z-30 h-16 flex items-center justify-between px-4 md:px-8 border-b border-border shrink-0 bg-background/85 backdrop-blur-sm'>
                <div className='flex items-center gap-2 sm:gap-3 shrink-0'>
                  <button
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    className='mr-3 text-foreground/60 hover:text-foreground transition-colors hidden md:block'
                  >
                    <PanelLeft size={20} />
                  </button>
                  <h2 className='font-semibold text-sm sm:text-lg text-foreground whitespace-nowrap'>
                    AI Assistant
                  </h2>
                  <span className='bg-brand/10 text-brand text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full border border-brand/20 shrink-0'>
                    BETA
                  </span>
                </div>
                <div className='flex items-center gap-2 sm:gap-4 overflow-hidden min-w-0 justify-end'>
                  {chatQuota && (
                    <div className='flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-card/70 border border-border shrink-0'>
                      <Coins size={14} className='text-brand shrink-0' />
                      <span className='text-[10px] sm:text-xs font-medium text-foreground whitespace-nowrap'>
                        {chatQuota.free_remaining > 0
                          ? isMobile
                            ? `${chatQuota.free_remaining}/${chatQuota.free_total}${
                                chatQuota.credit_balance > 0
                                  ? ` (+${chatQuota.credit_balance})`
                                  : ""
                              }`
                            : `${chatQuota.free_remaining}/${chatQuota.free_total} free${
                                chatQuota.credit_balance > 0
                                  ? ` + ${chatQuota.credit_balance} paid`
                                  : ""
                              }`
                          : isMobile
                            ? `${chatQuota.credit_balance} paid`
                            : `${chatQuota.credit_balance} paid credits`}
                      </span>
                    </div>
                  )}
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-card/70 border border-border shrink-0`}
                  >
                    <div
                      className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 ${isChatBusy ? "bg-brand animate-pulse" : "bg-brand"} `}
                    ></div>
                    <span className='text-[10px] sm:text-xs font-medium text-foreground whitespace-nowrap'>
                      {status === "in_progress"
                        ? showExtendedWait
                          ? `Still working... ${requestElapsedLabel}`
                          : "Generating..."
                        : skillStatus === "in_progress"
                          ? "Running skill..."
                          : "Ready"}
                    </span>
                  </div>
                  {status === "in_progress" && (
                    <button
                      type='button'
                      onClick={stop}
                      className='text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground px-2 sm:px-3 py-1.5 flex items-center gap-1 shrink-0'
                    >
                      Stop
                    </button>
                  )}
                  {messages.length > 0 && !isMobile && (
                    <button
                      onClick={regenerate}
                      disabled={isChatBusy}
                      className='text-xs sm:text-sm font-medium text-brand hover:underline px-2 sm:px-3 py-1.5 flex items-center gap-1 shrink-0'
                    >
                      Regenerate
                    </button>
                  )}
                </div>
              </header>
            )}

            <div
              ref={chatScrollRef}
              onScroll={updateScrollState}
              className='min-h-0 flex-1 overflow-y-auto flex flex-col relative custom-scrollbar'
            >
              {showExtendedWait && (
                <div className='sticky top-3 z-20 mx-auto mt-3 flex max-w-xl items-center justify-between gap-4 rounded-xl border border-brand/25 bg-card/95 px-4 py-3 text-sm shadow-lg shadow-black/10 backdrop-blur'>
                  <div>
                    <p className='font-medium text-foreground'>
                      JobRaker is still working
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      This has been running for {requestElapsedLabel}. You can
                      wait, or stop and try a shorter request.
                    </p>
                  </div>
                  <button
                    type='button'
                    onClick={stop}
                    className='shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent'
                  >
                    Stop
                  </button>
                </div>
              )}
              {messages.length === 0 ? (
                <div className='flex-1 flex flex-col items-center justify-center px-6 py-12 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full'>
                  <div className='max-w-2xl w-full text-center space-y-4 md:space-y-6 py-6 flex flex-col items-center'>
                    <div className='flex justify-center mb-4'>
                      <div className='w-16 h-16 bg-foreground/5 rounded-2xl flex items-center justify-center border border-brand/20 relative shadow-[0_0_15px_rgba(29,255,0,0.05)]'>
                        <Bot className='w-8 h-8 text-brand' />
                        <div className='absolute -right-0.5 -bottom-0.5 w-5 h-5 bg-brand rounded-full border-2 border-background flex items-center justify-center'>
                          <span className='w-1.5 h-1.5 bg-primary-foreground rounded-full'></span>
                        </div>
                      </div>
                    </div>
                    <h2 className='product-page-title text-3xl font-bold tracking-tight md:text-4xl'>
                      How can <span className='text-brand'>JobRaker</span> help
                      you today?
                    </h2>
                    <p className='text-muted-foreground text-sm md:text-base max-w-md mx-auto'>
                      Your autonomous career partner. Ask me to optimize your
                      resume, find roles, or practice interviews.
                    </p>

                    {loadingStarterSuggestions ? (
                      <div className='grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mt-6 md:mt-8 w-full'>
                        {Array.from({ length: 3 }).map((_, idx) => (
                          <div
                            key={`starter-skeleton-${idx}`}
                            className='suggestion-card glass-panel p-4 rounded-xl text-left flex flex-col justify-between min-h-[120px] animate-pulse pointer-events-none'
                          >
                            <div>
                              <div className='w-5 h-5 rounded-lg bg-foreground/10 mb-2 border border-border/5' />
                              <div className='h-4 bg-foreground/15 rounded w-2/3 mb-2' />
                              <div className='space-y-1.5'>
                                <div className='h-3 bg-foreground/5 rounded w-full' />
                                <div className='h-3 bg-foreground/5 rounded w-5/6' />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : starterSuggestions.length > 0 ? (
                      <div className='grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mt-6 md:mt-8 w-full'>
                        {starterSuggestions.map((suggestion) => {
                          const Icon =
                            CHAT_STARTER_ICONS[suggestion.icon] || FileText;

                          return (
                            <button
                              key={suggestion.id}
                              onClick={() => {
                                setText(suggestion.prompt);
                                setCaretPosition(suggestion.prompt.length);
                              }}
                              className='suggestion-card glass-panel p-4 rounded-xl text-left transition-all group min-h-[120px] flex flex-col justify-between'
                            >
                              <div>
                                <Icon className='text-brand mb-2 w-5 h-5' />
                                <h4 className='font-semibold text-sm mb-1 text-card-foreground'>
                                  {suggestion.title}
                                </h4>
                                <p className='text-xs text-muted-foreground leading-relaxed'>
                                  {suggestion.description}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                    {loadingStarterSuggestions ? (
                      <p className='text-xs text-muted-foreground animate-pulse mt-2'>
                        Personalizing your AI starter prompts...
                      </p>
                    ) : (
                      <div className='glass-panel mt-6 p-4 rounded-xl text-left w-full border border-brand/20 bg-brand/5 backdrop-blur-md max-w-2xl flex gap-3.5 items-start mx-auto'>
                        <div className='p-2 rounded-lg bg-brand/10 text-brand border border-brand/20 shrink-0 mt-0.5'>
                          <Sparkles size={16} />
                        </div>
                        <div className='flex-1 min-w-0'>
                          <h4 className='text-xs font-semibold text-foreground/95 mb-1 flex items-center gap-1.5'>
                            Pro Tip: Direct Outreach for Sales & Marketing
                          </h4>
                          <p className='text-xs text-muted-foreground leading-relaxed'>
                            Are you in Sales or Marketing? You can use the{" "}
                            <button
                              type='button'
                              onClick={() => {
                                setText("/direct-apply ");
                                if (textareaRef.current) textareaRef.current.focus();
                              }}
                              className='font-mono font-bold text-brand hover:underline bg-brand/10 px-1.5 py-0.5 rounded transition-all text-[11px]'
                            >
                              /direct-apply
                            </button>{" "}
                            command to scrape for target companies, retrieve verified contact details, and draft cold outreach emails automatically.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className='flex-1 w-full max-w-4xl mx-auto p-6 space-y-6 pb-8'>
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex gap-4 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {m.role !== "user" && (
                        <div className='w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0 border border-brand/20 mt-1'>
                          <Bot size={16} className='text-brand' />
                        </div>
                      )}
                      <div
                        className={`rounded-2xl shadow-sm ${
                          m.role === "user"
                            ? "max-w-[85%] bg-brand text-primary-foreground font-medium rounded-tr-sm p-4"
                            : m.role === "skill"
                              ? "max-w-[95%] bg-transparent p-0 shadow-none"
                              : "max-w-[85%] glass-panel text-card-foreground rounded-tl-sm p-4"
                        }`}
                      >
                        {m.role === "user" ? (
                          <div className='text-sm break-words whitespace-pre-wrap'>
                            <UserChatAttachment
                              messageId={m.id}
                              hasPastedImage={m.hasPastedImage}
                            />
                            {m.content.trim() ? m.content : null}
                          </div>
                        ) : (
                          <div className='text-sm prose prose-invert max-w-none overflow-hidden'>
                            <AgentWorkTimeline
                              message={m}
                              elapsedLabel={requestElapsedLabel}
                            />
                            <AgentResultPreview message={m} />
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                table: ({ node, ...props }) => (
                                  <div className='my-6 overflow-x-auto rounded-xl border border-border'>
                                    <table
                                      className='w-full text-left text-xs bg-background/40 min-w-[500px] sm:min-w-0'
                                      {...props}
                                    />
                                  </div>
                                ),
                                thead: ({ node, ...props }) => (
                                  <thead
                                    className='bg-accent/40 border-b border-border'
                                    {...props}
                                  />
                                ),
                                tbody: ({ node, ...props }) => (
                                  <tbody {...props} />
                                ),
                                tr: ({ node, ...props }) => (
                                  <tr
                                    className='border-b border-foreground/5 last:border-0'
                                    {...props}
                                  />
                                ),
                                th: ({ node, ...props }) => (
                                  <th
                                    className='px-4 py-2 font-semibold text-brand'
                                    {...props}
                                  />
                                ),
                                td: ({ node, ...props }) => (
                                  <td
                                    className='px-4 py-2 text-muted-foreground'
                                    {...props}
                                  />
                                ),
                                code: ({
                                  node,
                                  inline,
                                  className,
                                  children,
                                  ...props
                                }: any) => {
                                  const match = /language-(\w+)/.exec(
                                    className || "",
                                  );
                                  const lang = match ? match[1] : "";
                                  
                                  if (!inline && lang && lang.startsWith("chart")) {
                                    try {
                                      const parsed = JSON.parse(String(children));
                                      const chartType = lang.replace("chart-", "").replace("chart", "bar");
                                      const title = parsed.title || "";
                                      const data = parsed.data || [];
                                      const keys = parsed.keys || [];
                                      const colors = parsed.colors || ["hsl(var(--brand))", "hsl(var(--accent))", "#10b981", "#f59e0b", "#6366f1"];
                                      
                                      return (
                                        <div className="my-6 p-4 rounded-xl border border-border bg-card/40 glass-panel overflow-hidden">
                                          {title && <h5 className="text-sm font-semibold text-foreground mb-3">{title}</h5>}
                                          <div className="w-full h-[240px] text-xs">
                                            <ResponsiveContainer width="100%" height="100%">
                                              {chartType === "line" ? (
                                                <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                                                  <XAxis dataKey="name" stroke="hsl(var(--foreground) / 0.5)" />
                                                  <YAxis stroke="hsl(var(--foreground) / 0.5)" />
                                                  <Tooltip 
                                                    contentStyle={{ 
                                                      background: "hsl(var(--card))", 
                                                      border: "1px solid hsl(var(--border))",
                                                      borderRadius: "8px",
                                                      color: "hsl(var(--foreground))" 
                                                    }} 
                                                  />
                                                  <Legend />
                                                  {keys.map((key: string, idx: number) => (
                                                    <Line key={key} type="monotone" dataKey={key} stroke={colors[idx % colors.length]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                                  ))}
                                                </LineChart>
                                              ) : chartType === "pie" ? (
                                                <PieChart>
                                                  <Pie
                                                    data={data}
                                                    cx="50%"
                                                    cy="50%"
                                                    labelLine={false}
                                                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                                    outerRadius={80}
                                                    fill="#8884d8"
                                                    dataKey={keys[0] || "value"}
                                                  >
                                                    {data.map((entry: any, index: number) => (
                                                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                                                    ))}
                                                  </Pie>
                                                  <Tooltip 
                                                    contentStyle={{ 
                                                      background: "hsl(var(--card))", 
                                                      border: "1px solid hsl(var(--border))",
                                                      borderRadius: "8px",
                                                      color: "hsl(var(--foreground))" 
                                                    }} 
                                                  />
                                                  <Legend />
                                                </PieChart>
                                              ) : chartType === "area" ? (
                                                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                                                  <XAxis dataKey="name" stroke="hsl(var(--foreground) / 0.5)" />
                                                  <YAxis stroke="hsl(var(--foreground) / 0.5)" />
                                                  <Tooltip 
                                                    contentStyle={{ 
                                                      background: "hsl(var(--card))", 
                                                      border: "1px solid hsl(var(--border))",
                                                      borderRadius: "8px",
                                                      color: "hsl(var(--foreground))" 
                                                    }} 
                                                  />
                                                  <Legend />
                                                  {keys.map((key: string, idx: number) => (
                                                    <Area key={key} type="monotone" dataKey={key} stroke={colors[idx % colors.length]} fill={colors[idx % colors.length]} fillOpacity={0.2} />
                                                  ))}
                                                </AreaChart>
                                              ) : (
                                                <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                                                  <XAxis dataKey="name" stroke="hsl(var(--foreground) / 0.5)" />
                                                  <YAxis stroke="hsl(var(--foreground) / 0.5)" />
                                                  <Tooltip 
                                                    contentStyle={{ 
                                                      background: "hsl(var(--card))", 
                                                      border: "1px solid hsl(var(--border))",
                                                      borderRadius: "8px",
                                                      color: "hsl(var(--foreground))" 
                                                    }} 
                                                  />
                                                  <Legend />
                                                  {keys.map((key: string, idx: number) => (
                                                    <Bar key={key} dataKey={key} fill={colors[idx % colors.length]} radius={[4, 4, 0, 0]} />
                                                  ))}
                                                </BarChart>
                                              )}
                                            </ResponsiveContainer>
                                          </div>
                                        </div>
                                      );
                                    } catch (err) {
                                      console.error("Failed to parse chart code block:", err);
                                    }
                                  }

                                  return !inline && match ? (
                                    <div className='my-4 rounded-xl border border-border bg-muted/40 overflow-hidden'>
                                      <div className='flex items-center justify-between px-3 py-1.5 bg-accent/40 border-b border-border'>
                                        <span className='text-[10px] font-medium text-foreground/50 uppercase'>
                                          {match[1]}
                                        </span>
                                        <button
                                          onClick={() =>
                                            navigator.clipboard.writeText(
                                              String(children),
                                            )
                                          }
                                          className='text-[10px] text-foreground/40 hover:text-foreground transition-colors'
                                        >
                                          Copy
                                        </button>
                                      </div>
                                      <SyntaxHighlighter
                                        language={match[1]}
                                        style={atomOneDarkStyle as any}
                                        customStyle={{
                                          margin: 0,
                                          background: "transparent",
                                          fontSize: "12px",
                                          padding: "16px",
                                        }}
                                        wrapLongLines
                                        {...props}
                                      >
                                        {String(children).replace(/\n$/, "")}
                                      </SyntaxHighlighter>
                                    </div>
                                  ) : (
                                    <code
                                      className='px-1.5 py-0.5 rounded bg-brand/10 text-brand text-[12px] font-mono border border-brand/20'
                                      {...props}
                                    >
                                      {children}
                                    </code>
                                  );
                                },
                                ul: ({ node, ...props }) => (
                                  <ul
                                    className='list-disc pl-4 space-y-1 my-2 text-muted-foreground marker:text-brand'
                                    {...props}
                                  />
                                ),
                                ol: ({ node, ...props }) => (
                                  <ol
                                    className='list-decimal pl-4 space-y-1 my-2 text-muted-foreground marker:text-brand'
                                    {...props}
                                  />
                                ),
                                li: ({ node, ...props }) => (
                                  <li className='pl-1' {...props} />
                                ),
                                strong: ({ node, ...props }) => (
                                  <strong
                                    className='text-foreground font-semibold'
                                    {...props}
                                  />
                                ),
                                p: ({ node, ...props }) => (
                                  <p
                                    className='mb-2 last:mb-0 leading-relaxed text-muted-foreground'
                                    {...props}
                                  />
                                ),
                                h1: ({ node, ...props }) => (
                                  <h1
                                    className='text-2xl font-bold text-foreground mb-4 mt-6 first:mt-0'
                                    {...props}
                                  />
                                ),
                                h2: ({ node, ...props }) => (
                                  <h2
                                    className='text-xl font-bold text-foreground mb-3 mt-5 first:mt-0'
                                    {...props}
                                  />
                                ),
                                h3: ({ node, ...props }) => (
                                  <h3
                                    className='text-lg font-semibold text-foreground mb-2 mt-4 first:mt-0'
                                    {...props}
                                  />
                                ),
                                h4: ({ node, ...props }) => (
                                  <h4
                                    className='text-base font-semibold text-foreground mb-2 mt-3 first:mt-0'
                                    {...props}
                                  />
                                ),
                              }}
                            >
                              {m.content}
                            </ReactMarkdown>
                            {m.streaming &&
                              (m.content ? (
                                <span className='inline-block w-1.5 h-4 ml-1 align-middle bg-brand animate-pulse' />
                              ) : null)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className='shrink-0 border-t border-border bg-background/95 px-4 py-4 backdrop-blur md:px-6 relative'>
              <div className='w-full max-w-4xl mx-auto relative'>
                {messages.length > 0 && showScrollToBottom && (
                  <div className='absolute bottom-full left-1/2 -translate-x-1/2 mb-4 z-20 pointer-events-none'>
                    <button
                      onClick={() => scrollToBottom()}
                      className='pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-brand/30 bg-card/95 text-brand shadow-lg shadow-black/20 backdrop-blur transition hover:bg-card'
                      title='Scroll to latest'
                    >
                      <ArrowDown size={18} />
                    </button>
                  </div>
                )}

                <div
                  className={`relative rounded-[32px] border border-border shadow-2xl overflow-visible transition-all duration-300 ${
                    text.trim() || attachments.length
                      ? "bg-card ring-1 ring-brand/50 border-brand/50"
                      : "bg-card/85 backdrop-blur-xl"
                  }`}
                >
                  <input
                    type='file'
                    ref={fileInputRef}
                    multiple
                    accept='image/*'
                    className='hidden'
                    onChange={handleFileSelect}
                  />

                  {attachments.length > 0 && (
                    <div className='px-6 pt-3 pb-1 border-b border-border/40 bg-background/20'>
                      <div className='flex flex-wrap gap-2'>
                        {attachments.map((attachment, index) => (
                          <div
                            key={`${attachment.name}-${attachment.lastModified}-${index}`}
                            className='inline-flex min-w-0 items-center gap-2 bg-accent/40 px-3 py-1.5 rounded-xl text-xs font-medium text-foreground border border-border'
                          >
                            {attachmentPreviewUrls[index] ? (
                              <img
                                src={attachmentPreviewUrls[index] || ""}
                                alt=''
                                className='h-8 w-8 rounded-md object-cover border border-border shrink-0'
                              />
                            ) : (
                              <Paperclip size={12} className='text-brand' />
                            )}
                            <span className='max-w-[150px] truncate'>
                              {attachment.name}
                            </span>
                            <button
                              type='button'
                              onClick={() => {
                                setAttachments((current) =>
                                  current.filter((_, i) => i !== index),
                                );
                                if (fileInputRef.current)
                                  fileInputRef.current.value = "";
                              }}
                              className='ml-1 hover:text-brand'
                              aria-label={`Remove ${attachment.name}`}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div
                    className={`grid gap-x-2 transition-all duration-300 px-4 py-3 min-h-[56px] ${
                      isMultiline
                        ? "grid-cols-[auto_1fr_auto] grid-rows-[auto_auto] items-end"
                        : "grid-cols-[auto_1fr_auto] grid-rows-[auto_auto] items-end md:grid-cols-[auto_1fr_auto] md:grid-rows-[1fr] md:items-center"
                    }`}
                  >
                    {/* Textarea input area */}
                    <div
                      className={`min-w-0 transition-all duration-300 ${
                        isMultiline
                          ? "col-span-3 row-start-1 mb-1.5"
                          : "col-span-3 row-start-1 mb-1.5 md:col-span-1 md:row-start-1 md:mb-0"
                      }`}
                    >
                      <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={(e) => {
                          setText(e.target.value);
                          setCaretPosition(e.currentTarget.selectionStart);
                        }}
                        onClick={(e) =>
                          setCaretPosition(e.currentTarget.selectionStart)
                        }
                        onFocus={(e) =>
                          setCaretPosition(e.currentTarget.selectionStart)
                        }
                        onKeyUp={(e) =>
                          setCaretPosition(e.currentTarget.selectionStart)
                        }
                        onSelect={(e) =>
                          setCaretPosition(e.currentTarget.selectionStart)
                        }
                        onPaste={handlePasteImage}
                        onKeyDown={(e) => {
                          if (skillPaletteOpen) {
                            if (e.key === "ArrowDown") {
                              e.preventDefault();
                              setSkillPaletteActiveIndex((index) =>
                                Math.min(index + 1, skillPaletteSkills.length - 1),
                              );
                              return;
                            }
                            if (e.key === "ArrowUp") {
                              e.preventDefault();
                              setSkillPaletteActiveIndex((index) =>
                                Math.max(index - 1, 0),
                              );
                              return;
                            }
                            if (e.key === "Enter" || e.key === "Tab") {
                              e.preventDefault();
                              selectSkillFromPalette(
                                skillPaletteSkills[skillPaletteActiveIndex] ||
                                  skillPaletteSkills[0],
                              );
                              return;
                            }
                            if (e.key === "Escape") {
                              e.preventDefault();
                              setDismissedSkillPaletteToken(
                                skillPaletteTrigger?.token || null,
                              );
                              return;
                            }
                          }
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (text.trim() || attachments.length)
                              handleSubmit({ text } as any);
                          }
                        }}
                        className='w-full bg-transparent border-none focus:ring-0 text-foreground placeholder:text-muted-foreground/60 py-1.5 px-1.5 resize-none max-h-36 text-base outline-none leading-normal scrollbar-hide'
                        placeholder='Ask your Career Command Center...'
                        rows={1}
                        style={{ height: "auto", minHeight: "24px" }}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          setCaretPosition(target.selectionStart);
                          target.style.height = "auto";
                          target.style.height = `${target.scrollHeight}px`;
                        }}
                      />
                    </div>

                    <div className='absolute bottom-full left-0 right-0 mb-2'>
                      <ChatSkillCommandPalette
                        open={skillPaletteOpen}
                        mode={skillPaletteTrigger?.mode || "slash"}
                        skills={skillPaletteSkills}
                        activeIndex={skillPaletteActiveIndex}
                        onSelect={selectSkillFromPalette}
                      />
                    </div>

                    {/* Left: Plus button */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-foreground/5 transition-colors col-start-1 ${
                        isMultiline
                          ? "row-start-2"
                          : "row-start-2 md:row-start-1"
                      } ${
                        attachments.length ? "text-brand" : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="Upload files"
                    >
                      <Plus size={20} />
                    </button>

                    {/* Right: Controls */}
                    <div
                      className={`flex items-center gap-2 shrink-0 col-start-3 ${
                        isMultiline
                          ? "row-start-2"
                          : "row-start-2 md:row-start-1"
                      }`}
                    >
                      {/* Custom Dropdown */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setDropdownOpen((prev) => !prev)}
                          className="flex items-center gap-1 py-1.5 px-3 rounded-full text-xs font-semibold bg-foreground/5 text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-all border border-border"
                        >
                          <span>{persona === "concise" ? "Ask: plan" : "Agent: do work"}</span>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
                        </button>

                        {dropdownOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setDropdownOpen(false)}
                            />
                            <div className="absolute right-0 bottom-full mb-2 z-50 w-36 rounded-xl border border-border bg-card/95 p-1 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
                              <button
                                type="button"
                                onClick={() => {
                                  setPersona("concise");
                                  setDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                                  persona === "concise"
                                    ? "text-brand bg-brand/10"
                                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                                }`}
                              >
                                Ask: plan
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPersona("analyst");
                                  setDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                                  persona === "analyst"
                                    ? "text-brand bg-brand/10"
                                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                                }`}
                              >
                                Agent: do work
                              </button>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Voice Mic Button */}
                      <button
                        type="button"
                        onClick={toggleListening}
                        className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                          isListening
                            ? "bg-brand/15 text-brand animate-pulse hover:bg-brand/25"
                            : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                        }`}
                        title={isListening ? "Listening... Click to stop" : "Voice input"}
                      >
                        <Mic size={18} />
                      </button>

                      {/* Send Button */}
                      <button
                        onClick={() =>
                          (text.trim() || attachments.length > 0) &&
                          handleSubmit({ text } as any)
                        }
                        disabled={
                          (!text.trim() && attachments.length === 0) ||
                          isChatBusy
                        }
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
                          text.trim() || attachments.length
                            ? "bg-white text-black shadow-lg hover:bg-neutral-100"
                            : "bg-muted text-muted-foreground/60 cursor-not-allowed"
                        }`}
                        title="Send message"
                      >
                        <ArrowUp size={18} className="font-semibold" />
                      </button>
                    </div>
                  </div>
                </div>
                <p className='text-center text-[10px] text-muted-foreground mt-3 uppercase tracking-widest font-medium'>
                  JobRaker AI can make mistakes. Check important information.
                </p>
              </div>
            </div>

            <div className='fixed -bottom-48 -right-48 w-96 h-96 bg-brand/5 rounded-full blur-[120px] pointer-events-none'></div>
            <div className='fixed top-24 left-96 w-64 h-64 bg-brand/5 rounded-full blur-[100px] pointer-events-none'></div>
          </main>

        </>
      )}
    </div>
  );
};

export default ChatPage;
