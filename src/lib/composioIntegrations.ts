import {
  Calendar,
  Database,
  FileText,
  Github,
  Globe,
  Linkedin,
  Mail,
  type LucideIcon,
} from "lucide-react";
import type { ComposioConnectionState } from "@/lib/composioConnection";

export type ComposioIntegrationSlug =
  | "gmail"
  | "github"
  | "googledrive"
  | "googledocs"
  | "cal"
  | "reddit"
  | "notion"
  | "googlecalendar"
  | "linkedin";

export type IntegrationCategory =
  | "communication"
  | "scheduling"
  | "documents"
  | "profile"
  | "research";

export type ComposioIntegration = {
  slug: ComposioIntegrationSlug;
  toolkitSlug: string;
  name: string;
  description: string;
  /** What Agent Mode can actually do once this is connected. */
  capabilities: string[];
  category: IntegrationCategory;
  authConfigId?: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon tile; keeps each provider recognisable. */
  accentClass: string;
  iconClass: string;
  /** Gated behind an active paid subscription. */
  requiresEmailAccess?: boolean;
};

export const INTEGRATION_CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  communication: "Email",
  scheduling: "Scheduling",
  documents: "Documents & storage",
  profile: "Profile & portfolio",
  research: "Research",
};

export const INTEGRATION_CATEGORY_ORDER: IntegrationCategory[] = [
  "communication",
  "documents",
  "profile",
  "scheduling",
  "research",
];

export const COMPOSIO_INTEGRATIONS: ComposioIntegration[] = [
  {
    slug: "gmail",
    toolkitSlug: "gmail",
    name: "Gmail",
    description:
      "Let Agent Mode read application replies and draft follow-ups from your inbox.",
    capabilities: ["Track replies", "Draft follow-ups", "Inbox notifications"],
    category: "communication",
    authConfigId: import.meta.env.VITE_COMPOSIO_GMAIL_CONFIG_ID,
    icon: Mail,
    accentClass: "from-brand/20 to-brand/5 border-brand/30",
    iconClass: "text-brand",
    requiresEmailAccess: true,
  },
  {
    slug: "github",
    toolkitSlug: "github",
    name: "GitHub",
    description:
      "Pull project evidence, repos, languages, and portfolio signals into Agent Mode.",
    capabilities: ["Repo evidence", "Language signals", "Portfolio proof"],
    category: "profile",
    authConfigId: import.meta.env.VITE_COMPOSIO_GITHUB_CONFIG_ID,
    icon: Github,
    accentClass: "from-zinc-500/20 to-zinc-500/5 border-zinc-500/30",
    iconClass: "text-foreground/80",
    requiresEmailAccess: true,
  },
  {
    slug: "linkedin",
    toolkitSlug: "linkedin",
    name: "LinkedIn",
    description:
      "Enrich profile context, recruiter signals, and job-search identity.",
    capabilities: ["Profile context", "Recruiter signals"],
    category: "profile",
    authConfigId: import.meta.env.VITE_COMPOSIO_LINKEDIN_CONFIG_ID,
    icon: Linkedin,
    accentClass: "from-blue-500/20 to-blue-500/5 border-blue-500/30",
    iconClass: "text-blue-400",
    requiresEmailAccess: true,
  },
  {
    slug: "googledrive",
    toolkitSlug: "googledrive",
    name: "Google Drive",
    description: "Import resumes, portfolios, certificates, and career documents.",
    capabilities: ["Import resumes", "Attach certificates"],
    category: "documents",
    authConfigId: import.meta.env.VITE_COMPOSIO_GOOGLEDRIVE_CONFIG_ID,
    icon: Database,
    accentClass: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
    iconClass: "text-emerald-300",
    requiresEmailAccess: true,
  },
  {
    slug: "googledocs",
    toolkitSlug: "googledocs",
    name: "Google Docs",
    description:
      "Let Agent Mode draft, revise, and update resume and cover-letter documents.",
    capabilities: ["Draft resumes", "Revise cover letters"],
    category: "documents",
    authConfigId: import.meta.env.VITE_COMPOSIO_GOOGLEDOCS_CONFIG_ID,
    icon: FileText,
    accentClass: "from-sky-500/20 to-sky-500/5 border-sky-500/30",
    iconClass: "text-sky-300",
    requiresEmailAccess: true,
  },
  {
    slug: "notion",
    toolkitSlug: "notion",
    name: "Notion",
    description:
      "Use brag docs, case studies, notes, and project writeups as candidate context.",
    capabilities: ["Brag docs", "Case studies"],
    category: "documents",
    authConfigId: import.meta.env.VITE_COMPOSIO_NOTION_CONFIG_ID,
    icon: Database,
    accentClass: "from-stone-500/20 to-stone-500/5 border-stone-500/30",
    iconClass: "text-foreground/80",
    requiresEmailAccess: true,
  },
  {
    slug: "googlecalendar",
    toolkitSlug: "googlecalendar",
    name: "Google Calendar",
    description:
      "Schedule interviews, prep reminders, and follow-up events from chat.",
    capabilities: ["Interview events", "Prep reminders"],
    category: "scheduling",
    authConfigId: import.meta.env.VITE_COMPOSIO_GOOGLECALENDAR_CONFIG_ID,
    icon: Calendar,
    accentClass: "from-blue-500/20 to-blue-500/5 border-blue-500/30",
    iconClass: "text-blue-300",
    requiresEmailAccess: true,
  },
  {
    slug: "cal",
    toolkitSlug: "cal",
    name: "Cal.com",
    description: "Create scheduling workflows for interview booking and rescheduling.",
    capabilities: ["Booking links", "Rescheduling"],
    category: "scheduling",
    authConfigId: import.meta.env.VITE_COMPOSIO_CAL_CONFIG_ID,
    icon: Calendar,
    accentClass: "from-teal-500/20 to-teal-500/5 border-teal-500/30",
    iconClass: "text-teal-300",
    requiresEmailAccess: true,
  },
  {
    slug: "reddit",
    toolkitSlug: "reddit",
    name: "Reddit",
    description: "Find community hiring leads and niche job-search conversations.",
    capabilities: ["Hiring threads", "Community leads"],
    category: "research",
    authConfigId: import.meta.env.VITE_COMPOSIO_REDDIT_CONFIG_ID,
    icon: Globe,
    accentClass: "from-orange-500/20 to-orange-500/5 border-orange-500/30",
    iconClass: "text-orange-300",
    requiresEmailAccess: true,
  },
];

export const GMAIL_INTEGRATION = COMPOSIO_INTEGRATIONS.find(
  (integration) => integration.slug === "gmail",
)!;

export function getIntegration(
  slug: ComposioIntegrationSlug,
): ComposioIntegration | undefined {
  return COMPOSIO_INTEGRATIONS.find((integration) => integration.slug === slug);
}

/** Server-reported truth for one integration. */
export type IntegrationStatus = {
  state: ComposioConnectionState;
  connectionId: string | null;
  identifier: string | null;
};

/**
 * What a card is doing right now. Kept separate from {@link IntegrationStatus}
 * so an in-flight action is never confused with server state — that conflation
 * is why cards used to render "Connect" while already connected, and "Connected"
 * while the consent popup was still open.
 */
export type IntegrationActivity =
  | { phase: "idle" }
  | { phase: "connecting" }
  | { phase: "authorizing" }
  | { phase: "verifying" }
  | { phase: "disconnecting" };

/** Everything a card needs to render, collapsed into one discriminated value. */
export type IntegrationViewState =
  | "loading"
  | "connected"
  | "disconnected"
  | "pending"
  | "connecting"
  | "authorizing"
  | "verifying"
  | "disconnecting";

export function resolveViewState(options: {
  status: IntegrationStatus | undefined;
  activity: IntegrationActivity;
  hasLoaded: boolean;
}): IntegrationViewState {
  const { status, activity, hasLoaded } = options;

  if (activity.phase !== "idle") return activity.phase;
  if (!hasLoaded || !status) return "loading";
  if (status.state === "active") return "connected";
  if (status.state === "pending") return "pending";
  return "disconnected";
}

export const INTEGRATION_STATE_COPY: Record<
  IntegrationViewState,
  { label: string; hint?: string }
> = {
  loading: { label: "Checking…" },
  connected: { label: "Connected" },
  disconnected: { label: "Not connected" },
  pending: {
    label: "Authorization incomplete",
    hint: "You started connecting but never finished. Reconnect to complete it, or cancel to clear it.",
  },
  connecting: { label: "Opening authorization…" },
  authorizing: {
    label: "Waiting for authorization",
    hint: "Finish the steps in the provider window. This card updates automatically.",
  },
  verifying: { label: "Verifying connection…" },
  disconnecting: { label: "Disconnecting…" },
};
