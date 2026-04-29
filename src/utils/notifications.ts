// Central helper for creating notification records.
// Keeps all inserts in one place to allow future enrichment (dedupe, batching, analytics).
import { createClient } from '../lib/supabaseClient';
import type { NotificationType } from '../hooks/useNotifications';

export type NotificationSource =
  | 'system'
  | 'gmail'
  | 'automation'
  | 'application'
  | 'job_search'
  | 'billing';

export interface CreateNotificationInput {
  user_id: string;
  type: NotificationType;
  title: string;
  message?: string | null;
  company?: string | null;
  action_url?: string | null;
  action_label?: string | null;
  priority?: 'low' | 'medium' | 'high';
  source?: NotificationSource;
  source_record_id?: string | null;
  source_record_type?: string | null;
  metadata?: Record<string, unknown> | null;
  dedupe_key?: string | null;
}

// Lightweight in-memory dedupe to avoid rapid duplicate inserts (e.g. same title+company within 10s)
const recentKeys = new Map<string, number>();
const DEDUPE_WINDOW_MS = 10_000;

// Cache for notification settings to avoid repeated queries
const settingsCache = new Map<string, { settings: any; timestamp: number }>();
const SETTINGS_CACHE_TTL = 60_000; // 1 minute

// Export function to clear cache when settings are updated
export function clearNotificationSettingsCache(userId?: string) {
  if (userId) {
    settingsCache.delete(userId);
  } else {
    settingsCache.clear();
  }
}

async function getNotificationSettings(userId: string) {
  const cached = settingsCache.get(userId);
  if (cached && Date.now() - cached.timestamp < SETTINGS_CACHE_TTL) {
    return cached.settings;
  }

  const supabase = createClient();
  const { data } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  
  const settings = data || {
    notify_interviews: true,
    notify_applications: true,
    notify_system: true,
    notify_company_updates: true,
    notify_job_search: true,
    notify_credit_updates: true,
    notify_gmail_updates: true,
    quiet_hours_enabled: false,
  };
  
  settingsCache.set(userId, { settings, timestamp: Date.now() });
  return settings;
}

function isInQuietHours(settings: any): boolean {
  if (!settings.quiet_hours_enabled) return false;
  
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes(); // minutes since midnight
  
  const startTime = settings.quiet_hours_start 
    ? settings.quiet_hours_start.split(':').map(Number).reduce((h: number, m: number) => h * 60 + m, 0)
    : 22 * 60; // 22:00 default
  const endTime = settings.quiet_hours_end
    ? settings.quiet_hours_end.split(':').map(Number).reduce((h: number, m: number) => h * 60 + m, 0)
    : 8 * 60; // 08:00 default
  
  // Handle overnight quiet hours (e.g., 22:00 to 08:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime < endTime;
  }
  return currentTime >= startTime && currentTime < endTime;
}

function shouldCreateNotification(settings: any, type: NotificationType): boolean {
  // Check quiet hours first
  if (isInQuietHours(settings)) {
    return false;
  }
  
  // Check type-specific settings
  switch (type) {
    case 'interview':
      return settings.notify_interviews !== false;
    case 'application':
      return settings.notify_applications !== false;
    case 'system':
      return settings.notify_system !== false;
    case 'company':
      return settings.notify_company_updates !== false;
    case 'job_search':
      return settings.notify_job_search !== false;
    case 'credit':
      return settings.notify_credit_updates !== false;
    default:
      return true; // Default to allowing if type unknown
  }
}

function defaultSourceForType(type: NotificationType): NotificationSource {
  switch (type) {
    case 'credit':
      return 'billing';
    case 'job_search':
    case 'company':
      return 'job_search';
    case 'application':
    case 'interview':
      return 'application';
    default:
      return 'system';
  }
}

export async function createNotification(input: CreateNotificationInput) {
  try {
    // Check notification settings before creating
    const settings = await getNotificationSettings(input.user_id);
    const source = input.source || defaultSourceForType(input.type);
    if (source === 'gmail' && settings.notify_gmail_updates === false) {
      return null;
    }
    if (!shouldCreateNotification(settings, input.type)) {
      return null; // User has disabled this type of notification
    }

    const key = input.dedupe_key ||
      `${input.user_id}|${source}|${input.type}|${input.title}|${input.company ?? ''}`;
    const now = Date.now();
    for (const [k, ts] of [...recentKeys.entries()]) {
      if (now - ts > DEDUPE_WINDOW_MS) recentKeys.delete(k);
    }
    if (recentKeys.has(key)) return null; // Skip duplicate burst
    recentKeys.set(key, now);

    const supabase = createClient();
    const payload = {
      user_id: input.user_id,
      type: input.type,
      title: input.title.slice(0, 200),
      message: input.message?.slice(0, 2000) ?? null,
      company: input.company?.slice(0, 120) ?? null,
      action_url: input.action_url ?? null,
      action_label: input.action_label ?? null,
      priority: input.priority ?? 'medium',
      source,
      source_record_id: input.source_record_id ?? null,
      source_record_type: input.source_record_type ?? null,
      metadata: input.metadata ?? {},
      dedupe_key: input.dedupe_key ?? null,
    } as const;
    let { data, error } = await (supabase as any)
      .from('notifications')
      .insert(payload)
      .select('*')
      .single();
    if (
      error &&
      /action_label|source_record_id|source_record_type|metadata|dedupe_key|source/i.test(
        String(error.message || ''),
      )
    ) {
      const legacyPayload = {
        user_id: input.user_id,
        type: input.type,
        title: input.title.slice(0, 200),
        message: input.message?.slice(0, 2000) ?? null,
        company: input.company?.slice(0, 120) ?? null,
        action_url: input.action_url ?? null,
      } as const;
      const fallback = await (supabase as any)
        .from('notifications')
        .insert(legacyPayload)
        .select('*')
        .single();
      data = fallback.data;
      error = fallback.error;
    }
    if (error) throw error;
    // Optimistic local event so UI updates even if realtime channel is delayed/misconfigured
    if (typeof window !== 'undefined' && data) {
      window.dispatchEvent(new CustomEvent('notification:insert', { detail: data }));
      
      // Trigger native browser notification if enabled and permitted
      if (settings.desktop_notifications && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(data.title, {
          body: data.message || '',
          icon: '/favicon.ico', // Fallback icon path
        });
      }
    }
    return data;
  } catch (e: any) {
    const msg = e?.message || String(e);
    // eslint-disable-next-line no-console
    console.warn('[notifications] create failed', msg, e);
    if (/policy|rls|row level/i.test(msg)) {
      console.warn('[notifications] RLS policy rejection. Ensure user is authenticated and user_id matches auth.uid().');
    }
    return null;
  }
}

export async function createBulkSummaryNotification(userId: string, count: number, context: string) {
  if (count <= 0) return;
  await createNotification({
    user_id: userId,
    type: 'job_search',
    title: `${count} new ${context}`,
    message: `We found ${count} new ${context} just now.`,
    source: 'job_search',
    priority: count >= 10 ? 'high' : 'medium',
    action_url: '/dashboard/jobs',
    action_label: 'Review jobs',
    dedupe_key: `bulk-summary:${userId}:${context}:${new Date().toISOString().slice(0, 10)}:${count}`,
  });
}
