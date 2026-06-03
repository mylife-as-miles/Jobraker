export type AppPageArea =
  | "public"
  | "auth"
  | "dashboard"
  | "settings"
  | "builder"
  | "admin";

export interface AppPageDefinition {
  id: string;
  title: string;
  route: string;
  area: AppPageArea;
  description: string;
  aliases?: string[];
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
  notes?: string[];
}

export const APP_PAGES: AppPageDefinition[] = [
  {
    id: "landing",
    title: "Landing Page",
    route: "/",
    area: "public",
    description: "Public marketing home page and primary entry point into JobRaker.",
    aliases: ["home", "homepage", "root"],
  },
  {
    id: "signup",
    title: "Sign Up",
    route: "/signup",
    area: "auth",
    description: "Account creation screen for new users.",
    aliases: ["register", "join", "create account"],
  },
  {
    id: "signin",
    title: "Sign In",
    route: "/signIn",
    area: "auth",
    description: "Authentication screen for returning users.",
    aliases: ["login", "log in", "sign in"],
  },
  {
    id: "onboarding",
    title: "Onboarding",
    route: "/onboarding",
    area: "auth",
    description: "Guided setup for profile, resume, and initial job-search preferences.",
    requiresAuth: true,
    aliases: ["setup", "getting started"],
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    route: "/privacy",
    area: "public",
    description: "Public privacy policy and data handling information.",
  },
  {
    id: "public-resume",
    title: "Public Resume",
    route: "/r/:id",
    area: "public",
    description: "Publicly shareable resume route for a specific resume id.",
    aliases: ["shared resume", "resume share page"],
    notes: ["Requires a concrete public resume id to open a specific resume."],
  },
  {
    id: "public-profile",
    title: "Public Profile Portfolio",
    route: "/u/:slug",
    area: "public",
    description: "Publicly shareable recruiter-facing portfolio page generated from the user's JobRaker profile.",
    aliases: ["public profile", "portfolio link", "profile share page", "shared profile"],
    notes: ["Requires a concrete public profile slug to open a specific portfolio."],
  },
  {
    id: "gmail-callback",
    title: "Gmail Callback",
    route: "/auth/callback/gmail",
    area: "auth",
    description: "OAuth callback page for Gmail integration setup.",
  },
  {
    id: "dashboard-overview",
    title: "Dashboard Overview",
    route: "/dashboard/overview",
    area: "dashboard",
    description: "Main dashboard with top-line metrics, recent activity, and quick actions.",
    requiresAuth: true,
    aliases: ["dashboard", "overview", "dashboard home"],
  },
  {
    id: "dashboard-chat",
    title: "AI Chat",
    route: "/dashboard/chat",
    area: "dashboard",
    description: "Ask mode and Agent mode chat workspace for job-search assistance.",
    requiresAuth: true,
    aliases: ["chat", "assistant", "ai chat"],
  },
  {
    id: "dashboard-jobs",
    title: "Jobs",
    route: "/dashboard/jobs",
    area: "dashboard",
    description: "Tracked jobs, search results, evaluation actions, and auto-apply launch point.",
    requiresAuth: true,
    aliases: ["job queue", "job list", "job search"],
  },
  {
    id: "dashboard-jobs-auto-apply",
    title: "Jobs Auto Apply Flow",
    route: "/dashboard/jobs?autoApplyJobId=:jobId",
    area: "dashboard",
    description: "Deep link that opens the Jobs auto-apply flow for a queued job.",
    requiresAuth: true,
    aliases: ["auto apply modal", "continue auto apply"],
    notes: ["Requires a real queued job id in the autoApplyJobId query parameter."],
  },
  {
    id: "dashboard-application",
    title: "Application Tracker",
    route: "/dashboard/application",
    area: "dashboard",
    description: "Kanban, list, calendar, and status tracking for application pipelines.",
    requiresAuth: true,
    aliases: ["applications", "application", "pipeline"],
  },
  {
    id: "dashboard-analytics",
    title: "Analytics",
    route: "/dashboard/analytics",
    area: "dashboard",
    description: "Job search performance analytics, funnel insights, and match-score trends.",
    requiresAuth: true,
    aliases: ["stats", "insights", "performance"],
  },
  {
    id: "dashboard-resume-home",
    title: "Resume Home",
    route: "/dashboard/resume",
    area: "dashboard",
    description: "Resume library and resume management home.",
    requiresAuth: true,
    aliases: ["resume", "resumes", "resume library"],
  },
  {
    id: "dashboard-resume-builder",
    title: "Resume Builder",
    route: "/dashboard/resume/edit/:id",
    area: "builder",
    description: "Resume editor for building or editing a specific resume.",
    requiresAuth: true,
    aliases: ["resume editor", "edit resume", "resume builder"],
    notes: ["Requires a resume id to open a specific existing resume."],
  },
  {
    id: "dashboard-cover-letter-home",
    title: "Cover Letter Home",
    route: "/dashboard/cover-letter",
    area: "dashboard",
    description: "Cover letter library and management home.",
    requiresAuth: true,
    aliases: ["cover letter", "cover letters", "cover letter library"],
  },
  {
    id: "dashboard-cover-letter-create",
    title: "Cover Letter Create",
    route: "/dashboard/cover-letter/create",
    area: "builder",
    description: "Builder route for creating a new cover letter.",
    requiresAuth: true,
    aliases: ["new cover letter", "create cover letter"],
  },
  {
    id: "dashboard-cover-letter-builder",
    title: "Cover Letter Builder",
    route: "/dashboard/cover-letter/edit/:id",
    area: "builder",
    description: "Editor for updating an existing cover letter.",
    requiresAuth: true,
    aliases: ["edit cover letter", "cover letter editor"],
    notes: ["Requires a cover letter id to open a specific existing cover letter."],
  },
  {
    id: "dashboard-referrals",
    title: "Referrals",
    route: "/dashboard/referrals",
    area: "dashboard",
    description: "Referral tracking, referral attribution, and related rewards.",
    requiresAuth: true,
    aliases: ["referral", "referral page"],
  },
  {
    id: "dashboard-notifications",
    title: "Notifications",
    route: "/dashboard/notifications",
    area: "dashboard",
    description: "Notification center for job matches, interviews, and system events.",
    requiresAuth: true,
    aliases: ["alerts", "notification center"],
  },
  {
    id: "dashboard-profile",
    title: "Profile",
    route: "/dashboard/profile",
    area: "dashboard",
    description: "Candidate profile, work history, skills, and readiness settings.",
    requiresAuth: true,
    aliases: ["candidate profile", "user profile"],
  },
  {
    id: "dashboard-billing",
    title: "Billing",
    route: "/dashboard/billing",
    area: "dashboard",
    description: "Subscription, credits, and billing management.",
    requiresAuth: true,
    aliases: ["pricing", "plan", "subscription", "credits"],
  },
  {
    id: "dashboard-settings-profile",
    title: "Settings Profile",
    route: "/dashboard/settings/profile",
    area: "settings",
    description: "Profile settings tab inside Settings.",
    requiresAuth: true,
    aliases: ["settings", "settings profile"],
  },
  {
    id: "dashboard-settings-notifications",
    title: "Settings Notifications",
    route: "/dashboard/settings/notifications",
    area: "settings",
    description: "Notification preferences tab inside Settings.",
    requiresAuth: true,
    aliases: ["notification settings"],
  },
  {
    id: "dashboard-settings-security",
    title: "Settings Security",
    route: "/dashboard/settings/security",
    area: "settings",
    description: "Security settings, sessions, API keys, and 2FA controls.",
    requiresAuth: true,
    aliases: ["security settings", "2fa", "sessions", "api keys"],
  },
  {
    id: "dashboard-settings-appearance",
    title: "Settings Appearance",
    route: "/dashboard/settings/appearance",
    area: "settings",
    description: "Theme and visual preference settings.",
    requiresAuth: true,
    aliases: ["appearance settings", "theme settings"],
  },
  {
    id: "dashboard-settings-privacy",
    title: "Settings Privacy",
    route: "/dashboard/settings/privacy",
    area: "settings",
    description: "Privacy controls, consent, deletion requests, and audit history.",
    requiresAuth: true,
    aliases: ["privacy settings", "gdpr"],
  },
  {
    id: "dashboard-settings-job-sources",
    title: "Settings Job Sources",
    route: "/dashboard/settings/job-sources",
    area: "settings",
    description: "Job-source settings, enabled domains, and source credentials.",
    requiresAuth: true,
    aliases: ["job source settings", "source credentials"],
  },
  {
    id: "dashboard-settings-integrations",
    title: "Settings Integrations",
    route: "/dashboard/settings/integrations",
    area: "settings",
    description: "External integrations such as Gmail connection status and actions.",
    requiresAuth: true,
    aliases: ["integrations", "gmail settings", "gmail integration"],
  },
  {
    id: "dashboard-settings-billing",
    title: "Settings Billing",
    route: "/dashboard/settings/billing",
    area: "settings",
    description: "Billing tab inside Settings for plan and payment controls.",
    requiresAuth: true,
    aliases: ["billing settings"],
  },
  {
    id: "dashboard-interview-studio",
    title: "Interview Studio",
    route: "/dashboard/interview-studio",
    area: "dashboard",
    description: "Interview practice and interview-session tools.",
    requiresAuth: true,
    requiresAdmin: true,
    aliases: ["interview studio", "mock interview"],
    notes: ["Currently restricted behind admin access in the dashboard shell."],
  },
  {
    id: "admin-overview",
    title: "Admin Overview",
    route: "/admin",
    area: "admin",
    description: "Admin dashboard home.",
    requiresAuth: true,
    requiresAdmin: true,
    aliases: ["admin", "admin home"],
  },
  {
    id: "admin-users",
    title: "Admin Users",
    route: "/admin/users",
    area: "admin",
    description: "Admin user management.",
    requiresAuth: true,
    requiresAdmin: true,
  },
  {
    id: "admin-subscriptions",
    title: "Admin Subscriptions",
    route: "/admin/subscriptions",
    area: "admin",
    description: "Admin subscription management and visibility.",
    requiresAuth: true,
    requiresAdmin: true,
  },
  {
    id: "admin-revenue",
    title: "Admin Revenue",
    route: "/admin/revenue",
    area: "admin",
    description: "Admin revenue reporting.",
    requiresAuth: true,
    requiresAdmin: true,
  },
  {
    id: "admin-credits",
    title: "Admin Credits",
    route: "/admin/credits",
    area: "admin",
    description: "Admin credit balance and credit operations page.",
    requiresAuth: true,
    requiresAdmin: true,
  },
  {
    id: "admin-provider-credits",
    title: "Admin Provider Credits",
    route: "/admin/provider-credits",
    area: "admin",
    description: "Admin provider-credit tracking for services like Firecrawl and Skyvern.",
    requiresAuth: true,
    requiresAdmin: true,
  },
  {
    id: "admin-activity",
    title: "Admin Activity",
    route: "/admin/activity",
    area: "admin",
    description: "Admin activity feed and operational visibility.",
    requiresAuth: true,
    requiresAdmin: true,
  },
  {
    id: "admin-database",
    title: "Admin Database",
    route: "/admin/database",
    area: "admin",
    description: "Admin database inspection page.",
    requiresAuth: true,
    requiresAdmin: true,
  },
  {
    id: "admin-performance",
    title: "Admin Performance",
    route: "/admin/performance",
    area: "admin",
    description: "Admin performance and system health page.",
    requiresAuth: true,
    requiresAdmin: true,
  },
  {
    id: "admin-settings",
    title: "Admin Settings",
    route: "/admin/settings",
    area: "admin",
    description: "Admin settings and operational controls.",
    requiresAuth: true,
    requiresAdmin: true,
  },
  {
    id: "admin-check-credits-legacy",
    title: "Admin Credit Checker (Legacy)",
    route: "/admin/check-credits-old",
    area: "admin",
    description: "Legacy admin credit lookup utility.",
    requiresAuth: true,
    requiresAdmin: true,
    aliases: ["old credit checker", "legacy credit checker"],
  },
];

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ");
}

function routePrefix(route: string): string {
  return route.split("/:")[0]?.split("?")[0] || route;
}

export function resolveAppPage(input: {
  pageId?: string | null;
  route?: string | null;
  query?: string | null;
}): AppPageDefinition | null {
  const pageId = input.pageId ? normalizeText(input.pageId) : "";
  const route = input.route?.trim() || "";
  const query = input.query ? normalizeText(input.query) : "";

  if (pageId) {
    const byId = APP_PAGES.find((page) => normalizeText(page.id) === pageId);
    if (byId) return byId;
  }

  if (route) {
    const byExactRoute = APP_PAGES.find((page) => page.route === route);
    if (byExactRoute) return byExactRoute;

    const byPrefix = APP_PAGES.find((page) => {
      const prefix = routePrefix(page.route);
      return prefix && route.startsWith(prefix);
    });
    if (byPrefix) return byPrefix;
  }

  if (query) {
    const byAlias = APP_PAGES.find((page) => {
      const haystack = [
        page.id,
        page.title,
        page.route,
        ...(page.aliases || []),
      ].map(normalizeText);
      return haystack.some((item) => item === query || item.includes(query) || query.includes(item));
    });
    if (byAlias) return byAlias;
  }

  return null;
}

export function buildAppInterfaceGuide(): string {
  const order: AppPageArea[] = ["public", "auth", "dashboard", "settings", "builder", "admin"];
  const labels: Record<AppPageArea, string> = {
    public: "Public Pages",
    auth: "Auth Pages",
    dashboard: "Dashboard Pages",
    settings: "Settings Tabs",
    builder: "Builder Pages",
    admin: "Admin Pages",
  };

  const lines = [
    "## Full Application Navigation Map",
    "You are embedded within JobRaker. Treat the following routes as the current source of truth for where features live.",
  ];

  for (const area of order) {
    const pages = APP_PAGES.filter((page) => page.area === area);
    if (pages.length === 0) continue;
    lines.push(`\n### ${labels[area]}`);
    for (const page of pages) {
      const flags = [
        page.requiresAuth ? "auth" : null,
        page.requiresAdmin ? "admin" : null,
      ].filter(Boolean);
      const flagSuffix = flags.length ? ` [${flags.join(", ")}]` : "";
      lines.push(`- ${page.title} (${page.route})${flagSuffix}: ${page.description}`);
      if (page.notes?.length) {
        for (const note of page.notes) {
          lines.push(`  Note: ${note}`);
        }
      }
    }
  }

  lines.push(
    "\nWhen the user wants to move around the app, prefer the page registry and page tools over guessing route names.",
  );

  return lines.join("\n");
}
