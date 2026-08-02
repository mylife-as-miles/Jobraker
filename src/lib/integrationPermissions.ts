import { SupabaseClient } from "@supabase/supabase-js";

export type PermissionScope = "allow_always" | "allow_once" | "deny";

export type IntegrationInfo = {
  slug: string;
  name: string;
  tools: string[];
};

export const KNOWN_INTEGRATIONS: Record<string, IntegrationInfo> = {
  gmail: {
    slug: "gmail",
    name: "Gmail",
    tools: [
      "search_gmail_job_emails",
      "create_gmail_job_draft",
      "send_gmail_job_email",
      "label_gmail_job_emails",
      "sync_gmail_application_events",
    ],
  },
  github: {
    slug: "github",
    name: "GitHub",
    tools: ["github"],
  },
  googledrive: {
    slug: "googledrive",
    name: "Google Drive",
    tools: ["googledrive"],
  },
  googledocs: {
    slug: "googledocs",
    name: "Google Docs",
    tools: ["googledocs"],
  },
  googlecalendar: {
    slug: "googlecalendar",
    name: "Google Calendar",
    tools: ["googlecalendar"],
  },
  cal: {
    slug: "cal",
    name: "Cal.com",
    tools: ["cal"],
  },
  reddit: {
    slug: "reddit",
    name: "Reddit",
    tools: ["reddit"],
  },
  hackernews: {
    slug: "hackernews",
    name: "Hacker News",
    tools: ["hackernews"],
  },
  notion: {
    slug: "notion",
    name: "Notion",
    tools: ["notion"],
  },
  linkedin: {
    slug: "linkedin",
    name: "LinkedIn",
    tools: ["linkedin"],
  },
};

/**
 * Given a tool name or Composio tool slug, resolves the matching integration metadata.
 */
export function resolveIntegrationFromTool(
  toolName: string,
  args?: Record<string, unknown>,
): IntegrationInfo | null {
  const name = toolName.toLowerCase();
  
  if (name.includes("gmail")) {
    return KNOWN_INTEGRATIONS.gmail;
  }

  const composioSlug = typeof args?.tool_slug === "string" ? args.tool_slug.toLowerCase() : "";
  const target = composioSlug || name;

  for (const [key, info] of Object.entries(KNOWN_INTEGRATIONS)) {
    if (key === "gmail") continue;
    if (target.startsWith(key)) {
      return info;
    }
  }

  return null;
}

const LOCAL_STORAGE_PERMISSIONS_KEY = "jobraker_integration_permissions_v1";

export function getLocalPermissions(): Record<string, PermissionScope> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PERMISSIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setLocalPermission(slug: string, scope: PermissionScope) {
  try {
    const current = getLocalPermissions();
    if (scope === "allow_always") {
      current[slug] = "allow_always";
    } else {
      delete current[slug];
    }
    localStorage.setItem(LOCAL_STORAGE_PERMISSIONS_KEY, JSON.stringify(current));
  } catch (e) {
    console.error("Failed to save local integration permission:", e);
  }
}

export async function fetchUserPermissions(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<string, PermissionScope>> {
  const local = getLocalPermissions();
  try {
    const { data, error } = await supabase
      .from("user_integration_permissions")
      .select("integration_slug, permission_scope")
      .eq("user_id", userId);

    if (error || !data) return local;

    const remote: Record<string, PermissionScope> = { ...local };
    data.forEach((row) => {
      remote[row.integration_slug] = row.permission_scope as PermissionScope;
    });
    return remote;
  } catch {
    return local;
  }
}

export async function saveUserPermission(
  supabase: SupabaseClient,
  userId: string,
  integrationSlug: string,
  scope: PermissionScope,
) {
  setLocalPermission(integrationSlug, scope);

  if (scope === "allow_always") {
    try {
      await supabase.from("user_integration_permissions").upsert(
        {
          user_id: userId,
          integration_slug: integrationSlug,
          permission_scope: "allow_always",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id, integration_slug" },
      );
    } catch (e) {
      console.warn("Failed to persist permission to database:", e);
    }
  }
}
