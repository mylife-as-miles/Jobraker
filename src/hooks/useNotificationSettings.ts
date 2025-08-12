import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabaseClient";
import { useToast } from "../components/ui/toast";

export interface NotificationSettings {
  id: string;
  email_notifications: boolean;
  push_notifications: boolean;
  job_alerts: boolean;
  application_updates: boolean;
  weekly_digest: boolean;
  marketing_emails: boolean;
  updated_at: string;
}

export function useNotificationSettings() {
  const supabase = useMemo(() => createClient(), []);
  const { success, error: toastError } = useToast();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const uid = (data as any)?.user?.id ?? null;
        if (mounted) setUserId(uid);
      } catch {
        if (mounted) setUserId(null);
      }
    })();
    return () => { mounted = false; };
  }, [supabase]);

  // Fetch notification settings
  const fetchSettings = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("id", userId)
        .single();
      if (error) throw error;
      setSettings(data);
    } catch (e: any) {
      setError(e.message || "Failed to load notification settings");
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => { if (userId) fetchSettings(); }, [userId, fetchSettings]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;
    const channel = (supabase as any)
      .channel(`notification_settings:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notification_settings', filter: `id=eq.${userId}` },
        (payload: any) => {
          const { eventType, new: newRow } = payload;
          if (eventType === 'UPDATE' || eventType === 'INSERT') setSettings(newRow);
          if (eventType === 'DELETE') setSettings(null);
        }
      )
      .subscribe();
    return () => { try { (supabase as any).removeChannel(channel); } catch {} };
  }, [supabase, userId]);

  // Update settings
  const updateSettings = useCallback(async (patch: Partial<NotificationSettings>) => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("notification_settings")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", userId)
        .select("*")
        .single();
      if (error) throw error;
      setSettings(data);
      success("Notification settings updated");
    } catch (e: any) {
      setError(e.message || "Failed to update notification settings");
      toastError("Update failed", e.message);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId, success, toastError]);

  // Create settings (onboarding)
  const createSettings = useCallback(async (payload: Partial<NotificationSettings>) => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("notification_settings")
        .insert({ ...payload, id: userId })
        .select("*")
        .single();
      if (error) throw error;
      setSettings(data);
      success("Notification settings created");
    } catch (e: any) {
      setError(e.message || "Failed to create notification settings");
      toastError("Create failed", e.message);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId, success, toastError]);

  return {
    settings,
    loading,
    error,
    refresh: fetchSettings,
    updateSettings,
    createSettings,
  } as const;
}
