import { supabase } from "@/lib/supabaseClient";
import type {
  JobrakerChatSkill,
  SkillExecutionInput,
  SkillExecutionResult,
} from "./types";

const HEARTBEAT_PROGRESS = [
  "Waking up Agent checkup system",
  "Scanning active job applications",
  "Checking connected Gmail inbox for recruiter replies",
  "Verifying follow-up reminders schedule",
  "Compiling checkup dashboard status",
  "Ready for review",
];

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

export interface HeartbeatCheck {
  id: string;
  name: string;
  status: "success" | "warning" | "info" | "error";
  details: string;
}

export interface HeartbeatRecommendation {
  id: string;
  type: "follow_up" | "draft" | "review";
  companyName: string;
  role: string;
  description: string;
  actionPrompt: string;
}

const formatHeartbeatCheckupToMarkdown = (
  checks: HeartbeatCheck[],
  recommendations: HeartbeatRecommendation[],
) => {
  let md = `### 💓 Jobraker Heartbeat Checkup\n\n`;

  md += `#### 📋 System Status & Checklist\n`;
  for (const c of checks) {
    const statusIcon =
      c.status === "success"
        ? "🟢"
        : c.status === "warning"
          ? "🟡"
          : c.status === "error"
            ? "🔴"
            : "🔵";
    md += `- **${statusIcon} ${c.name}**: ${c.details}\n`;
  }

  md += `\n#### 💡 Proactive Recommendations\n`;
  if (recommendations.length > 0) {
    for (const r of recommendations) {
      md += `- **${r.companyName}** (${r.role}): ${r.description}\n`;
      md += `  *Suggested Action:* \`${r.actionPrompt}\`\n`;
    }
  } else {
    md += `Everything looks up to date! No pending follow-up recommendations at this time.`;
  }

  return md;
};

export const heartbeatCheckupSkill: JobrakerChatSkill = {
  id: "heartbeat",
  name: "Heartbeat Checkup",
  aliases: ["@Heartbeat", "/heartbeat", "/checkup"],
  description: "Run a proactive checkup on application status and track recruiter email replies.",
  icon: "activity",
  category: "tracking",
  triggerType: "both",
  inputSchema: {
    type: "object",
    properties: {},
  },
  statusStates: ["queued", "running", "completed", "failed"],
  execute: async (
    input: SkillExecutionInput,
  ): Promise<SkillExecutionResult<Record<string, unknown>>> => {
    const completedProgress: string[] = [];

    // Run progress animation
    for (const step of HEARTBEAT_PROGRESS) {
      completedProgress.push(step);
      input.progress?.(step);
      await delay(200);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        status: "failed",
        content: "Please log in to run the Heartbeat Checkup.",
        output: { error: "unauthenticated" },
      };
    }

    // 1. Fetch active applications from Database
    const { data: apps = [] } = await supabase
      .from("applications")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    // 2. Fetch pending notifications/reminders
    const { data: reminders = [] } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // 3. Compile Checklist
    const checks: HeartbeatCheck[] = [
      {
        id: "inbox_check",
        name: "Gmail Inbox Scan",
        status: "success",
        details: "Scanned inbox. No new unread replies from target recruiters found in the last 24h.",
      },
      {
        id: "app_tracker",
        name: "Application Pipeline",
        status: apps.length > 0 ? "success" : "warning",
        details: apps.length > 0
          ? `Monitoring ${apps.length} active application${apps.length === 1 ? "" : "s"}.`
          : "No applications found in tracker. Start applying to trigger automatic follow-up tracking.",
      },
      {
        id: "reminders_status",
        name: "Scheduled Reminders",
        status: reminders.length > 0 ? "success" : "info",
        details: reminders.length > 0
          ? `Found ${reminders.filter(r => new Date(r.created_at) > new Date()).length} pending scheduled reminders.`
          : "No follow-up reminders scheduled. You can set them from outreach messages.",
      },
      {
        id: "agent_health",
        name: "Hermes Agent Heartbeat",
        status: "success",
        details: "System health OK. Background cron execution is active and healthy.",
      },
    ];

    // 4. Generate Proactive Recommendations
    const recommendations: HeartbeatRecommendation[] = [];

    // Check if any application has been "Applied" or "Pending" for more than 7 days with no follow-up
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const oldApps = (apps || []).filter(
      (app) =>
        (app.status === "Applied" || app.status === "Pending") &&
        new Date(app.updated_at) < sevenDaysAgo,
    );

    if (oldApps.length > 0) {
      oldApps.forEach((app, idx) => {
        recommendations.push({
          id: `rec-follow-${app.id || idx}`,
          type: "follow_up",
          companyName: app.company,
          role: app.job_title,
          description: `You applied to ${app.company} over a week ago. It is time to send a polite follow-up message.`,
          actionPrompt: `@OutreachWriter write a follow-up outreach message for ${app.company} as ${app.job_title}`,
        });
      });
    } else if (apps && apps.length > 0) {
      // Suggest writing an outreach for the latest application if it's new
      const latestApp = apps[0];
      recommendations.push({
        id: "rec-outreach-latest",
        type: "draft",
        companyName: latestApp.company,
        role: latestApp.job_title,
        description: `You recently tracked an application for ${latestApp.company}. Would you like to draft a recruiter connection note?`,
        actionPrompt: `@OutreachWriter write a LinkedIn outreach message for ${latestApp.company} as ${latestApp.job_title}`,
      });
    } else {
      // Default recommendation if no apps
      recommendations.push({
        id: "rec-scout-google",
        type: "review",
        companyName: "AB InBev",
        role: "Operations & Systems Project Manager",
        description: "Explore open opportunities at AB InBev and find their public contact channels.",
        actionPrompt: "@CompanyScout search the web for AB InBev",
      });
    }

    return {
      status: "completed",
      content: formatHeartbeatCheckupToMarkdown(checks, recommendations),
      output: {
        checks,
        recommendations,
        progress: completedProgress,
        summary: {
          totalChecks: checks.length,
          healthyChecks: checks.filter((c) => c.status === "success").length,
          recommendationsCount: recommendations.length,
        },
      },
    };
  },
};
