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
  const [backupCodes, setBackupCodes] = useState<Array<{ id: number; user_id: string; used: boolean }>>([]);
  const [devices, setDevices] = useState<Array<{ id: number; device_id: string; device_name: string | null; last_seen_at: string }>>([]);

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

  // Backup codes
  const listBackupCodes = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await (supabase as any)
      .from('security_backup_codes')
      .select('id,user_id,used')
      .eq('user_id', userId)
      .order('id', { ascending: true });
    if (error) throw error;
    setBackupCodes(data || []);
  }, [supabase, userId]);

  const generateBackupCodes = useCallback(async (count = 10) => {
    if (!userId) return [] as string[];
    // Generate codes client-side, store hashes server-side
    // For simplicity, store plain code hashes using SHA-256 here
    const codes: string[] = Array.from({ length: count }).map(() =>
      Math.random().toString(36).slice(2, 10).toUpperCase()
    );
    const encoder = new TextEncoder();
    const hashes = await Promise.all(codes.map(async (c) => {
      const buf = await crypto.subtle.digest('SHA-256', encoder.encode(c));
      const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      return { user_id: userId, code_hash: hex };
    }));
    const { error } = await (supabase as any).from('security_backup_codes').insert(hashes);
    if (error) throw error;
    await listBackupCodes();
    success('Backup codes generated');
    return codes;
  }, [supabase, userId, listBackupCodes, success]);

  const markBackupCodeUsed = useCallback(async (code: string) => {
    if (!userId) return false;
    const encoder = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', encoder.encode(code));
    const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    const { error } = await (supabase as any)
      .from('security_backup_codes')
      .update({ used: true })
      .eq('user_id', userId)
      .eq('code_hash', hex);
    if (error) throw error;
    await listBackupCodes();
    return true;
  }, [supabase, userId, listBackupCodes]);

  useEffect(() => {
    if (!userId) return;
    const ch = (supabase as any)
      .channel(`backup_codes:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'security_backup_codes', filter: `user_id=eq.${userId}` }, () => listBackupCodes())
      .subscribe();
    listBackupCodes();
    return () => { try { (supabase as any).removeChannel(ch); } catch {} };
  }, [supabase, userId, listBackupCodes]);

  // Trusted devices
  const listDevices = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await (supabase as any)
      .from('security_trusted_devices')
      .select('id,device_id,device_name,last_seen_at')
      .eq('user_id', userId)
      .order('last_seen_at', { ascending: false });
    if (error) throw error;
    setDevices(data || []);
  }, [supabase, userId]);

  const trustDevice = useCallback(async (deviceId: string, deviceName?: string) => {
    if (!userId) return;
    const { error } = await (supabase as any).from('security_trusted_devices').upsert({
      user_id: userId, device_id: deviceId, device_name: deviceName ?? null, last_seen_at: new Date().toISOString(),
    }, { onConflict: 'user_id,device_id' });
    if (error) throw error;
    await listDevices();
  }, [supabase, userId, listDevices]);

  const revokeDevice = useCallback(async (deviceId: string) => {
    if (!userId) return;
    const { error } = await (supabase as any).from('security_trusted_devices').delete().eq('user_id', userId).eq('device_id', deviceId);
    if (error) throw error;
    await listDevices();
  }, [supabase, userId, listDevices]);

  useEffect(() => {
    if (!userId) return;
    const ch = (supabase as any)
      .channel(`trusted_devices:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'security_trusted_devices', filter: `user_id=eq.${userId}` }, () => listDevices())
      .subscribe();
    listDevices();
    return () => { try { (supabase as any).removeChannel(ch); } catch {} };
  }, [supabase, userId, listDevices]);

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
