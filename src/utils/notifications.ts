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

export async function createNotification(input: CreateNotificationInput) {
  try {
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
