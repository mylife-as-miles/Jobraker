// Central helper for creating notification records.
// Keeps all inserts in one place to allow future enrichment (dedupe, batching, analytics).
import { createClient } from '../lib/supabaseClient';
import type { NotificationType } from '../hooks/useNotifications';

export interface CreateNotificationInput {
  user_id: string;
  type: NotificationType;
  title: string;
  message?: string | null;
  company?: string | null;
  action_url?: string | null;
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
    ? settings.quiet_hours_start.split(':').map(Number).reduce((h, m) => h * 60 + m, 0)
    : 22 * 60; // 22:00 default
  const endTime = settings.quiet_hours_end
    ? settings.quiet_hours_end.split(':').map(Number).reduce((h, m) => h * 60 + m, 0)
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
    default:
      return true; // Default to allowing if type unknown
  }
}

export async function createNotification(input: CreateNotificationInput) {
  try {
    // Check notification settings before creating
    const settings = await getNotificationSettings(input.user_id);
    if (!shouldCreateNotification(settings, input.type)) {
      return null; // User has disabled this type of notification
    }

    const key = `${input.user_id}|${input.type}|${input.title}|${input.company ?? ''}`;
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
    } as const;
    const { data, error } = await (supabase as any)
      .from('notifications')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    // Optimistic local event so UI updates even if realtime channel is delayed/misconfigured
    if (typeof window !== 'undefined' && data) {
      window.dispatchEvent(new CustomEvent('notification:insert', { detail: data }));
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
    type: 'system',
    title: `${count} new ${context}`,
    message: `We found ${count} new ${context} just now.`,
  });
}
