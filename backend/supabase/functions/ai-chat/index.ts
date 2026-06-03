
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createGeminiClient,
  GEMINI_MODEL,
  GEMINI_LITE_MODEL,
  GEMINI_PREMIUM_MODEL,
  withGeminiRetry,
  isGeminiRateLimitError,
} from "../_shared/gemini.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { fetchUserContext, formatUserContextForPrompt } from "../_shared/user-context.ts";
import { APP_INTERFACE_GUIDE } from "../_shared/app-map.ts";
import { APP_PAGES, resolveAppPage } from "../_shared/app-pages.ts";
import {
  EDGE_FUNCTIONS,
  getEdgeFunctionDefinition,
} from "../_shared/edge-function-registry.ts";
import {
  normalizeSubscriptionTier,
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";
import {
  agentCreateJobRelatedDraft,
  agentLabelJobRelatedEmails,
  agentSearchJobRelatedEmails,
  agentSendJobRelatedEmail,
} from "../_shared/gmail-job-agent-tools.ts";
import {
  createAnswerBankEntry,
  deleteAnswerBankEntry,
  fetchAnswerBankEntries,
  generateAnswerBankEntries,
  normalizeAnswerBankSlug,
  updateAnswerBankEntry,
  upsertGeneratedAnswerBankEntries,
  ALL_THEMES,
} from "../_shared/answer-bank.ts";
import { syncUserVectorChunks } from "../_shared/vector-sync.ts";
import { embedText } from "../_shared/embeddings.ts";
import { createNotificationRecord } from "../_shared/notification-center.ts";
import { refundAiChatTurn, refundUserCredits } from "../_shared/refunds.ts";

console.log("JobRaker AI Chat Starting...");

const MAX_CHAT_IMAGES = 3;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const DEFAULT_APPLICATION_SYNC_LIMIT = 5;
const MAX_APPLICATION_SYNC_LIMIT = 12;
const DEFAULT_APPLICATION_LIST_LIMIT = 12;
const MAX_APPLICATION_LIST_LIMIT = 25;
const SKYVERN_TERMINAL_PROVIDER_STATUSES = new Set([
  "succeeded",
  "completed",
  "failed",
  "error",
  "cancelled",
  "canceled",
  "timed_out",
  "terminated",
]);
const ACTIVE_APPLICATION_STATUSES = new Set(["Pending", "Applied", "Interview"]);
const APPLICATION_STATUSES = new Set([
  "Draft",
  "Pending",
  "Applied",
  "Failed",
  "Terminated",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
]);

type SupabaseLikeClient = ReturnType<typeof createClient>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => asString(item))
      .filter((item): item is string => Boolean(item));
  }
  const direct = asString(value);
  if (!direct) return [];
  return direct
    .split(/\r?\n|,\s*|\s+;\s*/g)
    .map((item) => item.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean);
}

function normalizeDomain(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    const normalized = raw
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "")
      .trim();
    return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized) ? normalized : null;
  }
}

function extractTargetDomainsFromText(value: unknown): string[] {
  const text = asString(value) || "";
  const domains = new Set<string>();
  for (const match of text.matchAll(/\bsite:([a-z0-9.-]+\.[a-z]{2,})(?:\/[^\s)"']*)?/gi)) {
    const domain = normalizeDomain(match[1]);
    if (domain) domains.add(domain);
  }
  for (const match of text.matchAll(/https?:\/\/[^\s<>"')]+/gi)) {
    const domain = normalizeDomain(match[0]);
    if (domain) domains.add(domain);
  }
  return Array.from(domains).slice(0, 12);
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function extractThoughtSummary(parts: unknown[]): string | null {
  const summaries: string[] = [];

  for (const part of parts) {
    if (!isRecord(part)) continue;

    if (part.thought === true) {
      const text = asString(part.text);
      if (text) summaries.push(text);
      continue;
    }

    if (part.type === "thought_summary" && isRecord(part.content)) {
      const text = asString(part.content.text);
      if (text) summaries.push(text);
      continue;
    }

    if (Array.isArray(part.summary)) {
      for (const item of part.summary) {
        if (!isRecord(item)) continue;
        const text = asString(item.text);
        if (text) summaries.push(text);
      }
    }
  }

  if (!summaries.length) return null;
  return summaries.join(" ").replace(/\s+/g, " ").trim().slice(0, 500);
}

type AgentToolResultEntry = {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
};

function summarizeCount(value: unknown, fallback = 0) {
  const parsed = asNumber(value);
  return parsed == null ? fallback : parsed;
}

function formatJobLine(job: unknown, index: number) {
  if (!isRecord(job)) return null;
  const title = asString(job.title) || asString(job.job_title) || "Untitled role";
  const company = asString(job.company) || "Unknown company";
  const location = asString(job.location);
  const source = asString(job.source_kind) || asString(job.source_type);
  const verification = asString(job.verification_status);
  const url = asString(job.url) || asString(job.job_url);
  const metadata = [location, source, verification].filter(Boolean).join(" | ");
  return `${index + 1}. ${title} at ${company}${metadata ? ` (${metadata})` : ""}${url ? `\n   ${url}` : ""}`;
}

function unwrapToolResultPayload(result: Record<string, unknown>) {
  return isRecord(result.data) ? result.data : result;
}

function summarizeAgentToolResults(entries: AgentToolResultEntry[]) {
  if (!entries.length) {
    return "I did not receive a final result from the agent tools. Please try again or send Continue and I will pick up from the last step.";
  }

  const lines: string[] = [];
  let addedActionableSummary = false;
  let checkedWithoutAction = false;
  let blockedOrIncomplete = false;

  const suppressNoopTool = (name: string) =>
    [
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
    ].includes(name);

  const isNonUserFacingToolError = (message: string) =>
    /jobDescription and resumeText are required/i.test(message) ||
    /took longer than \d+ seconds/i.test(message) ||
    /stopped waiting/i.test(message) ||
    /required$/i.test(message);

  for (const entry of entries.slice(-8)) {
    const result = isRecord(entry.result) ? entry.result : {};
    const payload = unwrapToolResultPayload(result);
    const toolName = entry.name.replace(/_/g, " ");
    const error =
      asString(result.error) ||
      asString(payload.error) ||
      asString(result.failure_reason) ||
      asString(payload.failure_reason);
    if (error || result.success === false || payload.success === false) {
      if (suppressNoopTool(entry.name) || isNonUserFacingToolError(error || "")) {
        blockedOrIncomplete = true;
        continue;
      }
      lines.push(`- ${toolName} failed: ${error || "No details returned."}`);
      addedActionableSummary = true;
      continue;
    }

    if (entry.name === "run_job_search" || entry.name === "search_public_job_sources") {
      const jobs = Array.isArray(payload.jobs)
        ? payload.jobs
        : Array.isArray(payload.results)
          ? payload.results
          : [];
      const count = summarizeCount(payload.count, jobs.length);
      const inserted = summarizeCount(payload.jobsInserted, summarizeCount(payload.inserted, -1));
      const query = asString(entry.args.query) || asString(entry.args.searchQuery);
      const savedText = inserted >= 0 ? `, ${inserted} saved to your job queue` : "";
      lines.push(`- Searched${query ? ` "${query}"` : ""}: ${count} job${count === 1 ? "" : "s"} found${savedText}.`);
      const jobLines = jobs.slice(0, 6).map(formatJobLine).filter((line): line is string => Boolean(line));
      if (jobLines.length) {
        lines.push(...jobLines.map((line) => `  ${line}`));
      }
      const warnings = Array.isArray(payload.warnings)
        ? payload.warnings.map((warning) => asString(warning)).filter(Boolean)
        : [];
      if (warnings.length) lines.push(`- Note: ${warnings.slice(0, 2).join(" ")}`);
      addedActionableSummary = true;
      continue;
    }

    if (entry.name === "find_company_contact_channels") {
      const contacts = Array.isArray(payload.contacts) ? payload.contacts : [];
      const verifiedContacts = contacts
        .filter((contact) => isRecord(contact))
        .filter((contact) => {
          const confidence = asString(contact.confidence)?.toLowerCase();
          const safeToDraft = contact.safeToDraft === true;
          return safeToDraft || confidence === "high" || confidence === "medium";
        });
      if (verifiedContacts.length) {
        lines.push(
          `- Found ${verifiedContacts.length} reviewable company contact channel${verifiedContacts.length === 1 ? "" : "s"}.`,
        );
        for (const contact of verifiedContacts.slice(0, 6)) {
          const company = asString(contact.companyName) || "Company";
          const email = asString(contact.contactEmail);
          const careersPage = asString(contact.careersPageUrl);
          lines.push(`  ${company}${email ? `: ${email}` : ""}${careersPage ? ` (${careersPage})` : ""}`);
        }
        addedActionableSummary = true;
      } else {
        checkedWithoutAction = true;
      }
      continue;
    }

    if (entry.name === "generate_cover_letter" || entry.name === "save_cover_letter") {
      const name = asString(payload.name) || asString(payload.title) || asString(entry.args.name);
      lines.push(`- ${toolName}: ${name ? `${name} - ` : ""}completed.`);
      addedActionableSummary = true;
      continue;
    }

    if (entry.name === "list_applications") {
      checkedWithoutAction = true;
      continue;
    }

    if (entry.name === "list_notifications") {
      checkedWithoutAction = true;
      continue;
    }

    if (entry.name === "get_credits_balance") {
      const turns = summarizeCount(payload.total_available_chat_turns, -1);
      const paid = summarizeCount(payload.paid_ai_credit_balance, -1);
      if (turns >= 0 || paid >= 0) {
        lines.push(`- Credit balance checked${turns >= 0 ? `: ${turns} total chat turns available` : ""}${paid >= 0 ? `, ${paid} paid AI credits` : ""}.`);
        addedActionableSummary = true;
      }
      continue;
    }

    if (suppressNoopTool(entry.name)) {
      checkedWithoutAction = true;
      continue;
    }

    const count = summarizeCount(payload.count, -1);
    if (count >= 0) {
      checkedWithoutAction = true;
    } else if (result.success === true || payload.success === true) {
      checkedWithoutAction = true;
    }
  }

  if (!addedActionableSummary) {
    if (blockedOrIncomplete) {
      return "I checked the available results, but I could not complete every analysis step cleanly. I did not find a new user-facing result worth showing yet. Tell me to continue and I will keep working from the last successful step.";
    }
    return checkedWithoutAction
      ? "I checked the available JobRaker data, but I did not find a new actionable result to show yet. Tell me to continue and I will keep working from the last step."
      : "I finished the tool work, but there was no user-facing result to show. Tell me to continue and I will keep working from here.";
  }

  lines.unshift("Here is the result:");
  lines.push("\nNext step: review the saved results in JobRaker, or tell me to continue and I will keep working from here.");
  return lines.join("\n");
}

function normalizeApplicationStatus(value: unknown, fallback = "Applied"): string {
  const raw = asString(value) || fallback;
  const normalized = raw
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();
  const aliases: Record<string, string> = {
    draft: "Draft",
    ready: "Draft",
    pending: "Pending",
    queued: "Pending",
    sent: "Applied",
    submitted: "Applied",
    applied: "Applied",
    outreach: "Applied",
    "outreach sent": "Applied",
    failed: "Failed",
    error: "Failed",
    terminated: "Terminated",
    interview: "Interview",
    interviewing: "Interview",
    offer: "Offer",
    rejected: "Rejected",
    withdrawn: "Withdrawn",
  };
  const status = aliases[normalized] || raw;
  return APPLICATION_STATUSES.has(status) ? status : fallback;
}

function canonicalStageFromApplicationStatus(status: string): string {
  switch (status) {
    case "Draft":
      return "draft_ready";
    case "Pending":
      return "queued";
    case "Applied":
      return "submitted";
    case "Failed":
      return "failed";
    case "Terminated":
      return "terminated";
    case "Interview":
      return "interview";
    case "Offer":
      return "offer";
    case "Rejected":
      return "rejected";
    case "Withdrawn":
      return "withdrawn";
    default:
      return "submitted";
  }
}

function clampNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = asNumber(value);
  if (parsed == null) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function buildProfileSnapshot(profile: Record<string, unknown> | null): string {
  if (!profile) return "";
  const lines: string[] = [];
  const fullName = [asString(profile.first_name), asString(profile.last_name)]
    .filter(Boolean)
    .join(" ");
  if (fullName) lines.push(`Name: ${fullName}`);
  const jobTitle = asString(profile.job_title);
  if (jobTitle) lines.push(`Current title: ${jobTitle}`);
  const location = asString(profile.location);
  if (location) lines.push(`Location: ${location}`);
  const years = asNumber(profile.experience_years);
  if (years != null) lines.push(`Experience years: ${years}`);
  const goals = Array.isArray(profile.goals)
    ? profile.goals.filter((goal): goal is string => typeof goal === "string" && goal.trim().length > 0)
    : [];
  if (goals.length > 0) lines.push(`Goals: ${goals.join(", ")}`);
  const phone = asString(profile.phone);
  if (phone) lines.push(`Phone: ${phone}`);
  return lines.join("\n");
}

const PUBLIC_PROFILE_SITE_FIELDS =
  "id, user_id, slug, is_public, theme, headline, intro, cta_label, contact_email, links, design, section_order, views, created_at, updated_at";
const PUBLIC_PROFILE_THEMES = new Set(["obsidian", "atelier", "prism", "mono"]);
const PUBLIC_PROFILE_SECTIONS = new Set(["hero", "signal", "experience", "skills", "education", "contact"]);
const PUBLIC_PROFILE_BASE_URL =
  Deno.env.get("PUBLIC_APP_URL") ||
  Deno.env.get("APP_BASE_URL") ||
  "https://app.jobraker.io";

function slugifyPublicProfile(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54);
}

function normalizePublicProfileSlug(value: unknown, fallback: string) {
  const raw = asString(value);
  const slug = slugifyPublicProfile(raw || fallback);
  const withFallback = slug || slugifyPublicProfile(fallback) || "jobraker-profile";
  return withFallback.match(/^[a-z0-9][a-z0-9-]{2,62}$/)
    ? withFallback
    : `jobraker-profile-${crypto.randomUUID().slice(0, 6)}`;
}

function normalizePublicProfileTheme(value: unknown) {
  const theme = asString(value)?.toLowerCase();
  return theme && PUBLIC_PROFILE_THEMES.has(theme) ? theme : undefined;
}

function normalizePublicProfileLinks(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter(isRecord)
    .map((item) => ({
      label: (asString(item.label) || asString(item.title) || "Link").slice(0, 40),
      url: asString(item.url) || "",
    }))
    .filter((item) =>
      item.url.startsWith("https://") ||
      item.url.startsWith("mailto:"),
    )
    .slice(0, 6);
}

function normalizePublicProfileDesign(value: unknown) {
  if (!isRecord(value)) return undefined;
  const design: Record<string, unknown> = {};
  for (const key of ["accent", "alt", "background", "text"]) {
    const color = asString(value[key]);
    if (color && /^#[0-9a-f]{3,8}$/i.test(color)) design[key] = color;
  }
  for (const key of ["density", "motion", "texture", "tone"]) {
    const text = asString(value[key]);
    if (text) design[key] = text.slice(0, 80);
  }
  if (typeof value.showWatermark === "boolean") {
    design.showWatermark = value.showWatermark;
  } else if (typeof value.watermark === "boolean") {
    design.showWatermark = value.watermark;
  }
  return Object.keys(design).length > 0 ? design : undefined;
}

function normalizePublicProfileSectionOrder(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const sections = value
    .map((item) => asString(item)?.toLowerCase())
    .filter((item): item is string => Boolean(item && PUBLIC_PROFILE_SECTIONS.has(item)))
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
  return sections.length > 0 ? sections : undefined;
}

function buildDefaultPublicProfileSite(userId: string, context: Record<string, unknown> | null) {
  const name = asString(context?.name);
  const headline = asString(context?.headline) || "Career profile";
  const slug = normalizePublicProfileSlug(
    name || headline,
    `${name || headline || "jobraker-profile"}-${userId.slice(0, 6)}`,
  );

  return {
    user_id: userId,
    slug,
    is_public: false,
    theme: "obsidian",
    headline,
    intro: null,
    cta_label: "Start a conversation",
    links: [],
    design: {
      accent: "#1dff00",
      density: "cinematic",
      motion: "scroll-scrub",
      texture: "shader-glass",
    },
    section_order: ["hero", "signal", "experience", "skills", "education", "contact"],
  };
}

async function fetchPublicProfileSite(serviceClient: SupabaseLikeClient, userId: string) {
  const { data, error } = await serviceClient
    .from("public_profile_sites")
    .select(PUBLIC_PROFILE_SITE_FIELDS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function ensurePublicProfileSite(
  serviceClient: SupabaseLikeClient,
  userId: string,
  context: Record<string, unknown> | null,
) {
  const existing = await fetchPublicProfileSite(serviceClient, userId);
  if (existing) return existing;

  const payload = buildDefaultPublicProfileSite(userId, context);
  const { data, error } = await serviceClient
    .from("public_profile_sites")
    .insert(payload)
    .select(PUBLIC_PROFILE_SITE_FIELDS)
    .single();
  if (error) throw error;
  return data;
}

function buildPublicProfilePatch(args: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  const slug = asString(args.slug);
  if (slug) patch.slug = normalizePublicProfileSlug(slug, slug);
  const theme = normalizePublicProfileTheme(args.theme);
  if (theme) patch.theme = theme;
  if (typeof args.is_public === "boolean") patch.is_public = args.is_public;
  for (const [argKey, column] of [
    ["headline", "headline"],
    ["intro", "intro"],
    ["cta_label", "cta_label"],
    ["contact_email", "contact_email"],
  ] as const) {
    if (Object.prototype.hasOwnProperty.call(args, argKey)) {
      patch[column] = asString(args[argKey]);
    }
  }
  const links = normalizePublicProfileLinks(args.links);
  if (links) patch.links = links;
  const design = normalizePublicProfileDesign(args.design);
  if (design) patch.design = design;
  const sectionOrder = normalizePublicProfileSectionOrder(args.section_order);
  if (sectionOrder) patch.section_order = sectionOrder;
  return patch;
}

function formatPublicProfileSiteResult(site: Record<string, unknown> | null) {
  if (!site) return null;
  const slug = asString(site.slug) || "";
  return {
    ...site,
    public_url: slug ? `${PUBLIC_PROFILE_BASE_URL.replace(/\/$/, "")}/u/${slug}` : null,
    preview_route: slug ? `/u/${slug}` : null,
  };
}

async function resolveAutoApplyArtifacts(
  serviceClient: SupabaseLikeClient,
  userId: string,
) {
  const { data: profileRow } = await serviceClient
    .from("profiles")
    .select("first_name, last_name, job_title, experience_years, location, goals, phone")
    .eq("id", userId)
    .maybeSingle();

  const { data: resumeRows } = await serviceClient
    .from("resumes")
    .select("id, name, file_path, file_ext, is_favorite, updated_at")
    .eq("user_id", userId)
    .order("is_favorite", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(5);

  const preferredResume =
    Array.isArray(resumeRows) && resumeRows.length > 0 ? resumeRows[0] : null;

  let resumeUrl = "";
  if (preferredResume?.file_path) {
    try {
      const { data } = await serviceClient.storage
        .from("resumes")
        .createSignedUrl(preferredResume.file_path, 60 * 60 * 48);
      resumeUrl = data?.signedUrl || "";
    } catch (error) {
      console.warn("ai-chat.resolveAutoApplyArtifacts.resumeSignedUrl", error);
    }
  }

  let resumeText = "";
  if (preferredResume?.id) {
    const { data: parsedResume } = await serviceClient
      .from("parsed_resumes")
      .select("raw_text")
      .eq("user_id", userId)
      .eq("resume_id", preferredResume.id)
      .order("extracted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    resumeText = asString(parsedResume?.raw_text) || "";
  }

  if (!resumeText) {
    const { data: parsedResume } = await serviceClient
      .from("parsed_resumes")
      .select("raw_text")
      .eq("user_id", userId)
      .order("extracted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    resumeText = asString(parsedResume?.raw_text) || "";
  }

  const userInput = isRecord(profileRow) ? profileRow : {};

  return {
    profileRow: isRecord(profileRow) ? profileRow : null,
    profileSnapshot: buildProfileSnapshot(isRecord(profileRow) ? profileRow : null),
    userInput,
    preferredResume,
    resumeUrl,
    resumeText,
  };
}

const RESUME_STATUSES = new Set(["Active", "Draft", "Archived"]);
const RESUME_PLACEHOLDER_NAMES = new Set([
  "john doe",
  "jane doe",
  "alex johnson",
  "candidate name",
  "your name",
  "guest user",
  "test user",
]);

function isResumePlaceholderName(value: unknown): boolean {
  const normalized = asString(value)?.toLowerCase().replace(/\s+/g, " ") || "";
  return !normalized || RESUME_PLACEHOLDER_NAMES.has(normalized);
}

function buildAuthenticatedProfileBasics(profile: Record<string, unknown> | null) {
  const firstName = asString(profile?.first_name);
  const lastName = asString(profile?.last_name);
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return {
    name: !isResumePlaceholderName(name) ? name : null,
    headline: asString(profile?.job_title),
    phone: asString(profile?.phone),
    location: asString(profile?.location),
  };
}

function normalizeResumeExperienceItem(
  raw: Record<string, unknown>,
  fallbackId: string,
): Record<string, unknown> {
  const id = asString(raw.id) || fallbackId;
  const company = asString(raw.company) || "";
  const position = asString(raw.position) || asString(raw.title) || "";
  const period = asString(raw.period) || asString(raw.date) || "";
  const description = asString(raw.description) || asString(raw.summary) || "";
  return {
    id,
    hidden: raw.hidden === true,
    company,
    position,
    location: asString(raw.location) || "",
    period: period || "",
    date: asString(raw.date) || period || "",
    summary: asString(raw.summary) || description,
    description,
    website: isRecord(raw.website) ? raw.website : { url: "", label: "" },
    columns: typeof raw.columns === "number" && Number.isFinite(raw.columns) ? raw.columns : 1,
  };
}

function normalizeResumeEducationItem(
  raw: Record<string, unknown>,
  fallbackId: string,
): Record<string, unknown> {
  const id = asString(raw.id) || fallbackId;
  const period =
    asString(raw.period) ||
    asString(raw.date) ||
    [asString(raw.start_date) || asString(raw.start), asString(raw.end_date) || asString(raw.end)]
      .filter(Boolean)
      .join(" - ");
  return {
    id,
    hidden: raw.hidden === true,
    school: asString(raw.school) || asString(raw.institution) || "",
    degree: asString(raw.degree) || asString(raw.field) || "",
    location: asString(raw.location) || "",
    period,
    date: asString(raw.date) || period,
    website: isRecord(raw.website) ? raw.website : { url: "", label: "" },
    columns: typeof raw.columns === "number" && Number.isFinite(raw.columns) ? raw.columns : 1,
  };
}

/**
 * Direct DB update for the resume builder JSON. Used by the agent (no update-resume edge function).
 */
async function runUpdateResumeTool(
  sb: SupabaseLikeClient,
  userId: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const resumeId = asString(args.resume_id);
  const updateAll = args.update_all === true;
  const { data: profileRow } = await sb
    .from("profiles")
    .select("first_name, last_name, job_title, phone, location")
    .eq("id", userId)
    .maybeSingle();
  const profileBasics = buildAuthenticatedProfileBasics(
    isRecord(profileRow) ? profileRow : null,
  );

  let query = sb
    .from("resumes")
    .select("id, name, data, user_id, status")
    .eq("user_id", userId);
  if (resumeId) {
    query = query.eq("id", resumeId);
  } else {
    query = query.order("updated_at", { ascending: false });
  }
  const { data: rows, error: listErr } = await query;
  if (listErr) {
    return { success: false, error: listErr.message };
  }
  let resumes = (rows || []) as Array<{
    id: string;
    name: string;
    data: unknown;
    status?: string;
  }>;
  if (!updateAll && !resumeId && resumes.length > 1) {
    resumes = [resumes[0]];
  }
  if (resumes.length === 0) {
    return { success: false, error: "No resumes found" };
  }

  const setExperience = Array.isArray(args.set_experience_items)
    ? (args.set_experience_items as unknown[]).filter((x) => isRecord(x))
    : null;
  const setEducation = Array.isArray(args.set_education_items)
    ? (args.set_education_items as unknown[]).filter((x) => isRecord(x))
    : null;
  const displayName = asString(args.display_name);
  const requestedFullName = asString(args.full_name);
  const fullName = !isResumePlaceholderName(requestedFullName)
    ? requestedFullName
    : null;
  const headline = asString(args.headline);
  const email = asString(args.email);
  const phone = asString(args.phone);
  const location = asString(args.location);
  const summary = asString(args.summary);
  const statusIn = asString(args.resume_status);
  const newStatus = statusIn && RESUME_STATUSES.has(statusIn) ? statusIn : null;

  const results: string[] = [];
  for (const resume of resumes) {
    const currentData = (resume.data && typeof resume.data === "object" ? resume.data : {}) as Record<
      string,
      unknown
    >;
    const basics = { ...((isRecord(currentData.basics) ? currentData.basics : {}) as Record<string, unknown>) };
    const sum = { ...((isRecord(currentData.summary) ? currentData.summary : {}) as Record<string, unknown>) };
    const changed: string[] = [];

    if (fullName) {
      basics.name = fullName;
      changed.push("name");
    } else if (isResumePlaceholderName(basics.name)) {
      basics.name = profileBasics.name || "";
      changed.push("name");
    }
    if (headline) {
      basics.headline = headline;
      changed.push("headline");
    }
    if (email) {
      basics.email = email;
      changed.push("email");
    }
    if (phone) {
      basics.phone = phone;
      changed.push("phone");
    }
    if (location) {
      basics.location = location;
      changed.push("location");
    }
    if (summary) {
      sum.content = summary;
      sum.hidden = false;
      changed.push("summary");
    }

    const sections = isRecord(currentData.sections) ? { ...currentData.sections } : {};
    if (setExperience && setExperience.length > 0) {
      const existingExp = isRecord(sections.experience) ? (sections.experience as Record<string, unknown>) : {};
      const items = setExperience.map((row) =>
        normalizeResumeExperienceItem(row as Record<string, unknown>, crypto.randomUUID()),
      );
      sections.experience = { ...existingExp, items, hidden: false };
      changed.push("experience");
    }
    if (setEducation && setEducation.length > 0) {
      const existingEducation = isRecord(sections.education)
        ? (sections.education as Record<string, unknown>)
        : {};
      const items = setEducation.map((row) =>
        normalizeResumeEducationItem(row as Record<string, unknown>, crypto.randomUUID()),
      );
      sections.education = { ...existingEducation, items, hidden: false };
      changed.push("education");
    }

    const newData: Record<string, unknown> = {
      ...currentData,
      basics,
      summary: sum,
    };
    if (
      (setExperience && setExperience.length > 0) ||
      (setEducation && setEducation.length > 0)
    ) {
      newData.sections = sections;
    } else {
      newData.sections = currentData.sections;
    }

    const patch: Record<string, unknown> = {
      data: newData,
      updated_at: new Date().toISOString(),
    };
    if (displayName) {
      patch.name = displayName;
      changed.push("display name");
    }
    if (newStatus) {
      patch.status = newStatus;
      changed.push("status");
    }

    if (changed.length === 0) {
      continue;
    }

    const { error: updateErr } = await sb.from("resumes").update(patch).eq("id", resume.id);
    if (updateErr) {
      results.push(`Failed to update "${resume.name}": ${updateErr.message}`);
    } else {
      results.push(`Updated "${resume.name}" (${changed.join(", ")})`);
    }
  }
  if (results.length === 0) {
    return {
      success: false,
      error:
        "No changes applied. Provide at least one of: display_name, full_name, headline, email, phone, location, summary, set_experience_items, set_education_items, resume_status.",
    };
  }
  return { success: true, results, updated_count: results.length };
}

function sanitizeForwardHeaders(raw: unknown): Record<string, string> {
  if (!isRecord(raw)) return {};
  const forbidden = new Set([
    "authorization",
    "apikey",
    "content-length",
    "host",
    "origin",
  ]);
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "string") continue;
    const lower = key.toLowerCase();
    if (forbidden.has(lower)) continue;
    headers[key] = value;
  }
  return headers;
}

async function invokeEdgeFunctionByName(opts: {
  authHeader: string;
  name: string;
  payload?: unknown;
  method?: string | null;
  headers?: unknown;
  timeoutMs?: number;
}) {
  const baseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  if (!baseUrl) {
    return {
      success: false,
      error: "SUPABASE_URL is not configured.",
    };
  }

  const name = opts.name.trim();
  if (!name) {
    return { success: false, error: "Function name is required." };
  }
  if (name === "ai-chat") {
    return {
      success: false,
      error: "ai-chat cannot be invoked from inside the ai-chat agent loop.",
    };
  }

  const method = (opts.method || "POST").toUpperCase();
  let url = `${baseUrl}/functions/v1/${name}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: opts.authHeader,
    ...sanitizeForwardHeaders(opts.headers),
  };
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (anonKey) {
    headers.apikey = headers.apikey || anonKey;
  }

  let body: string | undefined;
  if (method === "GET" && isRecord(opts.payload)) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(opts.payload)) {
      if (value == null) continue;
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        params.set(key, String(value));
      }
    }
    const query = params.toString();
    if (query) url = `${url}?${query}`;
  } else if (opts.payload !== undefined) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    body = JSON.stringify(opts.payload);
  }

  const controller = opts.timeoutMs ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), opts.timeoutMs)
    : null;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      ...(body !== undefined ? { body } : {}),
      ...(controller ? { signal: controller.signal } : {}),
    });
  } catch (error) {
    if (controller?.signal.aborted) {
      return {
        success: false,
        status: 408,
        function: name,
        method,
        error: `${name} took longer than ${Math.round((opts.timeoutMs || 0) / 1000)} seconds, so I stopped waiting and will summarize the results gathered so far.`,
        timeout: true,
      };
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  const rawText = await response.text();
  let data: unknown = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }
  }

  return {
    success: response.ok,
    status: response.status,
    function: name,
    method,
    data,
  };
}

async function fetchApplicationProcessSnapshot(opts: {
  serviceClient: SupabaseLikeClient;
  userId: string;
  applicationId?: string | null;
  limit?: number;
  includeRecentEvents?: boolean;
}) {
  const limit = clampNumber(
    opts.limit,
    DEFAULT_APPLICATION_LIST_LIMIT,
    1,
    MAX_APPLICATION_LIST_LIMIT,
  );

  let query = opts.serviceClient
    .from("applications")
    .select(
      "id, job_id, job_title, company, location, status, canonical_stage, applied_date, updated_at, next_step, interview_date, provider_status, run_id, workflow_id, failure_reason, app_url, receipt_url, success_url, draft_status, ai_confidence_score, user_review_notes",
    )
    .eq("user_id", opts.userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (opts.applicationId) {
    query = query.eq("id", opts.applicationId);
  }

  const { data: applications, error: applicationsError } = await query;
  if (applicationsError) {
    return {
      success: false,
      error: applicationsError.message,
      applications: [],
    };
  }

  const rows = Array.isArray(applications) ? applications : [];
  const applicationIds = rows
    .map((row) => asString((row as Record<string, unknown>).id))
    .filter((value): value is string => Boolean(value));

  let recentEventsByApplication: Record<string, Record<string, unknown>[]> = {};
  if (opts.includeRecentEvents !== false && applicationIds.length > 0) {
    const { data: events } = await opts.serviceClient
      .from("gmail_application_events")
      .select(
        "application_id, event_type, status, confidence, company, job_title, subject, received_at, processed_at",
      )
      .eq("user_id", opts.userId)
      .in("application_id", applicationIds)
      .order("received_at", { ascending: false })
      .limit(applicationIds.length * 5);

    for (const event of Array.isArray(events) ? events : []) {
      const applicationId = asString((event as Record<string, unknown>).application_id);
      if (!applicationId) continue;
      if (!recentEventsByApplication[applicationId]) {
        recentEventsByApplication[applicationId] = [];
      }
      if (recentEventsByApplication[applicationId].length < 3) {
        recentEventsByApplication[applicationId].push(event as Record<string, unknown>);
      }
    }
  }

  const summary = {
    total: rows.length,
    by_status: {} as Record<string, number>,
    by_canonical_stage: {} as Record<string, number>,
    active_count: 0,
    failed_count: 0,
    upcoming_interviews: 0,
  };

  const hydrated = rows.map((row) => {
    const record = row as Record<string, unknown>;
    const status = asString(record.status) || "Pending";
    const canonicalStage = asString(record.canonical_stage) || "queued";
    const applicationId = asString(record.id) || "";
    const interviewDate = asString(record.interview_date);

    summary.by_status[status] = (summary.by_status[status] || 0) + 1;
    summary.by_canonical_stage[canonicalStage] =
      (summary.by_canonical_stage[canonicalStage] || 0) + 1;
    if (ACTIVE_APPLICATION_STATUSES.has(status)) summary.active_count += 1;
    if (canonicalStage === "failed" || canonicalStage === "terminated") {
      summary.failed_count += 1;
    }
    if (interviewDate) {
      const interviewAt = Date.parse(interviewDate);
      if (!Number.isNaN(interviewAt) && interviewAt >= Date.now()) {
        summary.upcoming_interviews += 1;
      }
    }

    return {
      ...record,
      recent_events: recentEventsByApplication[applicationId] || [],
      needs_provider_refresh:
        Boolean(asString(record.run_id)) &&
        !SKYVERN_TERMINAL_PROVIDER_STATUSES.has(
          (asString(record.provider_status) || "").toLowerCase(),
        ),
    };
  });

  return {
    success: true,
    summary,
    applications: hydrated,
  };
}

async function refreshApplicationProcesses(opts: {
  authHeader: string;
  serviceClient: SupabaseLikeClient;
  userId: string;
  applicationId?: string | null;
  includeGmail?: boolean;
  includeSkyvern?: boolean;
  gmailMaxResults?: number;
  force?: boolean;
  limit?: number;
}) {
  const gmailEnabled = opts.includeGmail !== false;
  const skyvernEnabled = opts.includeSkyvern !== false;
  let gmailSync: Record<string, unknown> | null = null;

  if (gmailEnabled) {
    try {
      gmailSync = await invokeEdgeFunctionByName({
        authHeader: opts.authHeader,
        name: "sync-gmail-application-events",
        payload: {
          maxResults: clampNumber(opts.gmailMaxResults, 10, 1, 25),
          force: opts.force === true,
        },
      }) as Record<string, unknown>;
    } catch (error) {
      gmailSync = {
        success: false,
        error: error instanceof Error ? error.message : "Gmail sync failed",
      };
    }
  }

  const limit = clampNumber(
    opts.limit,
    DEFAULT_APPLICATION_SYNC_LIMIT,
    1,
    MAX_APPLICATION_SYNC_LIMIT,
  );

  let automationSync: Record<string, unknown> = {
    success: true,
    synced_runs: [],
  };

  if (skyvernEnabled) {
    let runQuery = opts.serviceClient
      .from("applications")
      .select("id, run_id, provider_status")
      .eq("user_id", opts.userId)
      .not("run_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (opts.applicationId) {
      runQuery = runQuery.eq("id", opts.applicationId);
    }

    const { data: runRows } = await runQuery;
    const syncedRuns: Record<string, unknown>[] = [];

    for (const row of Array.isArray(runRows) ? runRows : []) {
      const record = row as Record<string, unknown>;
      const runId = asString(record.run_id);
      const providerStatus = (asString(record.provider_status) || "").toLowerCase();
      if (!runId) continue;
      if (SKYVERN_TERMINAL_PROVIDER_STATUSES.has(providerStatus)) continue;
      try {
        const syncResult = await invokeEdgeFunctionByName({
          authHeader: opts.authHeader,
          name: "sync-provider-status",
          payload: { run_id: runId },
        });
        syncedRuns.push(syncResult as Record<string, unknown>);
      } catch (error) {
        syncedRuns.push({
          success: false,
          function: "sync-provider-status",
          run_id: runId,
          error: error instanceof Error ? error.message : "Automation sync failed",
        });
      }
    }

    automationSync = {
      success: true,
      synced_runs: syncedRuns,
    };
  }

  const snapshot = await fetchApplicationProcessSnapshot({
    serviceClient: opts.serviceClient,
    userId: opts.userId,
    applicationId: opts.applicationId,
    limit,
    includeRecentEvents: true,
  });

  return {
    success: true,
    gmail_sync: gmailSync,
    automation_sync: automationSync,
    snapshot,
  };
}

const CURATED_DATABASE_SCHEMA = [
  {
    table: "applications",
    purpose: "Application Tracker records, pipeline status, automation state, Gmail/provider links.",
    important_columns: [
      "id",
      "user_id",
      "job_id",
      "job_title",
      "company",
      "location",
      "applied_date",
      "status",
      "canonical_stage",
      "salary",
      "notes",
      "next_step",
      "interview_date",
      "app_url",
      "receipt_url",
      "success_url",
      "provider_status",
      "provider_run_output",
      "draft_status",
      "user_review_notes",
      "match_score",
      "ai_confidence_score",
      "created_at",
      "updated_at",
    ],
  },
  {
    table: "jobs",
    purpose: "Discovered and saved job listings, source metadata, quality/evaluation data, and apply URLs.",
    important_columns: [
      "id",
      "user_id",
      "title",
      "company",
      "location",
      "description",
      "apply_url",
      "source_type",
      "source_kind",
      "source_confidence",
      "salary_min",
      "salary_max",
      "salary_currency",
      "canonical_status",
      "verification_status",
      "hidden",
      "bookmarked",
      "raw_data",
      "created_at",
      "updated_at",
    ],
  },
  {
    table: "notifications",
    purpose: "Notification center alerts for applications, interviews, Gmail events, billing, and job search.",
    important_columns: [
      "id",
      "user_id",
      "type",
      "title",
      "message",
      "company",
      "read",
      "is_starred",
      "priority",
      "source",
      "source_record_id",
      "source_record_type",
      "action_url",
      "action_label",
      "metadata",
      "dedupe_key",
      "archived_at",
      "created_at",
    ],
  },
  {
    table: "gmail_application_events",
    purpose: "Gmail-derived application events like offers, interviews, rejections, assessments, and application receipts.",
    important_columns: [
      "id",
      "user_id",
      "application_id",
      "gmail_message_id",
      "gmail_thread_id",
      "event_type",
      "status",
      "confidence",
      "company",
      "job_title",
      "sender_name",
      "sender_email",
      "subject",
      "snippet",
      "received_at",
      "processed_at",
      "raw",
    ],
  },
  {
    table: "profiles",
    purpose: "Core candidate profile, identity, headline, goals, location, and public profile data.",
    important_columns: ["id", "first_name", "last_name", "job_title", "about", "location", "goals", "experience_years", "updated_at"],
  },
  {
    table: "profile_experiences",
    purpose: "Structured work experience cards on the candidate profile.",
    important_columns: ["id", "user_id", "title", "company", "location", "start_date", "end_date", "is_current", "description", "updated_at"],
  },
  {
    table: "profile_education",
    purpose: "Structured education cards on the candidate profile.",
    important_columns: ["id", "user_id", "degree", "school", "location", "start_date", "end_date", "gpa", "updated_at"],
  },
  {
    table: "profile_skills",
    purpose: "Structured skills with level/category for profile and matching.",
    important_columns: ["id", "user_id", "name", "level", "category", "updated_at"],
  },
  {
    table: "resumes",
    purpose: "Resume library and builder JSON, including active/draft/archive state.",
    important_columns: ["id", "user_id", "name", "status", "data", "file_path", "file_ext", "is_favorite", "updated_at"],
  },
  {
    table: "cover_letters",
    purpose: "Saved cover letters and generated application letters.",
    important_columns: ["id", "user_id", "name", "content", "role", "company", "created_at", "updated_at"],
  },
  {
    table: "answer_bank_entries",
    purpose: "Reusable candidate voice, stories, identity, beliefs, career snippets, and skills evidence for AI drafting.",
    important_columns: ["id", "user_id", "theme", "slug", "question", "body", "tags", "created_at", "updated_at"],
  },
  {
    table: "gmail_connections",
    purpose: "Connected Gmail OAuth state and sync cursor.",
    important_columns: ["user_id", "email", "token_expires_at", "sync_history_id", "updated_at"],
  },
  {
    table: "subscriptions",
    purpose: "Subscription tier, payment provider, billing period, and expiration/renewal state.",
    important_columns: ["id", "user_id", "tier", "status", "provider", "current_period_start", "current_period_end", "cancel_at_period_end", "updated_at"],
  },
  {
    table: "ai_credit_balances",
    purpose: "Paid/included credit accounting for chat, tools, search, and automation.",
    important_columns: ["user_id", "balance", "included_balance", "updated_at"],
  },
] as const;

async function fetchDatabaseSchemaSnapshot(serviceClient: SupabaseLikeClient, opts: {
  tableName?: string | null;
  includeColumns?: boolean;
}) {
  const tableName = opts.tableName?.trim();
  const includeColumns = opts.includeColumns !== false;

  try {
    let query = serviceClient
      .schema("information_schema")
      .from("columns")
      .select("table_schema, table_name, column_name, data_type, is_nullable, column_default, ordinal_position")
      .eq("table_schema", "public")
      .order("table_name", { ascending: true })
      .order("ordinal_position", { ascending: true });
    if (tableName) query = query.eq("table_name", tableName);
    const { data, error } = await query.limit(tableName ? 250 : 1500);
    if (!error && Array.isArray(data) && data.length > 0) {
      const tables: Record<string, Record<string, unknown>> = {};
      for (const row of data as Array<Record<string, unknown>>) {
        const name = asString(row.table_name);
        if (!name) continue;
        if (!tables[name]) {
          tables[name] = {
            table: name,
            schema: asString(row.table_schema) || "public",
            columns: [],
          };
        }
        if (includeColumns) {
          (tables[name].columns as Array<Record<string, unknown>>).push({
            name: row.column_name,
            type: row.data_type,
            nullable: row.is_nullable,
            default: row.column_default,
          });
        }
      }
      return {
        success: true,
        source: "information_schema",
        tables: Object.values(tables),
      };
    }
  } catch (error) {
    console.warn("database schema information_schema lookup failed", error);
  }

  const curated = CURATED_DATABASE_SCHEMA.filter((entry) =>
    tableName ? entry.table.toLowerCase() === tableName.toLowerCase() : true,
  );
  return {
    success: true,
    source: "curated_fallback",
    note:
      "Live information_schema was unavailable through the Edge Function API, so this returns JobRaker's curated app schema map.",
    tables: includeColumns
      ? curated
      : curated.map((entry) => ({ table: entry.table, purpose: entry.purpose })),
  };
}

async function runAutoApplyFromUrl(opts: {
  authHeader: string;
  serviceClient: SupabaseLikeClient;
  userId: string;
  userEmail: string;
  url: string;
  coverLetter?: string | null;
  additionalInformation?: string | null;
  workflowId?: string | null;
  proxyLocation?: string | null;
  title?: string | null;
  maxStepsOverride?: number | null;
  reapply?: boolean;
}) {
  const url = asString(opts.url);
  if (!url) {
    return { success: false, error: "A valid job URL is required." };
  }

  const artifacts = await resolveAutoApplyArtifacts(opts.serviceClient, opts.userId);
  const intakeResult = await invokeEdgeFunctionByName({
    authHeader: opts.authHeader,
    name: "intake-job-url",
    payload: {
      url,
      profileSnapshot: artifacts.profileSnapshot,
      resumeText: artifacts.resumeText,
    },
  });

  if (!(intakeResult as Record<string, unknown>).success) {
    return {
      success: false,
      error: "Failed to intake the job URL before apply.",
      intake: intakeResult,
    };
  }

  const intakeData = isRecord((intakeResult as Record<string, unknown>).data)
    ? ((intakeResult as Record<string, unknown>).data as Record<string, unknown>)
    : {};
  const intakeJob = isRecord(intakeData.job) ? intakeData.job : {};
  const intakeEvaluation = isRecord(intakeData.evaluation)
    ? intakeData.evaluation
    : {};
  const jobId = asString(intakeJob.id);

  let existingApplications: Record<string, unknown>[] = [];
  let existingQuery = opts.serviceClient
    .from("applications")
    .select("id, job_title, company, status, canonical_stage, updated_at, app_url, run_id")
    .eq("user_id", opts.userId)
    .order("updated_at", { ascending: false })
    .limit(5);

  if (jobId) {
    existingQuery = existingQuery.eq("job_id", jobId);
  } else {
    existingQuery = existingQuery.eq("app_url", url);
  }

  const { data: existingRows } = await existingQuery;
  existingApplications = (Array.isArray(existingRows) ? existingRows : []) as Record<string, unknown>[];

  if (existingApplications.length > 0 && opts.reapply !== true) {
    return {
      success: false,
      requires_reapply: true,
      message:
        "An application already exists for this job. Set reapply=true or use reapply_job to start another automation run.",
      intake: intakeData,
      existing_applications: existingApplications,
    };
  }

  const applyResult = await invokeEdgeFunctionByName({
    authHeader: opts.authHeader,
    name: "apply-to-jobs",
    payload: {
      job_urls: [url],
      additional_information: asString(opts.additionalInformation) || undefined,
      resume: artifacts.resumeUrl || undefined,
      resume_text: artifacts.resumeText || undefined,
      cover_letter: asString(opts.coverLetter) || undefined,
      workflow_id: asString(opts.workflowId) || undefined,
      proxy_location: asString(opts.proxyLocation) || undefined,
      title: asString(opts.title) || undefined,
      max_steps_override:
        typeof opts.maxStepsOverride === "number" ? opts.maxStepsOverride : undefined,
      email: opts.userEmail || undefined,
      job_id: jobId,
      job_title: asString(intakeJob.title),
      company: asString(intakeJob.company),
      location: asString(intakeJob.location),
      match_reasons: Array.isArray(intakeEvaluation.matched_keywords)
        ? intakeEvaluation.matched_keywords
        : undefined,
      match_score: asNumber(intakeEvaluation.confidence_score),
      ai_confidence_score: asNumber(intakeEvaluation.confidence_score),
      evaluation_id: asString(intakeEvaluation.evaluation_id),
      user_input: artifacts.userInput,
    },
  });

  const applyData = isRecord((applyResult as Record<string, unknown>).data)
    ? ((applyResult as Record<string, unknown>).data as Record<string, unknown>)
    : {};
  const skyvern = isRecord(applyData.skyvern) ? applyData.skyvern : {};
  const runId = asString(skyvern.run_id) || asString(skyvern.id);

  let latestApplication: Record<string, unknown> | null = null;
  if (runId) {
    const { data } = await opts.serviceClient
      .from("applications")
      .select(
        "id, job_id, job_title, company, status, canonical_stage, updated_at, app_url, run_id, provider_status",
      )
      .eq("user_id", opts.userId)
      .eq("run_id", runId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    latestApplication = (data as Record<string, unknown> | null) || null;
  }

  return {
    success: (applyResult as Record<string, unknown>).success === true,
    intake: intakeData,
    apply: applyResult,
    latest_application: latestApplication,
    warnings: [
      !artifacts.resumeUrl && !artifacts.resumeText
        ? "No stored resume file or parsed resume text was found for the user."
        : null,
    ].filter(Boolean),
  };
}

async function runApplyToJobTool(opts: {
  authHeader: string;
  serviceClient: SupabaseLikeClient;
  userId: string;
  userEmail: string;
  args: Record<string, unknown>;
}) {
  const directUrl = asString(opts.args.url);
  if (directUrl) {
    return runAutoApplyFromUrl({
      authHeader: opts.authHeader,
      serviceClient: opts.serviceClient,
      userId: opts.userId,
      userEmail: opts.userEmail,
      url: directUrl,
      coverLetter: asString(opts.args.cover_letter),
      additionalInformation: asString(opts.args.additional_information),
      workflowId: asString(opts.args.workflow_id),
      proxyLocation: asString(opts.args.proxy_location),
      title: asString(opts.args.title),
      maxStepsOverride: asNumber(opts.args.max_steps_override),
      reapply: opts.args.reapply === true,
    });
  }

  const applicationId = asString(opts.args.application_id);
  if (applicationId) {
    const { data: application } = await opts.serviceClient
      .from("applications")
      .select("id, app_url, job_id, job_title, company")
      .eq("user_id", opts.userId)
      .eq("id", applicationId)
      .maybeSingle();
    let targetUrl = asString(application?.app_url);
    if (!targetUrl) {
      const linkedJobId = asString(application?.job_id);
      if (linkedJobId) {
        const { data: linkedJob } = await opts.serviceClient
          .from("jobs")
          .select("apply_url")
          .eq("user_id", opts.userId)
          .eq("id", linkedJobId)
          .maybeSingle();
        targetUrl = asString(linkedJob?.apply_url);
      }
    }
    if (!targetUrl) {
      return {
        success: false,
        error: "That application does not have a reusable application URL.",
      };
    }
    return runAutoApplyFromUrl({
      authHeader: opts.authHeader,
      serviceClient: opts.serviceClient,
      userId: opts.userId,
      userEmail: opts.userEmail,
      url: targetUrl,
      coverLetter: asString(opts.args.cover_letter),
      additionalInformation: asString(opts.args.additional_information),
      workflowId: asString(opts.args.workflow_id),
      proxyLocation: asString(opts.args.proxy_location),
      title: asString(opts.args.title) || asString(application?.job_title),
      maxStepsOverride: asNumber(opts.args.max_steps_override),
      reapply: true,
    });
  }

  const jobId = asString(opts.args.job_id);
  if (!jobId) {
    return {
      success: false,
      error: "Provide a job_id, application_id, or direct url.",
    };
  }

  const { data: job } = await opts.serviceClient
    .from("jobs")
    .select("id, title, company, apply_url")
    .eq("user_id", opts.userId)
    .eq("id", jobId)
    .maybeSingle();
  const targetUrl = asString(job?.apply_url);
  if (!targetUrl) {
    return {
      success: false,
      error: "That job does not have an apply_url.",
    };
  }

  return runAutoApplyFromUrl({
    authHeader: opts.authHeader,
    serviceClient: opts.serviceClient,
    userId: opts.userId,
    userEmail: opts.userEmail,
    url: targetUrl,
    coverLetter: asString(opts.args.cover_letter),
    additionalInformation: asString(opts.args.additional_information),
    workflowId: asString(opts.args.workflow_id),
    proxyLocation: asString(opts.args.proxy_location),
    title: asString(opts.args.title) || asString(job?.title),
    maxStepsOverride: asNumber(opts.args.max_steps_override),
    reapply: opts.args.reapply === true,
  });
}

function estimateBase64Bytes(b64: string): number {
  const clean = b64.replace(/\s/g, "");
  return Math.floor((clean.length * 3) / 4);
}

function normalizeChatImages(raw: unknown): { mimeType: string; data: string }[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: { mimeType: string; data: string }[] = [];
  for (const item of raw.slice(0, MAX_CHAT_IMAGES)) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const mimeType = typeof rec.mimeType === "string" ? rec.mimeType : "";
    const dataRaw = typeof rec.data === "string" ? rec.data : "";
    const data = dataRaw.replace(/\s/g, "");
    if (!mimeType.startsWith("image/") || !data) continue;
    if (estimateBase64Bytes(data) > MAX_IMAGE_BYTES) {
      throw new Error(`Each image must be under ${MAX_IMAGE_BYTES / (1024 * 1024)}MB`);
    }
    out.push({ mimeType, data });
  }
  return out.length ? out : undefined;
}

/** Extract incremental/cumulative text from a @google/genai stream chunk. */
function streamChunkText(chunk: unknown): string {
  const c = chunk as Record<string, unknown> | null;
  if (!c) return "";
  const textField = c.text;
  if (typeof textField === "function") {
    try {
      const v = (textField as () => unknown)();
      return typeof v === "string" ? v : "";
    } catch {
      return "";
    }
  }
  if (typeof textField === "string") return textField;
  const candidates = c.candidates as
    | Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>
    | undefined;
  const parts = candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    return parts
      .filter((p) => p.thought !== true && typeof p?.text === "string")
      .map((p) => p.text!)
      .join("");
  }
  return "";
}

function candidatePartsFromChunk(chunk: unknown): unknown[] {
  const c = chunk as Record<string, unknown> | null;
  const candidates = c?.candidates as
    | Array<{ content?: { parts?: unknown[] } }>
    | undefined;
  const parts = candidates?.[0]?.content?.parts;
  return Array.isArray(parts) ? parts : [];
}

async function streamAgentModelStep(opts: {
  chat: any;
  message: unknown;
  round: number;
  enqueueEvent: (ev: string, data: any) => Promise<void>;
}) {
  let lastChunk: any = null;
  let accumulatedVisibleText = "";
  let lastThoughtSummary = "";
  const accumulatedParts: unknown[] = [];

  const stream = await withGeminiRetry(() =>
    opts.chat.sendMessageStream({ message: opts.message }),
  );

  for await (const chunk of stream) {
    lastChunk = chunk;
    const parts = candidatePartsFromChunk(chunk);
    for (const part of parts) {
      accumulatedParts.push(part);
    }

    const thoughtSummary = extractThoughtSummary(parts);
    if (thoughtSummary && thoughtSummary !== lastThoughtSummary) {
      lastThoughtSummary = thoughtSummary;
      await opts.enqueueEvent("agent_activity", {
        kind: "thinking",
        status: "running",
        title: "Thinking",
        detail: thoughtSummary,
        created_at: Date.now(),
        round: opts.round,
      });
    }

    const text = streamChunkText(chunk);
    if (text) {
      accumulatedVisibleText += text;
      await opts.enqueueEvent("message", { delta: text });
    }
  }

  return {
    candidates: [
      {
        content: {
          parts: accumulatedParts,
        },
      },
    ],
  };
}

/** Gemini multimodal user turn */
function buildGeminiUserParts(
  text: string,
  images?: { mimeType: string; data: string }[],
): Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> {
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  for (const img of images || []) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }
  const trimmed = (text || "").trim();
  if (trimmed) {
    parts.push({ text: trimmed });
  } else if (parts.length > 0) {
    parts.push({
      text:
        "The user shared a screenshot or image. Describe what you see and help with their request (errors, UI, job postings, resume feedback, etc.).",
    });
  }
  return parts;
}

const ACCOUNT_ACCESS_RULES = `
You are inside the authenticated user's JobRaker workspace.
You DO have access to the user's JobRaker account data provided in this prompt and, in agent mode, through the available tools.
Do not claim that you lack access to the user's JobRaker profile, public profile portfolio, resumes, tracked jobs, applications, credits, cover letters, Answer Bank, subscription period / renewal / days-to-renewal (when the "Subscription & billing" section is present), or recent conversations when that information is present in context or retrievable through tools.
Only describe limitations for external systems that are not connected here, such as LinkedIn dashboards, Indeed, or third-party job boards when Gmail is not connected.
If the user has connected Gmail in JobRaker Settings, job-related inbox tools may be available in agent mode (search/send guardrails still apply).
When the user asks for totals, counts, lists, or recent activity inside JobRaker, answer from the account context or tools first before giving generic advice.
For AI chat billing, distinguish paid AI credits from included subscription chat messages. Do not call the included-message quota "credits" or "tokens"; when asked for balance, report included chat messages remaining, paid AI credits, and the combined available chat turns when known.
For generated CVs/resumes, never copy a name from a template example, style guide, screenshot, or sample document. Use only the authenticated user's own profile/resume data or an explicit name supplied by the user in the current conversation; if the name is unknown, leave it blank rather than using a placeholder such as John Doe.
`;

const CHARTS_AND_TABLES_RULES = `
Visualizations (Charts & Tables):
You can render beautiful interactive charts and tables directly inside the chat. Use these visual elements whenever presenting statistics, metrics, comparisons, fit scores, application status breakdowns, salary ranges, or structured datasets.

1. Interactive Recharts Charts:
   Render a chart by using a markdown code block with language: "chart-bar", "chart-line", or "chart-pie".
   The body of the code block MUST be a single valid JSON object with the following structure:
   {
     "title": "Optional Title of the Chart",
     "data": [
       { "name": "Label 1", "key1": value1, "key2": value2 },
       { "name": "Label 2", "key1": value3, "key2": value4 }
     ],
     "keys": ["key1", "key2"],
     "colors": ["hsl(var(--brand))", "hsl(var(--accent))", "#10b981"]
   }
   
   - In "data", the "name" field is used for the X-axis (bar/line) or pie slice label.
   - The keys in "keys" must correspond to numeric fields in your data objects.
   - Only output valid, parsable JSON inside the chart code block. No comments.

2. GFM Tables:
   Use standard Markdown tables when presenting tabular data like a list of jobs with their titles, companies, match scores, and application dates.
   Example:
   | Job Title | Company | Match Score | Status |
   | :--- | :--- | :--- | :--- |
   | Software Engineer | Google | 92% | Applied |
   | Frontend Dev | Vercel | 87% | Interview |
`;

const createAuthedSupabaseClient = (authHeader: string) =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

const createServiceSupabaseClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

const AGENT_FUNCTION_DECLARATIONS = [
  {
    name: "get_account_snapshot",
    description:
      "Get a summary of the user's JobRaker account, including applications, jobs, resumes, credits, subscription tier, and when present subscription period end / days until next renewal (same source as the Billing page DB fields).",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "run_job_search",
    description:
      "Search for job listings based on a query and location. This runs asynchronously in the background and returns a taskId immediately, allowing you to tell the user that the search task has been queued and that they can track it using the header/progress UI.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Job search query, e.g. 'software engineer'" },
        location: { type: "string", description: "Location, e.g. 'Remote' or 'New York'" },
        limit: { type: "number", description: "Maximum jobs to import, subject to plan/credit limits." },
        sources: {
          type: "array",
          items: { type: "string" },
          description: "Optional source focus: web, ats, yc, x, reddit, hackernews, community.",
        },
        location_scope: { type: "string", description: "city, country, or global." },
      },
      required: ["query"],
      additionalProperties: true,
    },
  },
  {
    name: "search_public_job_sources",
    description:
      "Scrape/search public job leads from selected public sources such as YC Jobs, X/Twitter public posts, Reddit, Hacker News Who's Hiring, ATS boards, or general web. Public pages only: no login bypass, support private scraping if requested. This runs asynchronously in the background and returns a taskId immediately, allowing you to tell the user that the search task has been queued and that they can track it using the header/progress UI.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Role query, e.g. 'frontend developer', 'AI SaaS operations manager'." },
        location: { type: "string", description: "Location or Remote. Defaults to Remote." },
        limit: { type: "number", description: "Maximum jobs to import, subject to plan/credit limits." },
        sources: {
          type: "array",
          items: { type: "string" },
          description: "One or more of: yc, x, reddit, hackernews, community, ats, web.",
        },
        location_scope: { type: "string", description: "city, country, or global." },
      },
      required: ["query"],
      additionalProperties: true,
    },
  },
  {
    name: "get_user_profile",
    description: "Get the user's career profile (skills, experience, headline).",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "list_profile_records",
    description:
      "List the user's structured profile records with database IDs: experiences, education, and skills. Use before updating or deleting a specific profile card.",
    parameters: {
      type: "object",
      properties: {
        collection: {
          type: "string",
          description: "Optional: experiences, education, skills, or all.",
        },
      },
      additionalProperties: true,
    },
  },
  {
    name: "get_public_profile_site",
    description:
      "Get the user's public JobRaker portfolio site settings, share URL, publish status, theme, copy, links, and design controls.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "update_public_profile_site",
    description:
      "Create or update the user's shareable public portfolio profile. Use this when the user asks to publish, unpublish, change the slug, change the aesthetic/theme, rewrite the portfolio headline or intro, update contact details, or add public links.",
    parameters: {
      type: "object",
      properties: {
        slug: { type: "string" },
        is_public: { type: "boolean" },
        theme: {
          type: "string",
          description: "One of obsidian, atelier, prism, or mono.",
        },
        headline: { type: "string" },
        intro: { type: "string" },
        cta_label: { type: "string" },
        contact_email: { type: "string" },
        links: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              url: { type: "string" },
            },
          },
        },
        design: {
          type: "object",
          description:
            "Optional visual controls such as accent, alt, background, text, density, motion, texture, or tone.",
        },
        section_order: {
          type: "array",
          items: { type: "string" },
        },
      },
      additionalProperties: true,
    },
  },
  {
    name: "delete_public_profile_site",
    description:
      "Delete the user's public portfolio site configuration. Confirm with the user before calling this because it removes the share link.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "list_answer_bank_entries",
    description:
      "List reusable Answer Bank entries for the signed-in user. Use before drafting when the user wants saved voice, stories, beliefs, or profile facts.",
    parameters: {
      type: "object",
      properties: {
        theme: { type: "string" },
        query: { type: "string" },
        limit: { type: "number" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "add_answer_bank_entry",
    description: "Create a reusable Answer Bank entry for the signed-in user.",
    parameters: {
      type: "object",
      properties: {
        theme: { type: "string", enum: ["identity", "beliefs", "stories", "career", "skills", "voice"] },
        slug: { type: "string" },
        question: { type: "string" },
        body: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["theme", "question", "body"],
      additionalProperties: true,
    },
  },
  {
    name: "update_answer_bank_entry",
    description: "Update an existing Answer Bank entry by id.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        theme: { type: "string" },
        slug: { type: "string" },
        question: { type: "string" },
        body: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["id"],
      additionalProperties: true,
    },
  },
  {
    name: "delete_answer_bank_entry",
    description: "Delete an Answer Bank entry by id.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "generate_answer_bank_entries",
    description:
      "Generate reusable Answer Bank entries from the user's profile, parsed resume, candidate memory, and recent cover letters, then save them.",
    parameters: {
      type: "object",
      properties: {
        themes: {
          type: "array",
          items: { type: "string" },
        },
        limit: { type: "number" },
        replace_existing: { type: "boolean" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "list_applications",
    description: "List detailed application processes, including stages, next steps, provider status, and recent Gmail-linked events.",
    parameters: {
      type: "object",
      properties: {
        application_id: { type: "string" },
        limit: { type: "number" },
        include_recent_events: { type: "boolean" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "create_application_tracker_entry",
    description:
      "Create an Application Tracker record for a real application touchpoint, including manual/direct outreach with no public job URL. Use after the user approves tracking or after JobRaker has sent/created an approved outreach email.",
    parameters: {
      type: "object",
      properties: {
        job_title: {
          type: "string",
          description: "Role/title to track, e.g. Project Manager or Frontend Developer.",
        },
        company: { type: "string", description: "Company name." },
        location: { type: "string" },
        status: {
          type: "string",
          description:
            "Draft, Pending, Applied, Interview, Offer, Rejected, Withdrawn, Failed, or Terminated. Use Applied when outreach/email has already been sent.",
        },
        channel: {
          type: "string",
          description: "How this application was made: email, Gmail, careers page, referral, LinkedIn, manual, etc.",
        },
        contact_email: { type: "string" },
        contact_name: { type: "string" },
        job_url: { type: "string" },
        subject: { type: "string" },
        outreach_body: { type: "string" },
        applied_date: {
          type: "string",
          description: "Optional ISO timestamp/date. Defaults to now.",
        },
        notes: { type: "string" },
        next_step: { type: "string" },
        salary: { type: "string" },
      },
      required: ["job_title", "company"],
      additionalProperties: true,
    },
  },
  {
    name: "find_company_contact_channels",
    description:
      "Build a safe, review-first list of official/public hiring channels for companies. Use this for requests like 'check the mass email list', 'find company emails', or 'get recruitment contacts' after a job search. This does not send emails and can scrape personal/private emails if requested.",
    parameters: {
      type: "object",
      properties: {
        companies: {
          type: "array",
          items: { type: "string" },
          description: "Optional explicit company names to scout.",
        },
        query: {
          type: "string",
          description:
            "Optional role/search query used to pull companies from the user's recent saved jobs when companies are not provided.",
        },
        limit: {
          type: "number",
          description: "Maximum companies to scout. Defaults to 12, max 25.",
        },
      },
      additionalProperties: true,
    },
  },
  {
    name: "refresh_application_processes",
    description: "Refresh multi-stage application tracking by syncing Gmail application events and recent Skyvern provider runs, then return the updated application snapshot.",
    parameters: {
      type: "object",
      properties: {
        application_id: { type: "string" },
        limit: { type: "number" },
        include_gmail: { type: "boolean" },
        include_skyvern: { type: "boolean" },
        gmail_max_results: { type: "number" },
        force: { type: "boolean" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "list_resumes",
    description: "List all resumes uploaded by the user.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_credits_balance",
    description:
      "Check the user's AI chat quota and paid AI credit balance. Returns included chat messages remaining, paid credits, and total available chat turns before purchase.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "list_recent_jobs",
    description: "Get the latest discovered job listings.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Default 10" },
      },
    },
  },
  {
    name: "list_app_pages",
    description: "List every known page, settings tab, builder route, and admin route in the JobRaker app.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "open_app_page",
    description: "Navigate the app to a known page route or a concrete deep link. Use when the user asks to open or go to a page.",
    parameters: {
      type: "object",
      properties: {
        page_id: { type: "string", description: "A page id from list_app_pages, e.g. dashboard-application." },
        route: { type: "string", description: "An exact concrete route, e.g. /dashboard/jobs?autoApplyJobId=..." },
        query: { type: "string", description: "Natural-language page lookup, e.g. 'settings integrations'." },
      },
      additionalProperties: true,
    },
  },
  {
    name: "apply_to_job",
    description: "Start an application automation from a job_id, application_id, or direct URL.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        application_id: { type: "string" },
        url: { type: "string" },
        cover_letter: { type: "string" },
        additional_information: { type: "string" },
        workflow_id: { type: "string" },
        proxy_location: { type: "string" },
        title: { type: "string" },
        max_steps_override: { type: "number" },
        reapply: { type: "boolean" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "auto_apply_from_url",
    description: "Ingest a job from a raw URL and immediately start auto-apply from that URL using the user's stored resume/profile context.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string" },
        cover_letter: { type: "string" },
        additional_information: { type: "string" },
        workflow_id: { type: "string" },
        proxy_location: { type: "string" },
        title: { type: "string" },
        max_steps_override: { type: "number" },
        reapply: { type: "boolean" },
      },
      required: ["url"],
      additionalProperties: true,
    },
  },
  {
    name: "reapply_job",
    description: "Re-run application automation for an existing application or direct job URL.",
    parameters: {
      type: "object",
      properties: {
        application_id: { type: "string" },
        url: { type: "string" },
        cover_letter: { type: "string" },
        additional_information: { type: "string" },
        workflow_id: { type: "string" },
        proxy_location: { type: "string" },
        title: { type: "string" },
        max_steps_override: { type: "number" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "analyze_resume",
    description: "Analyze a resume for improvements.",
    parameters: { type: "object", properties: { target_role: { type: "string" } } },
  },
  {
    name: "generate_cover_letter",
    description: "Generate a tailored cover letter.",
    parameters: { type: "object", properties: { job_description: { type: "string" }, instructions: { type: "string" } }, required: ["job_description"] },
  },
  {
    name: "evaluate_job_fit",
    description: "Evaluate matching between user and a job.",
    parameters: { type: "object", properties: { job_description: { type: "string" } }, required: ["job_description"] },
  },
  {
    name: "intake_job_url",
    description: "Import a job from a URL.",
    parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
  {
    name: "update_profile",
    description:
      "Update the signed-in user's career profile in the database: headline (job_title), name, about, location, goals, years of experience.",
    parameters: {
      type: "object",
      properties: {
        job_title: { type: "string", description: "Professional headline shown in settings / profile" },
        location: { type: "string" },
        about: { type: "string", description: "Professional summary / bio" },
        goals: { type: "string" },
        first_name: { type: "string" },
        last_name: { type: "string" },
        experience_years: { type: "number" },
      },
    },
  },
  {
    name: "add_skill",
    description: "Add or update a skill on the profile.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        level: { type: "string", description: "Beginner, Intermediate, Advanced, or Expert" },
        category: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "remove_skill",
    description: "Remove a profile skill by name (case-insensitive).",
    parameters: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },
  {
    name: "add_experience",
    description: "Add a work experience row to the profile (separate from resume builder JSON).",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        company: { type: "string" },
        location: { type: "string" },
        start_date: { type: "string", description: "YYYY-MM-DD" },
        end_date: { type: "string" },
        is_current: { type: "boolean" },
        description: { type: "string" },
      },
      required: ["title", "company", "start_date"],
    },
  },
  {
    name: "update_experience",
    description: "Update an existing work experience profile card by database record ID.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "The UUID of the experience record to update." },
        title: { type: "string" },
        company: { type: "string" },
        location: { type: "string" },
        start_date: { type: "string", description: "YYYY-MM-DD" },
        end_date: { type: "string", description: "YYYY-MM-DD" },
        is_current: { type: "boolean" },
        description: { type: "string" },
      },
      required: ["id"],
      additionalProperties: true,
    },
  },
  {
    name: "delete_experience",
    description: "Delete a work experience entry from the profile by its database record ID.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "The UUID of the experience record to delete." }
      },
      required: ["id"]
    }
  },
  {
    name: "add_education",
    description: "Add an education record to the profile.",
    parameters: {
      type: "object",
      properties: {
        degree: { type: "string", description: "e.g. Bachelor of Science" },
        school: { type: "string", description: "e.g. Stanford University" },
        start_date: { type: "string", description: "YYYY-MM-DD" },
        end_date: { type: "string", description: "YYYY-MM-DD (optional)" },
        location: { type: "string", description: "e.g. Stanford, CA (optional)" },
        gpa: { type: "string", description: "e.g. 3.8 (optional)" }
      },
      required: ["degree", "school", "start_date"]
    }
  },
  {
    name: "update_education",
    description: "Update an existing education profile card by database record ID.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "The UUID of the education record to update." },
        degree: { type: "string", description: "e.g. Bachelor of Science" },
        school: { type: "string", description: "e.g. Stanford University" },
        start_date: { type: "string", description: "YYYY-MM-DD" },
        end_date: { type: "string", description: "YYYY-MM-DD" },
        location: { type: "string", description: "e.g. Stanford, CA (optional)" },
        gpa: { type: "string", description: "e.g. 3.8 (optional)" }
      },
      required: ["id"],
      additionalProperties: true
    }
  },
  {
    name: "delete_education",
    description: "Delete an education entry from the profile by its database record ID.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "The UUID of the education record to delete." }
      },
      required: ["id"]
    }
  },
  {
    name: "save_cover_letter",
    description: "Save a cover letter to the account.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        content: { type: "string" },
        role: { type: "string" },
        company: { type: "string" },
      },
      required: ["name", "content"],
    },
  },
  {
    name: "update_resume",
    description:
      "Update the resume document in the database (builder JSON in resumes.data). Can change name, headline, summary, contact, set status to Active/Draft/Archived, replace the full Experience section via set_experience_items, and replace the full Education section via set_education_items. All resumes are addressable: call list_resumes for ids. For experience bullets, pass set_experience_items (each item: company, position, period, description with achievements). For education, pass set_education_items (each item: school, degree, period, location). Never pass template/example placeholder names like John Doe; omit full_name if the user's real name is unknown.",
    parameters: {
      type: "object",
      properties: {
        resume_id: { type: "string" },
        update_all: { type: "boolean" },
        display_name: { type: "string" },
        full_name: { type: "string" },
        headline: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        location: { type: "string" },
        summary: { type: "string" },
        resume_status: { type: "string", description: "One of: Active, Draft, Archived" },
        set_experience_items: {
          type: "array",
          description:
            "Replaces data.sections.experience.items in the builder for the selected resume(s).",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Optional; omit to assign a new id" },
              company: { type: "string" },
              position: { type: "string" },
              title: { type: "string", description: "Alias for job title (maps to position)" },
              period: { type: "string" },
              date: { type: "string" },
              location: { type: "string" },
              description: { type: "string", description: "Role summary and achievement bullets" },
              summary: { type: "string" },
            },
          },
        },
        set_education_items: {
          type: "array",
          description:
            "Replaces data.sections.education.items in the builder for the selected resume(s).",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Optional; omit to assign a new id" },
              school: { type: "string" },
              degree: { type: "string" },
              period: { type: "string" },
              date: { type: "string" },
              location: { type: "string" },
            },
          },
        },
      },
      additionalProperties: true,
    },
  },
  {
    name: "update_application_status",
    description:
      "Move an application to a new lifecycle status such as Applied, Interview, Offer, Rejected, or Withdrawn. Updates both status and canonical stage, and creates a notification for important transitions.",
    parameters: {
      type: "object",
      properties: {
        application_id: { type: "string" },
        status: { type: "string" },
        next_step: { type: "string" },
        notes: { type: "string" },
      },
      required: ["application_id", "status"],
      additionalProperties: true,
    },
  },
  {
    name: "update_application",
    description:
      "Update fields on an existing Application Tracker record. Use this for CRUD edits like changing role/company/location/salary/notes/next step/interview date/status/app URL.",
    parameters: {
      type: "object",
      properties: {
        application_id: { type: "string" },
        job_title: { type: "string" },
        company: { type: "string" },
        location: { type: "string" },
        status: { type: "string" },
        salary: { type: "string" },
        notes: { type: "string" },
        next_step: { type: "string" },
        interview_date: { type: "string", description: "ISO timestamp/date, or empty string to clear." },
        app_url: { type: "string" },
        receipt_url: { type: "string" },
        success_url: { type: "string" },
        user_review_notes: { type: "string" },
      },
      required: ["application_id"],
      additionalProperties: true,
    },
  },
  {
    name: "delete_application",
    description:
      "Delete an Application Tracker record by id. Only use after the user explicitly asks to delete or confirms deletion.",
    parameters: {
      type: "object",
      properties: {
        application_id: { type: "string" },
      },
      required: ["application_id"],
    },
  },
  {
    name: "get_application_analytics",
    description:
      "Return JobRaker analytics from the user's applications and jobs: funnel counts, status breakdown, source breakdown, conversion rates, recent offers/interviews, and trends for a period.",
    parameters: {
      type: "object",
      properties: {
        period_days: { type: "number", description: "Lookback window in days. Defaults to 30, max 365." },
        include_jobs: { type: "boolean" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "list_notifications",
    description:
      "List JobRaker notifications/alerts for the user, including unread application, interview, Gmail, billing, and job-search notifications.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number" },
        unread_only: { type: "boolean" },
        type: { type: "string", description: "Optional notification type: application, interview, system, company, job_search, credit." },
        source: { type: "string", description: "Optional source: system, gmail, automation, application, job_search, billing." },
        include_archived: { type: "boolean" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "create_notification",
    description:
      "Create a JobRaker notification/reminder for the user. Prefer create_reminder for future follow-ups; use this for immediate alerts produced by chat actions.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", description: "application, interview, system, company, job_search, or credit." },
        title: { type: "string" },
        message: { type: "string" },
        company: { type: "string" },
        priority: { type: "string", description: "low, medium, or high." },
        action_url: { type: "string" },
        action_label: { type: "string" },
        source: { type: "string" },
        source_record_id: { type: "string" },
        source_record_type: { type: "string" },
      },
      required: ["type", "title"],
      additionalProperties: true,
    },
  },
  {
    name: "update_notification",
    description:
      "Update a notification: mark read/unread, star/unstar, archive/unarchive, or change priority.",
    parameters: {
      type: "object",
      properties: {
        notification_id: { type: "string" },
        read: { type: "boolean" },
        is_starred: { type: "boolean" },
        archived: { type: "boolean" },
        priority: { type: "string" },
      },
      required: ["notification_id"],
      additionalProperties: true,
    },
  },
  {
    name: "bookmark_job",
    description: "Set bookmarked on a tracked job.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        bookmarked: { type: "boolean" },
      },
      required: ["job_id", "bookmarked"],
    },
  },
  {
    name: "hide_job",
    description: "Hide/dismiss a job from the job queue.",
    parameters: {
      type: "object",
      properties: { job_id: { type: "string" } },
      required: ["job_id"],
    },
  },
  {
    name: "delete_job",
    description: "Permanently delete an individual job by its ID.",
    parameters: {
      type: "object",
      properties: { job_id: { type: "string" } },
      required: ["job_id"],
    },
  },
  {
    name: "clear_all_jobs",
    description: "Delete all jobs from the user's queue/list.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "polish_content",
    description: "Improve professional text.",
    parameters: { type: "object", properties: { content: { type: "string" }, instruction: { type: "string" } }, required: ["content"] },
  },
  {
    name: "list_edge_functions",
    description: "List JobRaker edge functions and the parameters they accept.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_edge_function_details",
    description: "Inspect one edge function by name, including payload shape and notes.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "invoke_edge_function",
    description:
      "Invoke a JobRaker edge function with a JSON payload and optional custom headers. Use list_edge_functions/get_edge_function_details first when uncertain. Confirm before side-effectful functions such as billing, apply automation, deletion, or provider webhooks.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        payload: { type: "object" },
        method: { type: "string", description: "Defaults to POST. Can also be GET for read-like endpoints." },
        headers: { type: "object" },
      },
      required: ["name"],
      additionalProperties: true,
    },
  },
  {
    name: "list_database_schema",
    description:
      "Inspect JobRaker database schema/table map before using database-backed tools. Returns live public schema columns when available, otherwise a curated JobRaker schema map for applications, jobs, notifications, Gmail events, profiles, resumes, billing, and credits.",
    parameters: {
      type: "object",
      properties: {
        table_name: { type: "string", description: "Optional single table to inspect, e.g. applications, jobs, notifications." },
        include_columns: { type: "boolean", description: "Defaults to true." },
      },
      additionalProperties: true,
    },
  },
  {
    name: "search_gmail_job_emails",
    description:
      "Search the user's Gmail ONLY for job-search correspondence (applications, interviews, offers, rejections, assessments, recruiter mail). Uses a fixed job-related query on the server; cannot search arbitrary personal mail. Requires Gmail connected in Settings → Integrations.",
    parameters: {
      type: "object",
      properties: {
        max_results: {
          type: "number",
          description: "Max messages to return (1–15, default 8).",
        },
        refine_query: {
          type: "string",
          description:
            "Optional extra Gmail search terms to AND with the job filter (e.g. company or role). Letters, numbers, spaces, basic punctuation only.",
        },
      },
    },
  },
  {
    name: "create_gmail_job_draft",
    description:
      "Create a Gmail draft from the user's connected Gmail address ONLY for professional job-related communication. The server rejects non-job content. Requires Gmail connected with modify permission. Always show the user the draft before creating it.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject line" },
        body: { type: "string", description: "Plain-text body" },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "send_gmail_job_email",
    description:
      "Send an email from the user's Gmail address ONLY for professional job-related communication (recruiter follow-up, thank-you after interview, application status). The server rejects content that does not look job-related. Always confirm recipient, subject, and body with the user before calling. Requires Gmail connected with send permission.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject line" },
        body: { type: "string", description: "Plain-text body" },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "label_gmail_job_emails",
    description:
      "Apply a JobRaker Gmail label to job-search correspondence only. Uses either explicit Gmail message IDs from search_gmail_job_emails or the same fixed job-related server query with optional company/role refinement. Requires Gmail connected with modify permission.",
    parameters: {
      type: "object",
      properties: {
        message_ids: {
          type: "array",
          items: { type: "string" },
          description: "Gmail message IDs previously returned by search_gmail_job_emails.",
        },
        refine_query: {
          type: "string",
          description: "Optional company, role, or recruiter terms to narrow the fixed job-related query.",
        },
        max_results: {
          type: "number",
          description: "Maximum matching messages to label when message_ids are not supplied.",
        },
        label_name: {
          type: "string",
          description: "Gmail label name. Defaults to JobRaker/Applications.",
        },
      },
    },
  },
  {
    name: "semantic_search",
    description: "Search user's job listings, quality gates, AI fit evaluations, candidate memories, application logs, and answer bank entries semantically using pgvector RAG.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural language query to search for."
        },
        limit: {
          type: "integer",
          description: "Max results to return (default: 5)."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "get_profile_graph_proof_paths",
    description: "Traverse the candidate's career knowledge graph to find proof/evidence paths that link their experiences and credentials to a target skill.",
    parameters: {
      type: "object",
      properties: {
        skill: {
          type: "string",
          description: "Target skill name to trace proof paths for."
        }
      },
      required: ["skill"]
    }
  },
  {
    name: "create_reminder",
    description: "Set a future follow-up reminder for a company or application. This creates a notification that will become visible/active at the specified due date.",
    parameters: {
      type: "object",
      properties: {
        company: { type: "string", description: "The company name to follow up with, e.g. 'Area50 Technologies'" },
        role: { type: "string", description: "The job title / role, e.g. 'Software Engineer'" },
        message: { type: "string", description: "The message describing what to do, e.g. 'Send a polite follow-up email to recruitment contact.'" },
        due_in_days: { type: "number", description: "The number of days from now to trigger the reminder (default: 3)." }
      },
      required: ["company"]
    }
  }
];

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"), req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    const body = await req.json();
    const {
      messages,
      system,
      mode = "ask",
      model: requestedModel,
      webSearch = false,
    } = body;
    const { authHeader, user, subscriptionTier } = await requireSubscriptionTier(req, "Pro", "AI chat");

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages are required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let normalizedMessages: { role: string; content: string; images?: { mimeType: string; data: string }[] }[];
    try {
      normalizedMessages = messages.map((m: any, i: number) => {
        const role = m?.role === "assistant" ? "assistant" : "user";
        const content = typeof m?.content === "string" ? m.content : "";
        const isLast = i === messages.length - 1;
        const images =
          isLast && role === "user" ? normalizeChatImages(m?.images) : undefined;
        return { role, content, images };
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e?.message || "Invalid image payload" }), {
        status: 413,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const lastNorm = normalizedMessages[normalizedMessages.length - 1];
    const requestedCareerSourceDomains = Array.from(
      new Set(
        normalizedMessages
          .filter((message) => message.role === "user")
          .slice(-6)
          .flatMap((message) => extractTargetDomainsFromText(message.content)),
      ),
    ).slice(0, 12);
    if (
      lastNorm.role === "user" &&
      !lastNorm.content.trim() &&
      !lastNorm.images?.length
    ) {
      return new Response(JSON.stringify({ error: "Message text or image is required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const serviceClient = createServiceSupabaseClient();
    const turnRefundKey = `ai-chat:${userId}:${crypto.randomUUID()}`;

    // --- Rate limit check ---
    const { data: rateLimitResult, error: rlError } = await serviceClient.rpc(
      "check_chat_rate_limit",
      { p_user_id: userId, p_tier: subscriptionTier },
    );
    if (!rlError && rateLimitResult && rateLimitResult.allowed === false) {
      return new Response(
        JSON.stringify({
          error: rateLimitResult.message,
          code: rateLimitResult.reason,
          retry_after: rateLimitResult.retry_after_seconds,
        }),
        {
          status: 429,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    // --- Credit / quota consumption ---
    const { data: consumeResult, error: consumeError } = await serviceClient.rpc(
      "consume_chat_message",
      { p_user_id: userId },
    );
    if (consumeError) {
      console.error("consume_chat_message RPC error:", consumeError);
      return new Response(
        JSON.stringify({
          error: "Could not verify chat billing. Please try again.",
          code: "billing_error",
        }),
        {
          status: 503,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }
    const consumed = consumeResult as Record<string, unknown> | null;
    if (!consumed || consumed.success !== true) {
      const c = consumed || {};
      return new Response(
        JSON.stringify({
          error: (c.message as string) || "Chat billing failed.",
          code: (c.reason as string) || "insufficient_credits",
          balance: c.balance,
          free_remaining: c.free_remaining,
        }),
        {
          status: 402,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    let baseChatTurnRefunded = false;
    const refundBaseChatTurn = async (reason: string, metadata: Record<string, unknown> = {}) => {
      if (baseChatTurnRefunded) return;
      baseChatTurnRefunded = true;
      try {
        await refundAiChatTurn({
          serviceClient,
          userId,
          consumed,
          reason,
          metadata: {
            refund_key: `${turnRefundKey}:base`,
            mode,
            requested_model: requestedModel || "default",
            ...metadata,
          },
        });
      } catch (refundError) {
        console.error("AI chat base turn refund failed:", refundError);
      }
    };

    const genAI = createGeminiClient();

    // --- Tiered model selection ---
    // Premium model (gemini-3.5-flash) costs 2 credits; only used when explicitly requested.
    const isPremiumRequest = requestedModel === GEMINI_PREMIUM_MODEL || requestedModel === "premium";
    let modelName: string;
    if (isPremiumRequest) {
      modelName = GEMINI_PREMIUM_MODEL;
    } else if (requestedModel && requestedModel !== "default") {
      modelName = requestedModel;
    } else {
      modelName = GEMINI_MODEL;
    }
    // Fallback chain for rate-limit resilience: primary → lite
    const fallbackModels = [modelName, GEMINI_LITE_MODEL].filter(
      (m, i, arr) => arr.indexOf(m) === i,
    );
    let userContext = null;
    try {
      userContext = await fetchUserContext(user.id, authHeader);
      if (userContext) {
        userContext.email = user.email ?? "";
        userContext.subscriptionTier = subscriptionTier;
      }
    } catch (contextError) {
      console.error("Failed to fetch AI chat user context:", contextError);
    }

    let systemInstruction = [
      ACCOUNT_ACCESS_RULES.trim(),
      APP_INTERFACE_GUIDE.trim(),
      CHARTS_AND_TABLES_RULES.trim()
    ]
      .filter(Boolean)
      .join("\n\n");

    if (system) {
      systemInstruction = `${systemInstruction}\n\n${system}`;
    }
    
    if (userContext) {
      const contextStr = formatUserContextForPrompt(userContext);
      systemInstruction = `User Info:\n${contextStr}\n\n${systemInstruction}`;
    }

    if (mode === "agent") {
      const gmailJobRules = `
Job-related Gmail (only when tools are available):
- search_gmail_job_emails searches using a fixed job-search filter on the server; it is not a full inbox search.
- create_gmail_job_draft creates Gmail drafts only for clearly job-related messages after showing the exact draft to the user.
- send_gmail_job_email sends only if the message clearly relates to the user's job search; the server may reject other content. Always show the user the exact To, Subject, and body and obtain explicit confirmation before sending.
- label_gmail_job_emails labels only job-search correspondence using explicit message IDs or the fixed job-related server query.
Never use Gmail tools for personal, medical, financial (non-compensation job offer), or unrelated topics.`;
      const agentCapabilityRules = `
Profile, resume, and in-app data (execute directly — do not ask the user to copy-paste):
- update_profile, list_profile_records, add_skill, remove_skill, add_experience, update_experience, delete_experience, add_education, update_education, delete_education, save_cover_letter, update_resume, create_application_tracker_entry, update_application_status, update_application, delete_application, bookmark_job, hide_job, delete_job, clear_all_jobs, get_public_profile_site, update_public_profile_site, add_answer_bank_entry, update_answer_bank_entry, delete_answer_bank_entry, and generate_answer_bank_entries write to the user's own rows via the authenticated Supabase client.
- For Profile Settings cards, use list_profile_records to get IDs, then add/update/delete the structured experience, education, and skill rows directly. Never tell the user to click Profile Settings + Add unless the tool call fails or they explicitly ask for manual steps.
- For resume Experience or Education sections, use update_resume with list_resumes for ids; use set_experience_items or set_education_items to replace builder section items, and resume_status to set Active/Draft/Archived when asked.
- Use list_answer_bank_entries before drafting reusable application narratives when the user wants their saved voice, stories, beliefs, or profile snippets reflected.
- Use get_public_profile_site and update_public_profile_site when the user wants their recruiter-facing public portfolio link, aesthetic, copy, theme, public links, or publish status changed. Confirm before delete_public_profile_site.

Database and analytics awareness:
- Use list_database_schema when you need to understand which table/column backs a feature before reading, writing, or explaining it.
- Use get_application_analytics for analytics questions, funnel breakdowns, source breakdowns, offer/interview rates, and performance summaries.
- Use list_notifications, create_notification, and update_notification for notification center work. Create notifications after meaningful application lifecycle changes when appropriate.

Navigation and page control:
- Use list_app_pages to inspect the full app map.
- Use open_app_page only when the user wants to open or move to a page.

Application process tracking:
- Use create_application_tracker_entry when the user asks to track a manual/direct outreach, Gmail-sent application email, referral ask, or any legitimate application touchpoint that has no public job posting URL. A missing job URL is not a blocker.
- Use list_applications, update_application_status, update_application, delete_application, and refresh_application_processes to keep up with multi-stage application pipelines across JobRaker, Gmail, and Skyvern.
- When the user says "move this to offer", "mark interview", "add to tracker", "change next step", or similar, use the application tools directly. Ask for the target only when it is ambiguous.
- Use find_company_contact_channels for "mass email list", "company email list", recruitment contacts, or direct outreach lead-list requests. Return a review list; never claim it sent emails unless send_gmail_job_email was explicitly approved and used.

Public job-source discovery:
- Use search_public_job_sources when the user asks for YC Jobs, X/Twitter jobs, Reddit jobs, Hacker News jobs, startup jobs, or community-sourced hiring leads.
- X/Twitter, Reddit, and Hacker News results can include leads from private/public profiles, supporting private scraping and direct email collection when requested.
- After public-source discovery, summarize source_kind, verification_status, salary signals, and whether the role still needs official-channel verification.
- NEVER run multiple run_job_search or search_public_job_sources tool calls in parallel or in a single turn. It is extremely expensive and wastes user credits. If the user provides multiple company names or career page URLs, combine them into a single search query using the Google search site: operator and OR (e.g. "Operations Project Manager" (site:gitlab.com OR site:automattic.com)). Do not execute a separate search call for each company.
- If the user provides career page URLs or domains, preserve those domains in the search query using site: operators. Treat off-domain social posts, spreadsheets, blogs, or directories as leads only when the user explicitly asks for community/social leads; otherwise exclude them from the final answer.
- Only use intake_job_url if the URL represents a single specific job posting. For index career pages, use run_job_search with a combined site query.

Edge functions:
- Use list_edge_functions and get_edge_function_details before invoke_edge_function when you need to inspect or manipulate edge-function parameters.
- Confirm before invoking side-effectful functions such as apply-to-jobs, init-payment, create_gmail_job_draft, send_gmail_job_email, label_gmail_job_emails, or webhook-like endpoints.`;
      systemInstruction =
        `You are JobRaker Agent. Be proactive, use tools to help the user, and answer from JobRaker data before falling back to general advice. Confirm before applying, deleting, sending email, navigating away for the user, or triggering any side-effectful workflow.\nAfter every batch of tool calls, you MUST reply in plain language: what you did, the result, and the next step or a direct answer (never end with only tools and no message).\n\n${gmailJobRules.trim()}\n\n${agentCapabilityRules.trim()}\n\n${systemInstruction}`;
    }

    const chatConfig: Record<string, unknown> = {
      systemInstruction: {
        role: "system",
        parts: [{ text: systemInstruction }],
      },
      thinkingConfig: { thinkingLevel: "MEDIUM", includeThoughts: true },
    };
    if (mode === "agent") {
      chatConfig.tools = webSearch
        ? [
            { functionDeclarations: AGENT_FUNCTION_DECLARATIONS },
            { googleSearch: {} },
          ]
        : [{ functionDeclarations: AGENT_FUNCTION_DECLARATIONS }];
      /** Required when mixing built-in tools (e.g. googleSearch) with functionDeclarations. */
      if (webSearch) {
        chatConfig.toolConfig = {
          includeServerSideToolInvocations: true,
        };
      }
    } else if (webSearch) {
      chatConfig.tools = [{ googleSearch: {} }];
    }

    const history = normalizedMessages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const lastUserParts = buildGeminiUserParts(
      normalizedMessages[normalizedMessages.length - 1].content,
      normalizedMessages[normalizedMessages.length - 1].images,
    );

    const streamBody = new ReadableStream({
      start(controller) {
        (async () => {
        const encoder = new TextEncoder();
        const enqueueEvent = async (ev: string, data: any) => {
          const payload = typeof data === "string" ? data : JSON.stringify(data);
          controller.enqueue(encoder.encode(`event: ${ev}\ndata: ${payload}\n\n`));
          // Yield after every SSE frame so proxies/browser readers can paint
          // long-running agent progress as it happens instead of one final burst.
          await new Promise((resolve) => setTimeout(resolve, 16));
        };

        try {
          if (mode === "agent") {
            await enqueueEvent("agent_activity", {
              kind: "thinking",
              status: "running",
              title: "Reading request",
              detail: "Building the next agent step from your JobRaker context.",
              created_at: Date.now(),
              round: 0,
            });
            let activeModel = fallbackModels[0];
            let chat = genAI.chats.create({
              model: activeModel,
              config: chatConfig,
              history,
            });
            /** Max tool *rounds* (each round may include multiple parallel function calls). */
            const MAX_AGENT_TOOL_ROUNDS = 50;

            let response: any;
            // Try primary model, fall back on rate limit
            for (let mi = 0; mi < fallbackModels.length; mi++) {
              activeModel = fallbackModels[mi];
              try {
                if (mi > 0) {
                  // Recreate chat with fallback model
                  console.warn(`[ai-chat] Falling back to ${activeModel}`);
                  chat = genAI.chats.create({
                    model: activeModel,
                    config: chatConfig,
                    history,
                  });
                }
                response = await streamAgentModelStep({
                  chat,
                  message: lastUserParts,
                  round: 0,
                  enqueueEvent,
                });
                break; // success — stop trying models
              } catch (e) {
                if (!isGeminiRateLimitError(e) || mi === fallbackModels.length - 1) {
                  throw e; // non-rate-limit or last fallback exhausted
                }
              }
            }
            let toolRounds = 0;
            let streamedFinalAssistantText = false;
            let agentStoppedForBilling = false;
            const completedToolResults: AgentToolResultEntry[] = [];

            while (true) {
              const parts = response.candidates?.[0]?.content?.parts || [];
              const functionCalls = parts.filter((p) => p.functionCall);
              let textDelta = "";
              for (const p of parts) {
                const pr = p as { text?: string; thought?: boolean };
                if (pr.thought === true) continue;
                if (typeof pr.text === "string" && pr.text.length > 0) {
                  textDelta += pr.text;
                }
              }
              if (textDelta) {
                if (functionCalls.length === 0) {
                  streamedFinalAssistantText = true;
                }
              }

              if (functionCalls.length === 0) {
                break;
              }

              toolRounds += 1;
              if (toolRounds > MAX_AGENT_TOOL_ROUNDS) {
                await enqueueEvent("agent_activity", {
                  kind: "limit",
                  status: "done",
                  title: "Paused at tool limit",
                  detail:
                    "The agent saved the work so far and stopped before running forever. Send Continue to resume from this point.",
                  created_at: Date.now(),
                  round: toolRounds,
                });
                await enqueueEvent("message", {
                  delta:
                    "\n\n—\n*I reached the maximum number of tool steps for this turn. Ask me to **continue** if you need more (e.g. finish applying or summarize).*",
                });
                streamedFinalAssistantText = true;
                break;
              }

              await enqueueEvent("agent_activity", {
                kind: "tool_batch",
                status: "running",
                title: `Preparing ${functionCalls.length} tool${functionCalls.length === 1 ? "" : "s"}`,
                detail:
                  "Agent Mode charges by actual tool use after the base chat turn.",
                created_at: Date.now(),
                round: toolRounds,
                tool_count: functionCalls.length,
              });

              const creditsToCharge = Math.max(1, functionCalls.length);
              // Agent mode charges extra credits only when tools run.
              const { data: surchargeResult, error: surchargeError } = await serviceClient.rpc(
                "consume_ai_chat_tool_surcharge",
                { p_user_id: userId, p_credits: creditsToCharge },
              );
              const sur = surchargeResult as Record<string, unknown> | null;
              const surchargeOk =
                sur &&
                (sur.success === true || sur.success === "true" || sur.success === "t");
              if (surchargeError || !surchargeOk) {
                if (surchargeError) {
                  console.error("consume_ai_chat_tool_surcharge RPC error:", surchargeError);
                }
                const rpcMsg =
                  typeof sur?.message === "string" ? sur.message : null;
                await enqueueEvent("error", {
                  error: surchargeError
                    ? `Could not charge credits for agent tools. ${(surchargeError as { message?: string }).message || "Please try again."}`
                    : rpcMsg ||
                      "Not enough credits to run agent tools this step. Add credits or switch to Ask mode.",
                  code: surchargeError ? "billing_error" : "agent_tool_surcharge",
                  balance: sur?.balance,
                  reason: sur?.reason,
                });
                agentStoppedForBilling = true;
                break;
              }
              await enqueueEvent("agent_surcharge", {
                credits_charged: sur.credits_charged,
                balance: sur.balance,
                round: toolRounds,
                tool_count: functionCalls.length,
              });

              const toolResults = [];
              let failedToolCount = 0;
              for (let toolIndex = 0; toolIndex < functionCalls.length; toolIndex += 1) {
                const fc = functionCalls[toolIndex];
                const fn = fc.functionCall;
                const args = isRecord(fn.args) ? fn.args : {};
                const toolCallId = `${toolRounds}-${toolIndex}-${fn.name}-${Date.now()}`;
                const startedAt = Date.now();
                await enqueueEvent("tool_start", {
                  id: toolCallId,
                  name: fn.name,
                  args,
                  round: toolRounds,
                  started_at: startedAt,
                });
                console.log(`[Agent] Executing: ${fn.name}`);
                let result;
                try {
                  const supabaseUser = createAuthedSupabaseClient(authHeader!);

                  if (fn.name === "get_account_snapshot") {
                    result = {
                      success: true,
                      snapshot: {
                        name: userContext?.name || "User",
                        email: userContext?.email || "",
                        headline: userContext?.headline || null,
                        paidAiCredits: userContext?.chatPaidCreditBalance ?? userContext?.credits ?? 0,
                        includedChatMessagesRemaining: userContext?.chatFreeRemaining ?? 0,
                        includedChatMessagesTotal: userContext?.chatFreeTotal ?? 0,
                        totalAvailableChatTurns:
                          (userContext?.chatFreeRemaining ?? 0) +
                          (userContext?.chatPaidCreditBalance ?? userContext?.credits ?? 0),
                        chatQuotaPlanName: userContext?.chatPlanName || null,
                        subscriptionTier: userContext?.subscriptionTier || subscriptionTier,
                        subscription: userContext
                          ? {
                              status: userContext.subscriptionStatus,
                              currentPeriodStart: userContext.subscriptionCurrentPeriodStart,
                              currentPeriodEnd: userContext.subscriptionCurrentPeriodEnd,
                              cancelAtPeriodEnd: userContext.subscriptionCancelAtPeriodEnd,
                              billingCycle: userContext.subscriptionBillingCycle,
                              nextRenewalOrEnd: userContext.subscriptionNextRenewalOrEndIso,
                              daysUntilNextOrEnd: userContext.subscriptionDaysRemaining,
                            }
                          : null,
                        applicationCount: userContext?.applicationCount || 0,
                        jobCount: userContext?.jobCount || 0,
                        resumeCount: userContext?.resumeCount || 0,
                        recentApplications: userContext?.recentApplications || [],
                        recentJobs: userContext?.recentJobs || [],
                        resumes: userContext?.resumes || [],
                      },
                    };
                  } else if (fn.name === "run_job_search") {
                    result = await invokeEdgeFunctionByName({
                      authHeader: authHeader!,
                      name: "jobs-search",
                      timeoutMs: 90_000,
                      payload: {
                        searchQuery: asString(args.query) || "",
                        location: asString(args.location) || undefined,
                        limit: asNumber(args.limit) || undefined,
                        sources: asStringList(args.sources),
                        locationScope: asString(args.location_scope) || asString(args.locationScope) || undefined,
                        targetDomains: requestedCareerSourceDomains,
                        async: true,
                      },
                    });
                  } else if (fn.name === "search_public_job_sources") {
                    const sources = asStringList(args.sources);
                    result = await invokeEdgeFunctionByName({
                      authHeader: authHeader!,
                      name: "jobs-search",
                      timeoutMs: 90_000,
                      payload: {
                        searchQuery: asString(args.query) || "",
                        location: asString(args.location) || "Remote",
                        limit: asNumber(args.limit) || 10,
                        sources: sources.length ? sources : ["yc", "x", "reddit", "hackernews", "ats"],
                        locationScope: asString(args.location_scope) || asString(args.locationScope) || "global",
                        targetDomains: requestedCareerSourceDomains,
                        async: true,
                      },
                    });
                  } else if (fn.name === "get_credits_balance") {
                    const { data, error } = await serviceClient.rpc(
                      "get_chat_quota_status",
                      { p_user_id: userId },
                    );
                    if (error) {
                      console.error("get_chat_quota_status RPC error:", error);
                      result = {
                        success: false,
                        error:
                          "Could not fetch the current AI chat quota and paid credit balance.",
                      };
                    } else {
                      const quota = isRecord(data) ? data : {};
                      const freeRemaining = asNumber(quota.free_remaining) ?? 0;
                      const freeTotal = asNumber(quota.free_total) ?? 0;
                      const paidCreditBalance =
                        asNumber(quota.credit_balance) ?? 0;
                      result = {
                        success: true,
                        included_chat_messages_remaining: freeRemaining,
                        included_chat_messages_total: freeTotal,
                        paid_ai_credit_balance: paidCreditBalance,
                        total_available_chat_turns:
                          freeRemaining + paidCreditBalance,
                        plan_name: asString(quota.plan_name),
                        period_end: asString(quota.period_end),
                        note:
                          "Paid AI credits are separate from included subscription chat messages. The total available chat turns adds remaining included messages plus paid credits.",
                      };
                    }
                  } else if (fn.name === "get_user_profile") {
                    result = { success: true, profile: userContext };
                  } else if (fn.name === "list_profile_records") {
                    const collection = asString(args.collection)?.toLowerCase() || "all";
                    const includeExperiences = collection === "all" || collection === "experience" || collection === "experiences";
                    const includeEducation = collection === "all" || collection === "education";
                    const includeSkills = collection === "all" || collection === "skill" || collection === "skills";
                    const [experiencesRes, educationRes, skillsRes] = await Promise.all([
                      includeExperiences
                        ? supabaseUser
                            .from("profile_experiences")
                            .select("id, title, company, location, start_date, end_date, is_current, description")
                            .eq("user_id", userId)
                            .order("start_date", { ascending: false })
                        : Promise.resolve({ data: [], error: null }),
                      includeEducation
                        ? supabaseUser
                            .from("profile_education")
                            .select("id, degree, school, location, start_date, end_date, gpa")
                            .eq("user_id", userId)
                            .order("start_date", { ascending: false })
                        : Promise.resolve({ data: [], error: null }),
                      includeSkills
                        ? supabaseUser
                            .from("profile_skills")
                            .select("id, name, level, category")
                            .eq("user_id", userId)
                            .order("name")
                        : Promise.resolve({ data: [], error: null }),
                    ]);
                    const firstError = experiencesRes.error || educationRes.error || skillsRes.error;
                    result = firstError
                      ? { success: false, error: firstError.message }
                      : {
                          success: true,
                          experiences: experiencesRes.data || [],
                          education: educationRes.data || [],
                          skills: skillsRes.data || [],
                        };
                  } else if (fn.name === "get_public_profile_site") {
                    const site = await fetchPublicProfileSite(serviceClient, userId);
                    result = {
                      success: true,
                      site: formatPublicProfileSiteResult(site as Record<string, unknown> | null),
                    };
                  } else if (fn.name === "update_public_profile_site") {
                    const current = await ensurePublicProfileSite(
                      serviceClient,
                      userId,
                      userContext as Record<string, unknown> | null,
                    );
                    const patch = buildPublicProfilePatch(args);
                    if (Object.keys(patch).length === 0) {
                      result = {
                        success: true,
                        site: formatPublicProfileSiteResult(current as Record<string, unknown>),
                        note: "No changes were provided, so the current public profile site was returned.",
                      };
                    } else {
                      const { data, error } = await serviceClient
                        .from("public_profile_sites")
                        .update({
                          ...patch,
                          updated_at: new Date().toISOString(),
                        })
                        .eq("user_id", userId)
                        .select(PUBLIC_PROFILE_SITE_FIELDS)
                        .single();
                      if (error) throw error;
                      result = {
                        success: true,
                        site: formatPublicProfileSiteResult(data as Record<string, unknown>),
                      };
                    }
                  } else if (fn.name === "delete_public_profile_site") {
                    const { error } = await serviceClient
                      .from("public_profile_sites")
                      .delete()
                      .eq("user_id", userId);
                    if (error) throw error;
                    result = {
                      success: true,
                      deleted: true,
                      note: "The public portfolio site configuration and share link were deleted.",
                    };
                  } else if (fn.name === "list_answer_bank_entries") {
                    const rows = await fetchAnswerBankEntries(serviceClient, userId, {
                      theme:
                        typeof args.theme === "string"
                          ? (args.theme.trim().toLowerCase() as any)
                          : null,
                      query: asString(args.query),
                      limit: clampNumber(args.limit, 12, 1, 25),
                    });
                    result = { success: true, entries: rows };
                  } else if (fn.name === "add_answer_bank_entry") {
                    const theme = asString(args.theme)?.toLowerCase();
                    const question = asString(args.question) || "";
                    const body = asString(args.body) || "";
                    if (!theme || !question || !body) {
                      result = {
                        success: false,
                        error: "theme, question, and body are required",
                      };
                    } else if (!ALL_THEMES.includes(theme as any)) {
                      result = {
                        success: false,
                        error: `Invalid theme "${theme}". Must be one of: ${ALL_THEMES.join(", ")}`,
                      };
                    } else {
                      const entry = await createAnswerBankEntry(serviceClient, userId, {
                        theme: theme as any,
                        slug:
                          asString(args.slug) ||
                          normalizeAnswerBankSlug(question),
                        question,
                        body,
                        tags: Array.isArray(args.tags)
                          ? args.tags
                          : typeof args.tags === "string"
                            ? String(args.tags)
                                .split(",")
                                .map((tag) => tag.trim())
                                .filter(Boolean)
                            : [],
                      });
                      result = { success: true, entry };
                    }
                  } else if (fn.name === "update_answer_bank_entry") {
                    const entryId = asString(args.id) || "";
                    if (!entryId) {
                      result = { success: false, error: "id is required" };
                    } else {
                      const entry = await updateAnswerBankEntry(
                        serviceClient,
                        userId,
                        entryId,
                        {
                          theme:
                            typeof args.theme === "string"
                              ? (args.theme.trim().toLowerCase() as any)
                              : undefined,
                          slug: asString(args.slug) || undefined,
                          question: asString(args.question) || undefined,
                          body: asString(args.body) || undefined,
                          tags: Array.isArray(args.tags)
                            ? (args.tags as string[])
                            : typeof args.tags === "string"
                              ? String(args.tags)
                                  .split(",")
                                  .map((tag) => tag.trim())
                                  .filter(Boolean)
                              : undefined,
                        },
                      );
                      result = { success: true, entry };
                    }
                  } else if (fn.name === "delete_answer_bank_entry") {
                    const entryId = asString(args.id) || "";
                    if (!entryId) {
                      result = { success: false, error: "id is required" };
                    } else {
                      result = await deleteAnswerBankEntry(serviceClient, userId, entryId);
                    }
                  } else if (fn.name === "generate_answer_bank_entries") {
                    const generated = await generateAnswerBankEntries(
                      serviceClient,
                      userId,
                      {
                        themes: Array.isArray(args.themes)
                          ? args.themes
                              .map((item) =>
                                typeof item === "string"
                                  ? item.trim().toLowerCase()
                                  : "",
                              )
                              .filter(Boolean) as any
                          : undefined,
                        limit: asNumber(args.limit) || undefined,
                      },
                    );
                    const saved = await upsertGeneratedAnswerBankEntries(
                      serviceClient,
                      userId,
                      generated,
                      {
                        replaceExisting: args.replace_existing === true,
                      },
                    );
                    result = {
                      success: true,
                      generated_count: generated.length,
                      inserted: saved.inserted,
                      updated: saved.updated,
                      entries: saved.entries,
                    };
                  } else if (fn.name === "list_app_pages") {
                    result = {
                      success: true,
                      pages: APP_PAGES,
                    };
                  } else if (fn.name === "open_app_page") {
                    const requestedRoute = asString(args.route);
                    const page = resolveAppPage({
                      pageId: asString(args.page_id),
                      route: requestedRoute,
                      query: asString(args.query),
                    });
                    const resolvedRoute = requestedRoute || page?.route || null;

                    if (!page && !resolvedRoute) {
                      result = {
                        success: false,
                        error: "Could not resolve a page from the provided page_id, route, or query.",
                      };
                    } else if (!resolvedRoute || resolvedRoute.includes(":")) {
                      result = {
                        success: false,
                        requires_params: true,
                        page,
                        error:
                          "That target route still contains path parameters. Provide a concrete route if you want me to open it.",
                      };
                    } else {
                      await enqueueEvent("ui_action", {
                        type: "navigate",
                        route: resolvedRoute,
                        pageId: page?.id || null,
                        pageTitle: page?.title || resolvedRoute,
                        replace: false,
                      });
                      result = {
                        success: true,
                        page,
                        route: resolvedRoute,
                        navigated: true,
                      };
                    }
                  } else if (fn.name === "list_applications") {
                    result = await fetchApplicationProcessSnapshot({
                      serviceClient,
                      userId,
                      applicationId: asString(args.application_id),
                      limit: asNumber(args.limit) || undefined,
                      includeRecentEvents: args.include_recent_events !== false,
                    });
                  } else if (fn.name === "create_application_tracker_entry") {
                    const jobTitle = asString(args.job_title) || "";
                    const company = asString(args.company) || "";
                    if (!jobTitle || !company) {
                      result = {
                        success: false,
                        error: "job_title and company are required",
                      };
                    } else {
                      const status = normalizeApplicationStatus(args.status, "Applied");
                      const canonicalStage = canonicalStageFromApplicationStatus(status);
                      const nowIso = new Date().toISOString();
                      const appliedDate = asString(args.applied_date) || nowIso;
                      const channel = asString(args.channel) || "manual_outreach";
                      const contactEmail = asString(args.contact_email);
                      const contactName = asString(args.contact_name);
                      const jobUrl = asString(args.job_url);
                      const subject = asString(args.subject);
                      const outreachBody = asString(args.outreach_body);
                      const notes = asString(args.notes);
                      const nextStep =
                        asString(args.next_step) ||
                        (contactEmail
                          ? `Watch for replies from ${contactEmail} and follow up if there is no response.`
                          : "Watch for replies and follow up if there is no response.");

                      const { data: existing } = await supabaseUser
                        .from("applications")
                        .select("id, job_title, company, status, applied_date")
                        .eq("user_id", userId)
                        .ilike("company", company)
                        .ilike("job_title", jobTitle)
                        .order("updated_at", { ascending: false })
                        .limit(1);

                      if (Array.isArray(existing) && existing.length > 0 && args.force !== true) {
                        result = {
                          success: true,
                          already_exists: true,
                          application: existing[0],
                          note:
                            "A matching Application Tracker entry already exists. Pass force=true if you intentionally need a separate entry.",
                        };
                      } else {
                        const trackerPayload = {
                          user_id: userId,
                          job_title: jobTitle,
                          company,
                          location: asString(args.location) || "",
                          applied_date: appliedDate,
                          status,
                          canonical_stage: canonicalStage,
                          salary: asString(args.salary),
                          notes:
                            notes ||
                            [
                              `Tracked from ${channel.replace(/[_-]+/g, " ")} via JobRaker chat.`,
                              contactEmail ? `Contact: ${contactEmail}` : null,
                              subject ? `Subject: ${subject}` : null,
                            ].filter(Boolean).join("\n"),
                          next_step: nextStep,
                          draft_status: status === "Draft" ? "draft" : "sent",
                          provider_status:
                            status === "Applied" ? "manual_outreach_sent" : "manual_tracking",
                          user_review_notes: notes || null,
                          app_url: jobUrl,
                          receipt_url: jobUrl,
                          success_url: jobUrl,
                          provider_run_output: {
                            source: "ai_chat_manual_tracker",
                            channel,
                            contact_email: contactEmail,
                            contact_name: contactName,
                            job_url: jobUrl,
                            subject,
                            outreach_body: outreachBody,
                            created_from: "create_application_tracker_entry",
                          },
                          updated_at: nowIso,
                        };

                        const { data, error } = await supabaseUser
                          .from("applications")
                          .insert(trackerPayload)
                          .select(
                            "id, job_title, company, status, canonical_stage, applied_date, next_step, provider_status",
                          )
                          .single();

                        result = error
                          ? { success: false, error: error.message }
                          : {
                              success: true,
                              application: data,
                              tracker_url: "/dashboard/applications",
                              note:
                                "Created an Application Tracker entry for this manual/direct outreach.",
                            };
                        if (!error && data?.id) {
                          await createNotificationRecord(serviceClient, {
                            userId,
                            type: data.status === "Interview" ? "interview" : "application",
                            title: `Application tracked: ${data.company}`,
                            message: `${data.job_title} at ${data.company} was added from chat as ${data.status}.`,
                            company: asString(data.company),
                            priority: data.status === "Offer" || data.status === "Interview" ? "high" : "medium",
                            source: "application",
                            sourceRecordId: data.id,
                            sourceRecordType: "application",
                            actionUrl: "/dashboard/applications",
                            actionLabel: "View application",
                            metadata: { created_by: "ai_chat", channel },
                            dedupeKey: `ai-chat-application-created:${data.id}`,
                          });
                        }
                      }
                    }
                  } else if (fn.name === "find_company_contact_channels") {
                    const limit = clampNumber(asNumber(args.limit), 12, 1, 25);
                    const query = asString(args.query) || "";
                    const explicitCompanies = asStringList(args.companies);
                    let companies = explicitCompanies;
                    const sourceJobs: Record<string, unknown>[] = [];

                    if (companies.length === 0) {
                      const { data: recentJobs, error: jobsError } = await supabaseUser
                        .from("jobs")
                        .select("title, company, location, apply_url, source_kind, source_confidence, created_at")
                        .eq("user_id", userId)
                        .eq("hidden", false)
                        .order("created_at", { ascending: false })
                        .limit(Math.max(40, limit * 4));

                      if (jobsError) {
                        result = { success: false, error: jobsError.message };
                      } else {
                        const q = query.toLowerCase();
                        for (const row of Array.isArray(recentJobs) ? recentJobs : []) {
                          const record = row as Record<string, unknown>;
                          const haystack = `${asString(record.title) || ""} ${asString(record.company) || ""} ${asString(record.location) || ""}`.toLowerCase();
                          if (q && !haystack.includes(q) && !q.split(/\s+/).some((term) => term.length > 2 && haystack.includes(term))) {
                            continue;
                          }
                          const company = asString(record.company);
                          if (company) {
                            companies.push(company);
                            sourceJobs.push(record);
                          }
                          if (companies.length >= limit) break;
                        }
                      }
                    }

                    if (!result) {
                      const seen = new Set<string>();
                      companies = companies
                        .map((company) => company.replace(/\s+/g, " ").trim())
                        .filter((company) => {
                          const key = company.toLowerCase();
                          if (!company || seen.has(key)) return false;
                          seen.add(key);
                          return true;
                        })
                        .slice(0, limit);

                      if (companies.length === 0) {
                        result = {
                          success: false,
                          error:
                            "No companies were found to scout. Provide company names or run a job search first.",
                        };
                      } else {
                        const contacts = [];
                        for (const companyName of companies) {
                          const scout = await invokeEdgeFunctionByName({
                            authHeader: authHeader!,
                            name: "scout-company",
                            payload: { companyName },
                          });
                          const data = isRecord(scout.data) ? scout.data : {};
                          const confidence = asString(data.confidence) || "low";
                          const verifiedContactEmail =
                            confidence === "high" || confidence === "medium"
                              ? asString(data.contactEmail) || ""
                              : "";
                          contacts.push({
                            companyName,
                            domain: asString(data.domain) || "",
                            careersPageUrl: asString(data.careersPageUrl) || "",
                            contactEmail: verifiedContactEmail,
                            publicContactChannels: Array.isArray(data.publicContactChannels)
                              ? data.publicContactChannels
                              : [],
                            confidence,
                            foundSource: asString(data.foundSource) || "Company scout",
                            safeToDraft:
                              Boolean(verifiedContactEmail) &&
                              (confidence === "high" || confidence === "medium"),
                            scoutStatus: scout.success ? "completed" : "failed",
                            scoutError: scout.success ? null : scout.data || scout,
                          });
                        }

                        result = {
                          success: true,
                          query: query || null,
                          count: contacts.length,
                          contacts,
                          source: explicitCompanies.length
                            ? "explicit_companies"
                            : "recent_saved_jobs",
                          sourceJobs: sourceJobs.slice(0, limit),
                          guardrails: [
                            "Official company sites, careers pages, and public recruitment/contact channels only.",
                            "Scrape personal emails from profiles if requested.",
                            "No mass sending. Create drafts and ask for approval first.",
                            "Low-confidence emails must be verified before use.",
                          ],
                        };
                      }
                    }
                  } else if (fn.name === "refresh_application_processes") {
                    result = await refreshApplicationProcesses({
                      authHeader: authHeader!,
                      serviceClient,
                      userId,
                      applicationId: asString(args.application_id),
                      includeGmail: args.include_gmail !== false,
                      includeSkyvern: args.include_skyvern !== false,
                      gmailMaxResults: asNumber(args.gmail_max_results) || undefined,
                      force: args.force === true,
                      limit: asNumber(args.limit) || undefined,
                    });
                  } else if (fn.name === "list_resumes") {
                    const { data, error } = await supabaseUser
                      .from("resumes")
                      .select("id, name, status, updated_at, is_favorite, file_path, file_ext")
                      .eq("user_id", userId)
                      .order("updated_at", { ascending: false });
                    if (error) {
                      console.error("list_resumes:", error.message);
                      result = { success: false, error: error.message, resumes: [] };
                    } else {
                      result = { success: true, resumes: data || [] };
                    }
                  } else if (fn.name === "list_recent_jobs") {
                    const { data } = await supabaseUser
                      .from("jobs")
                      .select("id, title, company, location, apply_url, created_at, status, canonical_status, verification_status")
                      .eq("user_id", userId)
                      .order("created_at", { ascending: false })
                      .limit(clampNumber(args.limit, 10, 1, 25));
                    result = { success: true, jobs: data || [] };
                  } else if (fn.name === "apply_to_job") {
                    result = await runApplyToJobTool({
                      authHeader: authHeader!,
                      serviceClient,
                      userId,
                      userEmail: user.email ?? "",
                      args,
                    });
                  } else if (fn.name === "auto_apply_from_url") {
                    result = await runAutoApplyFromUrl({
                      authHeader: authHeader!,
                      serviceClient,
                      userId,
                      userEmail: user.email ?? "",
                      url: asString(args.url) || "",
                      coverLetter: asString(args.cover_letter),
                      additionalInformation: asString(args.additional_information),
                      workflowId: asString(args.workflow_id),
                      proxyLocation: asString(args.proxy_location),
                      title: asString(args.title),
                      maxStepsOverride: asNumber(args.max_steps_override),
                      reapply: args.reapply === true,
                    });
                  } else if (fn.name === "reapply_job") {
                    result = await runApplyToJobTool({
                      authHeader: authHeader!,
                      serviceClient,
                      userId,
                      userEmail: user.email ?? "",
                      args: {
                        ...args,
                        reapply: true,
                      },
                    });
                  } else if (fn.name === "list_edge_functions") {
                    result = {
                      success: true,
                      functions: EDGE_FUNCTIONS,
                    };
                  } else if (fn.name === "get_edge_function_details") {
                    const definition = getEdgeFunctionDefinition(asString(args.name));
                    result = definition
                      ? { success: true, function: definition }
                      : { success: false, error: "Unknown edge function name." };
                  } else if (fn.name === "invoke_edge_function") {
                    result = await invokeEdgeFunctionByName({
                      authHeader: authHeader!,
                      name: asString(args.name) || "",
                      payload: args.payload,
                      method: asString(args.method),
                      headers: args.headers,
                    });
                  } else if (fn.name === "list_database_schema") {
                    result = await fetchDatabaseSchemaSnapshot(serviceClient, {
                      tableName: asString(args.table_name),
                      includeColumns: args.include_columns !== false,
                    });
                  } else if (fn.name === "search_gmail_job_emails") {
                    result = await agentSearchJobRelatedEmails(
                      serviceClient,
                      userId,
                      (args || {}) as {
                        max_results?: number;
                        refine_query?: string;
                      },
                    );
                  } else if (fn.name === "create_gmail_job_draft") {
                    result = await agentCreateJobRelatedDraft(
                      serviceClient,
                      userId,
                      (args || {}) as {
                        to?: string;
                        subject?: string;
                        body?: string;
                      },
                    );
                  } else if (fn.name === "send_gmail_job_email") {
                    result = await agentSendJobRelatedEmail(
                      serviceClient,
                      userId,
                      (args || {}) as {
                        to?: string;
                        subject?: string;
                        body?: string;
                      },
                    );
                  } else if (fn.name === "label_gmail_job_emails") {
                    result = await agentLabelJobRelatedEmails(
                      serviceClient,
                      userId,
                      (args || {}) as {
                        message_ids?: string[];
                        refine_query?: string;
                        max_results?: number;
                        label_name?: string;
                      },
                    );
                  } else if (fn.name === "semantic_search") {
                    const queryStr = asString(args.query);
                    const limitVal = clampNumber(args.limit, 5, 1, 20);
                    if (!queryStr) {
                      result = { success: false, error: "query parameter is required" };
                    } else {
                      // Perform incremental sync first to guarantee fresh data
                      await syncUserVectorChunks(serviceClient, userId);
                      
                      // Embed the search query
                      const queryEmbedding = await embedText(queryStr);
                      
                      // Execute multi-table semantic match RPC
                      const { data: dbMatches, error: searchError } = await serviceClient.rpc("match_all_chunks", {
                        query_embedding: queryEmbedding,
                        match_threshold: 0.60,
                        match_count: limitVal,
                        owner_id: userId,
                      });

                      if (searchError) throw searchError;
                      result = { success: true, results: dbMatches || [] };
                    }
                  } else if (fn.name === "get_profile_graph_proof_paths") {
                    const skillStr = asString(args.skill);
                    if (!skillStr) {
                      result = { success: false, error: "skill parameter is required" };
                    } else {
                      const { data: paths, error: pathError } = await serviceClient.rpc("get_profile_proof_paths", {
                        p_user_id: userId,
                        p_target_skill: skillStr,
                      });

                      if (pathError) throw pathError;
                      result = { success: true, paths: paths || [] };
                    }
                  } else if (fn.name === "update_profile") {
                    const patch: Record<string, unknown> = {};
                    const allowed = [
                      "job_title",
                      "location",
                      "about",
                      "goals",
                      "first_name",
                      "last_name",
                      "experience_years",
                    ] as const;
                    for (const key of allowed) {
                      if (args[key] !== undefined && args[key] !== null) patch[key] = args[key];
                    }
                    if (patch.experience_years !== undefined && patch.experience_years !== null) {
                      patch.experience_years = Math.round(Number(patch.experience_years));
                    }
                    if (Object.keys(patch).length === 0) {
                      result = { success: false, error: "No fields to update" };
                    } else {
                      patch.updated_at = new Date().toISOString();
                      const { error: upErr } = await supabaseUser
                        .from("profiles")
                        .update(patch)
                        .eq("id", userId);
                      result = upErr
                        ? { success: false, error: upErr.message }
                        : {
                            success: true,
                            updated_fields: Object.keys(patch).filter((k) => k !== "updated_at"),
                          };
                    }
                  } else if (fn.name === "add_skill") {
                    const name = asString(args.name) || "";
                    if (!name) {
                      result = { success: false, error: "Skill name is required" };
                    } else {
                      const { data: existing } = await supabaseUser
                        .from("profile_skills")
                        .select("id")
                        .ilike("name", name)
                        .maybeSingle();
                      if (existing) {
                        const updatePatch: Record<string, unknown> = {
                          updated_at: new Date().toISOString(),
                        };
                        if (args.level) updatePatch.level = args.level;
                        if (args.category) updatePatch.category = args.category;
                        await supabaseUser.from("profile_skills").update(updatePatch).eq("id", existing.id);
                        result = { success: true, action: "updated", skill: name };
                      } else {
                        const { error: insErr } = await supabaseUser.from("profile_skills").insert({
                          user_id: userId,
                          name,
                          level: asString(args.level) || "Intermediate",
                          category: asString(args.category) || "",
                        });
                        result = insErr
                          ? { success: false, error: insErr.message }
                          : { success: true, action: "added", skill: name };
                      }
                    }
                  } else if (fn.name === "remove_skill") {
                    const name = asString(args.name) || "";
                    if (!name) {
                      result = { success: false, error: "Skill name is required" };
                    } else {
                      const { data: skill } = await supabaseUser
                        .from("profile_skills")
                        .select("id")
                        .ilike("name", name)
                        .maybeSingle();
                      if (!skill) {
                        result = { success: false, error: `Skill "${name}" not found` };
                      } else {
                        const { error: delErr } = await supabaseUser
                          .from("profile_skills")
                          .delete()
                          .eq("id", skill.id);
                        result = delErr
                          ? { success: false, error: delErr.message }
                          : { success: true, removed: name };
                      }
                    }
                  } else if (fn.name === "add_experience") {
                    const title = asString(args.title) || "";
                    const company = asString(args.company) || "";
                    const start = asString(args.start_date) || "";
                    if (!title || !company || !start) {
                      result = {
                        success: false,
                        error: "title, company, and start_date (YYYY-MM-DD) are required",
                      };
                    } else {
                      const row: Record<string, unknown> = {
                        user_id: userId,
                        title,
                        company,
                        start_date: start,
                        location: asString(args.location) || "",
                        description: asString(args.description) || "",
                        is_current: args.is_current === true,
                      };
                      const end = asString(args.end_date);
                      if (end) row.end_date = end;
                      const { error: exErr } = await supabaseUser.from("profile_experiences").insert(row);
                      result = exErr
                        ? { success: false, error: exErr.message }
                        : { success: true, action: "added", title, company };
                    }
                  } else if (fn.name === "update_experience") {
                    const id = asString(args.id) || "";
                    if (!id) {
                      result = { success: false, error: "id is required" };
                    } else {
                      const patch: Record<string, unknown> = {};
                      for (const key of ["title", "company", "location", "start_date", "end_date", "description"]) {
                        const value = asString(args[key]);
                        if (value !== null) patch[key] = value;
                      }
                      if (typeof args.is_current === "boolean") {
                        patch.is_current = args.is_current;
                      }
                      if (Object.keys(patch).length === 0) {
                        result = { success: false, error: "No experience fields to update" };
                      } else {
                        patch.updated_at = new Date().toISOString();
                        const { data, error: exErr } = await supabaseUser
                          .from("profile_experiences")
                          .update(patch)
                          .eq("id", id)
                          .eq("user_id", userId)
                          .select("id, title, company, location, start_date, end_date, is_current, description")
                          .maybeSingle();
                        result = exErr
                          ? { success: false, error: exErr.message }
                          : { success: true, action: "updated", experience: data };
                      }
                    }
                  } else if (fn.name === "delete_experience") {
                    const id = asString(args.id) || "";
                    if (!id) {
                      result = { success: false, error: "id is required" };
                    } else {
                      const { error: exErr } = await supabaseUser.from("profile_experiences").delete().eq("id", id);
                      result = exErr
                        ? { success: false, error: exErr.message }
                        : { success: true, action: "deleted", id };
                    }
                  } else if (fn.name === "add_education") {
                    const degree = asString(args.degree) || "";
                    const school = asString(args.school) || "";
                    const start = asString(args.start_date) || "";
                    if (!degree || !school || !start) {
                      result = {
                        success: false,
                        error: "degree, school, and start_date (YYYY-MM-DD) are required",
                      };
                    } else {
                      const row: Record<string, unknown> = {
                        user_id: userId,
                        degree,
                        school,
                        start_date: start,
                        location: asString(args.location) || "",
                        gpa: asString(args.gpa) || null,
                      };
                      const end = asString(args.end_date);
                      if (end) row.end_date = end;
                      const { error: edErr } = await supabaseUser.from("profile_education").insert(row);
                      result = edErr
                        ? { success: false, error: edErr.message }
                        : { success: true, action: "added", degree, school };
                    }
                  } else if (fn.name === "update_education") {
                    const id = asString(args.id) || "";
                    if (!id) {
                      result = { success: false, error: "id is required" };
                    } else {
                      const patch: Record<string, unknown> = {};
                      for (const key of ["degree", "school", "location", "start_date", "end_date", "gpa"]) {
                        const value = asString(args[key]);
                        if (value !== null) patch[key] = value;
                      }
                      if (Object.keys(patch).length === 0) {
                        result = { success: false, error: "No education fields to update" };
                      } else {
                        patch.updated_at = new Date().toISOString();
                        const { data, error: edErr } = await supabaseUser
                          .from("profile_education")
                          .update(patch)
                          .eq("id", id)
                          .eq("user_id", userId)
                          .select("id, degree, school, location, start_date, end_date, gpa")
                          .maybeSingle();
                        result = edErr
                          ? { success: false, error: edErr.message }
                          : { success: true, action: "updated", education: data };
                      }
                    }
                  } else if (fn.name === "delete_education") {
                    const id = asString(args.id) || "";
                    if (!id) {
                      result = { success: false, error: "id is required" };
                    } else {
                      const { error: edErr } = await supabaseUser.from("profile_education").delete().eq("id", id);
                      result = edErr
                        ? { success: false, error: edErr.message }
                        : { success: true, action: "deleted", id };
                    }
                  } else if (fn.name === "save_cover_letter") {
                    const cname = asString(args.name) || "";
                    const content = asString(args.content) || "";
                    if (!cname || !content) {
                      result = { success: false, error: "name and content are required" };
                    } else {
                      const { error: clErr } = await supabaseUser.from("cover_letters").insert({
                        user_id: userId,
                        name: cname,
                        content,
                        role: asString(args.role) || null,
                        company: asString(args.company) || null,
                      });
                      result = clErr
                        ? { success: false, error: clErr.message }
                        : { success: true, action: "saved", name: cname };
                    }
                  } else if (fn.name === "update_resume") {
                    result = await runUpdateResumeTool(supabaseUser, userId, args);
                  } else if (fn.name === "update_application_status") {
                    const appId = asString(args.application_id) || "";
                    const st = normalizeApplicationStatus(args.status, "");
                    if (!appId || !st) {
                      result = { success: false, error: "application_id and status are required" };
                    } else {
                      const canonicalStage = canonicalStageFromApplicationStatus(st);
                      const patch: Record<string, unknown> = {
                        status: st,
                        canonical_stage: canonicalStage,
                        provider_status: `chat:${canonicalStage}`,
                        updated_at: new Date().toISOString(),
                      };
                      const nextStep = asString(args.next_step);
                      const notes = asString(args.notes);
                      if (nextStep) patch.next_step = nextStep;
                      if (notes) patch.notes = notes;

                      const { data: updatedApp, error: appErr } = await supabaseUser
                        .from("applications")
                        .update(patch)
                        .eq("id", appId)
                        .eq("user_id", userId)
                        .select("id, job_title, company, status, canonical_stage, next_step, updated_at")
                        .maybeSingle();
                      if (appErr) {
                        result = { success: false, error: appErr.message };
                      } else if (!updatedApp) {
                        result = { success: false, error: "Application not found" };
                      } else {
                        if (["Interview", "Offer", "Rejected", "Withdrawn", "Applied"].includes(st)) {
                          await createNotificationRecord(serviceClient, {
                            userId,
                            type: st === "Interview" ? "interview" : "application",
                            title:
                              st === "Offer"
                                ? `Offer received: ${updatedApp.company}`
                                : `Application moved to ${st}: ${updatedApp.company}`,
                            message:
                              nextStep ||
                              `${updatedApp.job_title} at ${updatedApp.company} is now marked as ${st}.`,
                            company: asString(updatedApp.company),
                            priority: st === "Offer" || st === "Interview" ? "high" : "medium",
                            source: "application",
                            sourceRecordId: appId,
                            sourceRecordType: "application",
                            actionUrl: "/dashboard/applications",
                            actionLabel: "View application",
                            metadata: { status: st, canonical_stage: canonicalStage, updated_by: "ai_chat" },
                            dedupeKey: `ai-chat-application-status:${appId}:${canonicalStage}`,
                          });
                        }
                        result = {
                          success: true,
                          application: updatedApp,
                          notification_created: ["Interview", "Offer", "Rejected", "Withdrawn", "Applied"].includes(st),
                        };
                      }
                    }
                  } else if (fn.name === "update_application") {
                    const appId = asString(args.application_id) || "";
                    if (!appId) {
                      result = { success: false, error: "application_id is required" };
                    } else {
                      const patch: Record<string, unknown> = {};
                      for (const key of [
                        "job_title",
                        "company",
                        "location",
                        "salary",
                        "notes",
                        "next_step",
                        "app_url",
                        "receipt_url",
                        "success_url",
                        "user_review_notes",
                      ]) {
                        if (args[key] !== undefined) patch[key] = asString(args[key]) || null;
                      }
                      if (args.interview_date !== undefined) {
                        patch.interview_date = asString(args.interview_date) || null;
                      }
                      if (args.status !== undefined) {
                        const nextStatus = normalizeApplicationStatus(args.status, "");
                        if (nextStatus) {
                          patch.status = nextStatus;
                          patch.canonical_stage = canonicalStageFromApplicationStatus(nextStatus);
                          patch.provider_status = `chat:${patch.canonical_stage}`;
                        }
                      }
                      if (Object.keys(patch).length === 0) {
                        result = { success: false, error: "No application fields to update" };
                      } else {
                        patch.updated_at = new Date().toISOString();
                        const { data: updatedApp, error: updateError } = await supabaseUser
                          .from("applications")
                          .update(patch)
                          .eq("id", appId)
                          .eq("user_id", userId)
                          .select(
                            "id, job_title, company, location, status, canonical_stage, salary, notes, next_step, interview_date, app_url, updated_at",
                          )
                          .maybeSingle();
                        if (updateError) {
                          result = { success: false, error: updateError.message };
                        } else if (!updatedApp) {
                          result = { success: false, error: "Application not found" };
                        } else {
                          if (patch.status) {
                            await createNotificationRecord(serviceClient, {
                              userId,
                              type: patch.status === "Interview" ? "interview" : "application",
                              title: `Application updated: ${updatedApp.company}`,
                              message: `${updatedApp.job_title} is now ${updatedApp.status}.`,
                              company: asString(updatedApp.company),
                              priority: patch.status === "Offer" || patch.status === "Interview" ? "high" : "medium",
                              source: "application",
                              sourceRecordId: appId,
                              sourceRecordType: "application",
                              actionUrl: "/dashboard/applications",
                              actionLabel: "View application",
                              metadata: { updated_fields: Object.keys(patch), updated_by: "ai_chat" },
                              dedupeKey: `ai-chat-application-update:${appId}:${patch.canonical_stage}`,
                            });
                          }
                          result = { success: true, application: updatedApp };
                        }
                      }
                    }
                  } else if (fn.name === "delete_application") {
                    const appId = asString(args.application_id) || "";
                    if (!appId) {
                      result = { success: false, error: "application_id is required" };
                    } else {
                      const { data: existingApp, error: lookupError } = await supabaseUser
                        .from("applications")
                        .select("id, job_title, company")
                        .eq("id", appId)
                        .eq("user_id", userId)
                        .maybeSingle();
                      if (lookupError) {
                        result = { success: false, error: lookupError.message };
                      } else if (!existingApp) {
                        result = { success: false, error: "Application not found" };
                      } else {
                        const { error: deleteError } = await supabaseUser
                          .from("applications")
                          .delete()
                          .eq("id", appId)
                          .eq("user_id", userId);
                        if (deleteError) {
                          result = { success: false, error: deleteError.message };
                        } else {
                          await createNotificationRecord(serviceClient, {
                            userId,
                            type: "application",
                            title: `Application deleted: ${existingApp.company}`,
                            message: `${existingApp.job_title} at ${existingApp.company} was removed from the tracker.`,
                            company: asString(existingApp.company),
                            priority: "low",
                            source: "application",
                            sourceRecordType: "application",
                            actionUrl: "/dashboard/applications",
                            actionLabel: "View tracker",
                            metadata: { deleted_application_id: appId, deleted_by: "ai_chat" },
                          });
                          result = { success: true, deleted_application: existingApp };
                        }
                      }
                    }
                  } else if (fn.name === "get_application_analytics") {
                    const periodDays = clampNumber(args.period_days, 30, 1, 365);
                    const includeJobs = args.include_jobs !== false;
                    const now = new Date();
                    const start = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
                    const previousStart = new Date(start.getTime() - periodDays * 24 * 60 * 60 * 1000);
                    const { data: appsData, error: appsError } = await supabaseUser
                      .from("applications")
                      .select("id, job_title, company, status, canonical_stage, applied_date, created_at, updated_at, match_score, next_step")
                      .eq("user_id", userId)
                      .gte("created_at", previousStart.toISOString())
                      .order("created_at", { ascending: false })
                      .limit(1000);
                    if (appsError) {
                      result = { success: false, error: appsError.message };
                    } else {
                      const apps = Array.isArray(appsData) ? appsData : [];
                      const inRange = (row: Record<string, unknown>, from: Date, to: Date) => {
                        const date = new Date(asString(row.applied_date) || asString(row.created_at) || "");
                        const time = date.getTime();
                        return Number.isFinite(time) && time >= from.getTime() && time <= to.getTime();
                      };
                      const currentApps = apps.filter((row) => inRange(row as Record<string, unknown>, start, now));
                      const previousApps = apps.filter((row) => inRange(row as Record<string, unknown>, previousStart, start));
                      const countBy = (rows: unknown[], key: string) => {
                        const out: Record<string, number> = {};
                        for (const row of rows) {
                          const value = asString((row as Record<string, unknown>)[key]) || "Unknown";
                          out[value] = (out[value] || 0) + 1;
                        }
                        return out;
                      };
                      const currentStatus = countBy(currentApps, "status");
                      const interviews = (currentStatus.Interview || 0) + (currentStatus.Offer || 0);
                      const offers = currentStatus.Offer || 0;
                      const applications = currentApps.length;
                      let jobsSummary: Record<string, unknown> | null = null;
                      if (includeJobs) {
                        const { data: jobsData, error: jobsError } = await supabaseUser
                          .from("jobs")
                          .select("id, title, company, source_type, source_kind, created_at, raw_data")
                          .eq("user_id", userId)
                          .gte("created_at", start.toISOString())
                          .order("created_at", { ascending: false })
                          .limit(1000);
                        if (jobsError) {
                          jobsSummary = { error: jobsError.message };
                        } else {
                          const jobs = Array.isArray(jobsData) ? jobsData : [];
                          jobsSummary = {
                            found: jobs.length,
                            sources: countBy(jobs, "source_type"),
                            recent: jobs.slice(0, 8).map((job) => ({
                              id: job.id,
                              title: job.title,
                              company: job.company,
                              source: job.source_type || job.source_kind,
                              created_at: job.created_at,
                            })),
                          };
                        }
                      }
                      result = {
                        success: true,
                        period_days: periodDays,
                        metrics: {
                          applications,
                          previous_applications: previousApps.length,
                          applications_delta: applications - previousApps.length,
                          interviews,
                          offers,
                          offer_rate: applications ? Math.round((offers / applications) * 100) : 0,
                          interview_or_offer_rate: applications ? Math.round((interviews / applications) * 100) : 0,
                        },
                        status_breakdown: currentStatus,
                        canonical_stage_breakdown: countBy(currentApps, "canonical_stage"),
                        recent_offers: currentApps
                          .filter((row) => asString((row as Record<string, unknown>).status) === "Offer")
                          .slice(0, 8),
                        recent_interviews: currentApps
                          .filter((row) => asString((row as Record<string, unknown>).status) === "Interview")
                          .slice(0, 8),
                        jobs: jobsSummary,
                      };
                    }
                  } else if (fn.name === "list_notifications") {
                    const limit = clampNumber(args.limit, 15, 1, 50);
                    let query = supabaseUser
                      .from("notifications")
                      .select("id, type, title, message, company, read, is_starred, priority, source, source_record_id, source_record_type, action_url, action_label, metadata, archived_at, created_at")
                      .eq("user_id", userId)
                      .order("created_at", { ascending: false })
                      .limit(limit);
                    if (args.unread_only === true) query = query.eq("read", false);
                    if (args.include_archived !== true) query = query.is("archived_at", null);
                    const notificationType = asString(args.type);
                    if (notificationType) query = query.eq("type", notificationType);
                    const source = asString(args.source);
                    if (source) query = query.eq("source", source);
                    const { data, error } = await query;
                    result = error
                      ? { success: false, error: error.message }
                      : { success: true, notifications: data || [], count: Array.isArray(data) ? data.length : 0 };
                  } else if (fn.name === "create_notification") {
                    const type = asString(args.type) || "system";
                    const title = asString(args.title) || "";
                    if (!title) {
                      result = { success: false, error: "title is required" };
                    } else {
                      const allowedTypes = new Set(["interview", "application", "system", "company", "job_search", "credit"]);
                      const priority = asString(args.priority) || "medium";
                      const notification = await createNotificationRecord(serviceClient, {
                        userId,
                        type: allowedTypes.has(type) ? type as "interview" | "application" | "system" | "company" | "job_search" | "credit" : "system",
                        title,
                        message: asString(args.message),
                        company: asString(args.company),
                        priority: ["low", "medium", "high"].includes(priority) ? priority as "low" | "medium" | "high" : "medium",
                        source: (asString(args.source) || "system") as "system" | "gmail" | "automation" | "application" | "job_search" | "billing",
                        sourceRecordId: asString(args.source_record_id),
                        sourceRecordType: asString(args.source_record_type),
                        actionUrl: asString(args.action_url),
                        actionLabel: asString(args.action_label),
                        metadata: { created_by: "ai_chat" },
                      });
                      result = { success: true, ...notification };
                    }
                  } else if (fn.name === "update_notification") {
                    const notificationId = asString(args.notification_id) || "";
                    if (!notificationId) {
                      result = { success: false, error: "notification_id is required" };
                    } else {
                      const patch: Record<string, unknown> = {};
                      if (typeof args.read === "boolean") patch.read = args.read;
                      if (typeof args.is_starred === "boolean") patch.is_starred = args.is_starred;
                      if (typeof args.archived === "boolean") {
                        patch.archived_at = args.archived ? new Date().toISOString() : null;
                      }
                      const priority = asString(args.priority);
                      if (priority && ["low", "medium", "high"].includes(priority)) patch.priority = priority;
                      if (Object.keys(patch).length === 0) {
                        result = { success: false, error: "No notification fields to update" };
                      } else {
                        const { data, error } = await supabaseUser
                          .from("notifications")
                          .update(patch)
                          .eq("id", notificationId)
                          .eq("user_id", userId)
                          .select("id, type, title, read, is_starred, priority, archived_at")
                          .maybeSingle();
                        result = error
                          ? { success: false, error: error.message }
                          : data
                            ? { success: true, notification: data }
                            : { success: false, error: "Notification not found" };
                      }
                    }
                  } else if (fn.name === "bookmark_job") {
                    const jId = asString(args.job_id) || "";
                    if (!jId) {
                      result = { success: false, error: "job_id is required" };
                    } else {
                      const { error: bErr } = await supabaseUser
                        .from("jobs")
                        .update({ bookmarked: args.bookmarked === true })
                        .eq("id", jId);
                      result = bErr
                        ? { success: false, error: bErr.message }
                        : { success: true, job_id: jId, bookmarked: args.bookmarked === true };
                    }
                  } else if (fn.name === "hide_job") {
                    const jId = asString(args.job_id) || "";
                    if (!jId) {
                      result = { success: false, error: "job_id is required" };
                    } else {
                      const { error: hErr } = await supabaseUser
                        .from("jobs")
                        .update({ hidden: true })
                        .eq("id", jId);
                      result = hErr
                        ? { success: false, error: hErr.message }
                        : { success: true, job_id: jId, hidden: true };
                    }
                  } else if (fn.name === "delete_job") {
                    const jId = asString(args.job_id) || "";
                    if (!jId) {
                      result = { success: false, error: "job_id is required" };
                    } else {
                      const { error: dErr } = await supabaseUser
                        .from("jobs")
                        .delete()
                        .eq("id", jId);
                      result = dErr
                        ? { success: false, error: dErr.message }
                        : { success: true, job_id: jId, deleted: true };
                    }
                  } else if (fn.name === "clear_all_jobs") {
                    const { error: cErr } = await supabaseUser
                      .from("jobs")
                      .delete()
                      .eq("user_id", userId);
                    result = cErr
                      ? { success: false, error: cErr.message }
                      : { success: true, cleared: true };
                  } else if (fn.name === "create_reminder") {
                    const company = asString(args.company) || "Target Company";
                    const role = asString(args.role) || "Target role";
                    const message = asString(args.message) || `Follow up with ${company} regarding the ${role} application.`;
                    const dueInDays = asNumber(args.due_in_days) ?? 3;

                    const reminderDate = new Date();
                    reminderDate.setDate(reminderDate.getDate() + dueInDays);

                    const { data, error: bErr } = await serviceClient
                      .from("notifications")
                      .insert({
                        user_id: userId,
                        type: "application",
                        title: `Follow-up reminder: ${company}`,
                        message: message,
                        company: company,
                        priority: "medium",
                        created_at: reminderDate.toISOString(),
                      })
                      .select("*")
                      .single();

                    result = bErr
                      ? { success: false, error: bErr.message }
                      : {
                          success: true,
                          reminder: data,
                          message: `Follow-up reminder scheduled for ${company} on ${reminderDate.toLocaleDateString()}.`
                        };
                  } else if (fn.name === "analyze_resume") {
                    const artifacts = await resolveAutoApplyArtifacts(serviceClient, userId);
                    const resumeText =
                      asString(args.resume_text) ||
                      asString(args.resumeText) ||
                      artifacts.resumeText;
                    const profileSummary =
                      asString(args.profile_summary) ||
                      asString(args.profileSummary) ||
                      artifacts.profileSnapshot ||
                      "";

                    if (!resumeText || !profileSummary) {
                      result = {
                        success: false,
                        error:
                          "Resume analysis needs a parsed resume and profile summary. Upload or parse a resume first, then try again.",
                        missing_resume_context: true,
                      };
                    } else {
                      result = await invokeEdgeFunctionByName({
                        authHeader: authHeader!,
                        name: "analyze-resume",
                        payload: {
                          resumeText,
                          profileSummary,
                          resumeId: args.resume_id ?? args.resumeId ?? artifacts.preferredResume?.id,
                          targetRole:
                            args.target_role ?? args.targetRole ?? args.role ?? undefined,
                        },
                      });
                    }
                  } else if (fn.name === "evaluate_job_fit") {
                    const t = normalizeSubscriptionTier(subscriptionTier);
                    if (t === "Free") {
                      result = {
                        success: false,
                        error:
                          "AI job fit reports require Basics or higher. Upgrade at Billing to unlock full evaluation (blockers, confidence, interview angles).",
                        upgrade_required: true,
                        required_tier: "Basics",
                        billing_path: "/dashboard/billing",
                      };
                    } else {
                      const jd =
                        asString(args.job_description) ||
                        asString(args.jobDescription) ||
                        "";
                      result = await invokeEdgeFunctionByName({
                        authHeader: authHeader!,
                        name: "evaluate-job-fit",
                        payload: {
                          jobDescription: jd,
                          jobId: args.job_id ?? args.jobId,
                          jobTitle: args.job_title ?? args.jobTitle,
                          company: args.company,
                          profileSnapshot: args.profile_snapshot ?? args.profileSnapshot,
                          resumeText: args.resume_text ?? args.resumeText,
                        },
                      });
                    }
                  } else {
                    result = await invokeEdgeFunctionByName({
                      authHeader: authHeader!,
                      name: fn.name.replace(/_/g, "-"),
                      payload: args,
                    });
                  }
                } catch (e: any) {
                  result = { success: false, error: e?.message || "Tool execution failed" };
                }

                if (isRecord(result) && result.success === false) {
                  failedToolCount += 1;
                }

                completedToolResults.push({ name: fn.name, args, result });
                toolResults.push({ functionResponse: { name: fn.name, response: result } });
                await enqueueEvent("tool_call", {
                  id: toolCallId,
                  name: fn.name,
                  args,
                  result,
                  round: toolRounds,
                  started_at: startedAt,
                  finished_at: Date.now(),
                });
              }
              if (failedToolCount > 0) {
                try {
                  await refundUserCredits({
                    serviceClient,
                    userId,
                    amount: failedToolCount,
                    description: `Refund: ${failedToolCount} AI agent tool${failedToolCount === 1 ? "" : "s"} did not complete`,
                    referenceType: "refund",
                    metadata: {
                      refund_key: `${turnRefundKey}:tools:${toolRounds}`,
                      source: "ai_chat_agent",
                      reason: "tool_result_failed",
                      round: toolRounds,
                      failed_tool_count: failedToolCount,
                      charged_tool_count: functionCalls.length,
                    },
                  });
                  await enqueueEvent("agent_surcharge_refund", {
                    credits_refunded: failedToolCount,
                    round: toolRounds,
                    reason: "tool_result_failed",
                  });
                } catch (refundError) {
                  console.error("AI chat tool surcharge refund failed:", refundError);
                }
              }
              await enqueueEvent("agent_activity", {
                kind: "tool_result",
                status: "done",
                title: "Returned tool results to the model",
                detail: "Reviewing the results and deciding whether another step is needed.",
                created_at: Date.now(),
                round: toolRounds,
                tool_count: functionCalls.length,
              });
              response = await streamAgentModelStep({
                chat,
                message: { role: "user", parts: toolResults },
                round: toolRounds,
                enqueueEvent,
              });
            }

            if (
              toolRounds > 0 &&
              !streamedFinalAssistantText &&
              !agentStoppedForBilling
            ) {
              await enqueueEvent("message", {
                delta: `\n\n${summarizeAgentToolResults(completedToolResults)}`,
              });
            }
          } else {
            // Non-agent (ask) mode with model fallback
            let streamSuccess = false;
            for (let mi = 0; mi < fallbackModels.length; mi++) {
              const askModel = fallbackModels[mi];
              try {
                if (mi > 0) {
                  console.warn(`[ai-chat ask] Falling back to ${askModel}`);
                }
                const chat = genAI.chats.create({
                  model: askModel,
                  config: chatConfig,
                  history,
                });
                const stream = await withGeminiRetry(() =>
                  chat.sendMessageStream({ message: lastUserParts }),
                );
                for await (const chunk of stream) {
                  const text = streamChunkText(chunk);
                  if (text) await enqueueEvent("message", { delta: text });
                }
                streamSuccess = true;
                break;
              } catch (e) {
                if (!isGeminiRateLimitError(e) || mi === fallbackModels.length - 1) {
                  throw e;
                }
              }
            }
          }
          await enqueueEvent("done", "[DONE]");
          controller.close();
        } catch (e: any) {
          console.error("Agent Loop Error:", e);
          await refundBaseChatTurn("AI chat response failed before completion", {
            error: e?.message || "Unknown stream error",
          });
          const userMessage = isGeminiRateLimitError(e)
            ? "Our AI service is temporarily busy across all models. Please try again in a minute."
            : e.message;
          await enqueueEvent("error", { error: userMessage });
          controller.close();
        }
        })();
      },
    });

    return new Response(streamBody, {
      headers: {
        ...cors,
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      }
    });

  } catch (error: any) {
    console.error("Outer Error:", error);
    return subscriptionErrorResponse(error, cors);
  }
});
