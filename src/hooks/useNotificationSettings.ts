import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabaseClient";
import { useToast } from "../components/ui/toast";

export interface NotificationSettings {
  id: string;
  // General settings
  email_notifications: boolean;
  push_notifications: boolean;
  job_alerts: boolean;
  application_updates: boolean;
  weekly_digest: boolean;
  marketing_emails: boolean;
  // Type-specific in-app notifications
  notify_interviews?: boolean;
  notify_applications?: boolean;
  notify_system?: boolean;
  notify_company_updates?: boolean;
  // Type-specific email notifications
  email_interviews?: boolean;
  email_applications?: boolean;
  email_system?: boolean;
  email_company_updates?: boolean;
  // Type-specific push notifications
  push_interviews?: boolean;
  push_applications?: boolean;
  push_system?: boolean;
  push_company_updates?: boolean;
  // Quiet hours
  quiet_hours_enabled?: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  // Other settings
  sound_enabled?: boolean;
  desktop_notifications?: boolean;
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
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }
      
      // If no settings exist, create default ones
      if (!data) {
        const defaultSettings: Partial<NotificationSettings> = {
          id: userId,
          email_notifications: true,
          push_notifications: true,
          job_alerts: true,
          application_updates: true,
          weekly_digest: false,
          marketing_emails: false,
          notify_interviews: true,
          notify_applications: true,
          notify_system: true,
          notify_company_updates: true,
          email_interviews: true,
          email_applications: true,
          email_system: false,
          email_company_updates: true,
          push_interviews: true,
          push_applications: true,
          push_system: false,
          push_company_updates: true,
          quiet_hours_enabled: false,
          quiet_hours_start: '22:00:00',
          quiet_hours_end: '08:00:00',
          sound_enabled: true,
          desktop_notifications: true,
        };
        
        const { data: newData, error: insertError } = await supabase
          .from("notification_settings")
          .insert(defaultSettings)
          .select("*")
          .single();
        
        if (insertError) throw insertError;
        setSettings(newData);
      } else {
        setSettings(data);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load notification settings");
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => { if (userId) fetchSettings(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!userId) {
      toastError("Update failed", "User not authenticated");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Check if settings exist, if not create them first
      const { data: existing } = await supabase
        .from("notification_settings")
        .select("id")
        .eq("id", userId)
        .maybeSingle();
      
      if (!existing) {
        // Create settings with defaults if they don't exist
        const defaultSettings: Partial<NotificationSettings> = {
          id: userId,
          email_notifications: true,
          push_notifications: true,
          job_alerts: true,
          application_updates: true,
          weekly_digest: false,
          marketing_emails: false,
          notify_interviews: true,
          notify_applications: true,
          notify_system: true,
          notify_company_updates: true,
          email_interviews: true,
          email_applications: true,
          email_system: false,
          email_company_updates: true,
          push_interviews: true,
          push_applications: true,
          push_system: false,
          push_company_updates: true,
          quiet_hours_enabled: false,
          quiet_hours_start: '22:00:00',
          quiet_hours_end: '08:00:00',
          sound_enabled: true,
          desktop_notifications: true,
          ...patch,
        };
        
        const { data: newData, error: insertError } = await supabase
          .from("notification_settings")
          .insert(defaultSettings)
          .select("*")
          .single();
        
        if (insertError) throw insertError;
        setSettings(newData);
        success("Notification settings created");
      } else {
        const { data, error } = await supabase
          .from("notification_settings")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("id", userId)
          .select("*")
          .single();
        if (error) throw error;
        setSettings(data);
        success("Notification settings updated");
        // Clear notification settings cache
        const { clearNotificationSettingsCache } = await import('../utils/notifications');
        clearNotificationSettingsCache(userId);
      }
    } catch (e: any) {
      const errorMessage = e.message || "Failed to update notification settings";
      setError(errorMessage);
      toastError("Update failed", errorMessage);
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
      // Clear notification settings cache
      const { clearNotificationSettingsCache } = await import('../utils/notifications');
      clearNotificationSettingsCache(userId);
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
