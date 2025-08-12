import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabaseClient";
import { useToast } from "../components/ui/toast";

export interface SecuritySettings {
  id: string;
  two_factor_enabled: boolean;
  sign_in_alerts: boolean;
  factor_id?: string | null;
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

  // MFA helpers (TOTP)
  const enrollTotp = useCallback(async () => {
    // Create a new TOTP factor; returns id and uri for QR
    const { data, error } = await (supabase as any).auth.mfa.enroll({ factorType: 'totp' });
    if (error) throw error;
    const { id, type, totp } = data?.factor ?? {};
    const uri = totp?.uri as string | undefined;
    if (userId) await updateSecurity({ factor_id: id as string });
    return { factorId: id as string, uri, type } as { factorId: string; uri?: string; type?: string };
  }, [supabase, updateSecurity, userId]);

  const verifyTotp = useCallback(async (factorId: string, code: string) => {
    const { error } = await (supabase as any).auth.mfa.challengeAndVerify({ factorId, code });
    if (error) throw error;
    await updateSecurity({ two_factor_enabled: true });
    success('Two-factor authentication enabled');
  }, [supabase, updateSecurity, success]);

  const disableTotp = useCallback(async () => {
    if (!settings?.factor_id) { await updateSecurity({ two_factor_enabled: false }); return; }
    try {
      await (supabase as any).auth.mfa.unenroll({ factorId: settings.factor_id });
    } catch { /* ignore if already removed */ }
    await updateSecurity({ two_factor_enabled: false, factor_id: null });
    success('Two-factor authentication disabled');
  }, [supabase, settings?.factor_id, updateSecurity, success]);

  return { settings, loading, error, refresh: fetchSettings, updateSecurity, createSecurity, enrollTotp, verifyTotp, disableTotp } as const;
}
