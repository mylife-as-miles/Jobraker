type NotificationType =
  | "interview"
  | "application"
  | "system"
  | "company"
  | "job_search"
  | "credit";

type NotificationSource =
  | "system"
  | "gmail"
  | "automation"
  | "application"
  | "job_search"
  | "billing";

type NotificationPriority = "low" | "medium" | "high";

type NotificationSettingsRow = {
  notify_interviews?: boolean | null;
  notify_applications?: boolean | null;
  notify_system?: boolean | null;
  notify_company_updates?: boolean | null;
  notify_job_search?: boolean | null;
  notify_credit_updates?: boolean | null;
  notify_gmail_updates?: boolean | null;
};

type CreateNotificationRecordInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string | null;
  company?: string | null;
  priority?: NotificationPriority;
  source?: NotificationSource;
  sourceRecordId?: string | null;
  sourceRecordType?: string | null;
  actionUrl?: string | null;
  actionLabel?: string | null;
  metadata?: Record<string, unknown> | null;
  dedupeKey?: string | null;
};

const SETTINGS_CACHE_TTL_MS = 30_000;
const settingsCache = new Map<string, {
  expiresAt: number;
  value: NotificationSettingsRow;
}>();

function defaultSourceForType(type: NotificationType): NotificationSource {
  switch (type) {
    case "credit":
      return "billing";
    case "job_search":
    case "company":
      return "job_search";
    case "application":
    case "interview":
      return "application";
    default:
      return "system";
  }
}

function shouldCreateNotification(
  settings: NotificationSettingsRow,
  input: CreateNotificationRecordInput,
) {
  if (input.source === "gmail" && settings.notify_gmail_updates === false) {
    return false;
  }

  switch (input.type) {
    case "interview":
      return settings.notify_interviews !== false;
    case "application":
      return settings.notify_applications !== false;
    case "system":
      return settings.notify_system !== false;
    case "company":
      return settings.notify_company_updates !== false;
    case "job_search":
      return settings.notify_job_search !== false;
    case "credit":
      return settings.notify_credit_updates !== false;
    default:
      return true;
  }
}

async function getNotificationSettings(serviceClient: any, userId: string) {
  const cached = settingsCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const { data, error } = await serviceClient
    .from("notification_settings")
    .select([
      "notify_interviews",
      "notify_applications",
      "notify_system",
      "notify_company_updates",
      "notify_job_search",
      "notify_credit_updates",
      "notify_gmail_updates",
    ].join(","))
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("notification-center: failed to load settings", error);
  }

  const value = (data || {}) as NotificationSettingsRow;
  settingsCache.set(userId, {
    expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS,
    value,
  });
  return value;
}

export async function createNotificationRecord(
  serviceClient: any,
  input: CreateNotificationRecordInput,
) {
  const settings = await getNotificationSettings(serviceClient, input.userId);
  if (!shouldCreateNotification(settings, input)) {
    return { skipped: true, reason: "disabled_by_settings" as const };
  }

  const payload = {
    user_id: input.userId,
    type: input.type,
    title: input.title.slice(0, 200),
    message: input.message?.slice(0, 2000) ?? null,
    company: input.company?.slice(0, 120) ?? null,
    priority: input.priority ?? "medium",
    source: input.source ?? defaultSourceForType(input.type),
    source_record_id: input.sourceRecordId ?? null,
    source_record_type: input.sourceRecordType ?? null,
    action_url: input.actionUrl ?? null,
    action_label: input.actionLabel?.slice(0, 80) ?? null,
    metadata: input.metadata ?? {},
    dedupe_key: input.dedupeKey ?? null,
  };

  const { data, error } = await serviceClient
    .from("notifications")
    .insert(payload)
    .select("*")
    .maybeSingle();

  let insertedData = data;
  let insertedError = error;

  if (
    insertedError &&
    /action_label|source_record_id|source_record_type|metadata|dedupe_key|source|archived_at/i.test(
      String(insertedError.message || ""),
    )
  ) {
    const legacyPayload = {
      user_id: input.userId,
      type: input.type,
      title: input.title.slice(0, 200),
      message: input.message?.slice(0, 2000) ?? null,
      company: input.company?.slice(0, 120) ?? null,
      priority: input.priority ?? "medium",
      action_url: input.actionUrl ?? null,
    };
    const fallback = await serviceClient
      .from("notifications")
      .insert(legacyPayload)
      .select("*")
      .maybeSingle();
    insertedData = fallback.data;
    insertedError = fallback.error;
  }

  if (insertedError) {
    if (insertedError.code === "23505") {
      return { skipped: true, reason: "duplicate" as const };
    }
    throw insertedError;
  }

  return { skipped: false, notification: insertedData };
}

export function clearNotificationSettingsCache(userId?: string) {
  if (userId) {
    settingsCache.delete(userId);
    return;
  }
  settingsCache.clear();
}
