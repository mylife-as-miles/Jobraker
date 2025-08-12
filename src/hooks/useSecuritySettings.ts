import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabaseClient";
import { useToast } from "../components/ui/toast";

export interface SecuritySettings {
  id: string;
  two_factor_enabled: boolean;
  sign_in_alerts: boolean;
  updated_at: string;
}

export function useSecuritySettings() {
  const supabase = useMemo(() => createClient(), []);
  const { success, error: toastError } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const fetchSettings = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("security_settings")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      setSettings((data as any) || null);
    } catch (e: any) {
      setError(e.message || "Failed to load security settings");
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => { if (userId) fetchSettings(); }, [userId, fetchSettings]);

  useEffect(() => {
    if (!userId) return;
    const channel = (supabase as any)
      .channel(`security_settings:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'security_settings', filter: `id=eq.${userId}` }, (payload: any) => {
        const { eventType, new: newRow } = payload;
        if (eventType === 'INSERT' || eventType === 'UPDATE') setSettings(newRow as SecuritySettings);
        if (eventType === 'DELETE') setSettings(null);
      })
      .subscribe();
    return () => { try { (supabase as any).removeChannel(channel); } catch {} };
  }, [supabase, userId]);

  const updateSecurity = useCallback(async (patch: Partial<SecuritySettings>) => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("security_settings")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", userId)
        .select("*")
        .single();
      if (error) throw error;
      setSettings(data as any);
      success("Security settings updated");
    } catch (e: any) {
      setError(e.message || "Failed to update security settings");
      toastError("Update failed", e.message);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId, success, toastError]);

  const createSecurity = useCallback(async (payload: Partial<SecuritySettings>) => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("security_settings")
        .insert({ id: userId, two_factor_enabled: false, sign_in_alerts: true, ...payload })
        .select("*")
        .single();
      if (error) throw error;
      setSettings(data as any);
      success("Security settings created");
    } catch (e: any) {
      setError(e.message || "Failed to create security settings");
      toastError("Create failed", e.message);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId, success, toastError]);

  return { settings, loading, error, refresh: fetchSettings, updateSecurity, createSecurity } as const;
}
