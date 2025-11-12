import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabaseClient";
import { useToast } from "../components/ui/toast";

export interface SecuritySettings {
  id: string;
  // Basic 2FA
  two_factor_enabled: boolean;
  sign_in_alerts: boolean;
  factor_id?: string | null;
  // Advanced 2FA
  require_2fa_for_login?: boolean;
  backup_codes_required?: boolean;
  // Login security
  login_alerts_enabled?: boolean;
  suspicious_login_alerts?: boolean;
  password_change_alerts?: boolean;
  // Session management
  session_timeout_minutes?: number;
  max_concurrent_sessions?: number;
  auto_logout_inactive?: boolean;
  // IP Security
  ip_whitelist_enabled?: boolean;
  allowed_ips?: string[];
  blocked_ips?: string[];
  // API Security
  api_keys_enabled?: boolean;
  // Password policy
  password_min_length?: number;
  password_require_uppercase?: boolean;
  password_require_lowercase?: boolean;
  password_require_numbers?: boolean;
  password_require_symbols?: boolean;
  password_expiry_days?: number;
  updated_at: string;
}

export interface ActiveSession {
  id: string;
  user_id: string;
  session_token: string;
  device_id?: string | null;
  device_name?: string | null;
  device_type?: string | null;
  browser?: string | null;
  os?: string | null;
  ip_address?: string | null;
  location?: string | null;
  user_agent?: string | null;
  is_current: boolean;
  last_activity_at: string;
  created_at: string;
  expires_at?: string | null;
}

export interface SecurityAuditLog {
  id: string;
  user_id: string;
  event_type: string;
  event_description?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  device_id?: string | null;
  location?: string | null;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  metadata?: any;
  created_at: string;
}

export interface ApiKey {
  id: string;
  user_id: string;
  key_name: string;
  key_hash: string;
  key_prefix: string;
  last_used_at?: string | null;
  expires_at?: string | null;
  ip_restrictions?: string[];
  permissions?: string[];
  is_active: boolean;
  created_at: string;
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
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [auditLogs, setAuditLogs] = useState<SecurityAuditLog[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

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

  useEffect(() => { if (userId) fetchSettings(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const defaultSettings: Partial<SecuritySettings> = {
        id: userId,
        two_factor_enabled: false,
        sign_in_alerts: true,
        require_2fa_for_login: false,
        backup_codes_required: true,
        login_alerts_enabled: true,
        suspicious_login_alerts: true,
        password_change_alerts: true,
        session_timeout_minutes: 60,
        max_concurrent_sessions: 5,
        auto_logout_inactive: true,
        ip_whitelist_enabled: false,
        allowed_ips: [],
        blocked_ips: [],
        api_keys_enabled: false,
        password_min_length: 8,
        password_require_uppercase: true,
        password_require_lowercase: true,
        password_require_numbers: true,
        password_require_symbols: true,
        password_expiry_days: 0,
        ...payload,
      };
      const { data, error } = await supabase
        .from("security_settings")
        .insert(defaultSettings)
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
  }, [supabase, userId]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [supabase, userId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Active Sessions
  const listActiveSessions = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('security_active_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('last_activity_at', { ascending: false });
      if (error) throw error;
      setActiveSessions(data || []);
    } catch (e: any) {
      console.error('Failed to list active sessions:', e);
    }
  }, [supabase, userId]);

  const revokeSession = useCallback(async (sessionId: string) => {
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('security_active_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', userId);
      if (error) throw error;
      await listActiveSessions();
      success('Session revoked');
    } catch (e: any) {
      toastError('Failed to revoke session', e.message);
    }
  }, [supabase, userId, listActiveSessions, success, toastError]);

  const revokeAllOtherSessions = useCallback(async () => {
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('security_active_sessions')
        .delete()
        .eq('user_id', userId)
        .eq('is_current', false);
      if (error) throw error;
      await listActiveSessions();
      success('All other sessions revoked');
    } catch (e: any) {
      toastError('Failed to revoke sessions', e.message);
    }
  }, [supabase, userId, listActiveSessions, success, toastError]);

  useEffect(() => {
    if (!userId) return;
    const ch = (supabase as any)
      .channel(`active_sessions:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'security_active_sessions', filter: `user_id=eq.${userId}` }, () => listActiveSessions())
      .subscribe();
    listActiveSessions();
    return () => { try { (supabase as any).removeChannel(ch); } catch {} };
  }, [supabase, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Audit Log
  const listAuditLogs = useCallback(async (limit = 50) => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('security_audit_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      setAuditLogs(data || []);
    } catch (e: any) {
      console.error('Failed to list audit logs:', e);
    }
  }, [supabase, userId]);

  useEffect(() => {
    if (userId) listAuditLogs();
  }, [userId, listAuditLogs]);

  // API Keys
  const listApiKeys = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('security_api_keys')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setApiKeys(data || []);
    } catch (e: any) {
      console.error('Failed to list API keys:', e);
    }
  }, [supabase, userId]);

  const createApiKey = useCallback(async (keyName: string, expiresInDays?: number, ipRestrictions?: string[], permissions?: string[]) => {
    if (!userId) return null;
    try {
      // Generate a secure random key
      const keyBytes = new Uint8Array(32);
      crypto.getRandomValues(keyBytes);
      const key = Array.from(keyBytes, byte => byte.toString(16).padStart(2, '0')).join('');
      const keyPrefix = key.substring(0, 8);
      
      // Hash the key
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(key));
      const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      
      const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString() : null;
      
      const { data, error } = await supabase
        .from('security_api_keys')
        .insert({
          user_id: userId,
          key_name: keyName,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          expires_at: expiresAt,
          ip_restrictions: ipRestrictions || [],
          permissions: permissions || [],
          is_active: true,
        })
        .select('*')
        .single();
      
      if (error) throw error;
      await listApiKeys();
      success('API key created');
      // Return the full key only once (client should store it)
      return { ...data, key: `jrk_${key}` };
    } catch (e: any) {
      toastError('Failed to create API key', e.message);
      return null;
    }
  }, [supabase, userId, listApiKeys, success, toastError]);

  const revokeApiKey = useCallback(async (keyId: string) => {
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('security_api_keys')
        .update({ is_active: false })
        .eq('id', keyId)
        .eq('user_id', userId);
      if (error) throw error;
      await listApiKeys();
      success('API key revoked');
    } catch (e: any) {
      toastError('Failed to revoke API key', e.message);
    }
  }, [supabase, userId, listApiKeys, success, toastError]);

  const deleteApiKey = useCallback(async (keyId: string) => {
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('security_api_keys')
        .delete()
        .eq('id', keyId)
        .eq('user_id', userId);
      if (error) throw error;
      await listApiKeys();
      success('API key deleted');
    } catch (e: any) {
      toastError('Failed to delete API key', e.message);
    }
  }, [supabase, userId, listApiKeys, success, toastError]);

  useEffect(() => {
    if (!userId) return;
    const ch = (supabase as any)
      .channel(`api_keys:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'security_api_keys', filter: `user_id=eq.${userId}` }, () => listApiKeys())
      .subscribe();
    listApiKeys();
    return () => { try { (supabase as any).removeChannel(ch); } catch {} };
  }, [supabase, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    settings,
    loading,
    error,
    refresh: fetchSettings,
    updateSecurity,
    createSecurity,
    // MFA
    enrollTotp,
    verifyTotp,
    disableTotp,
    // Backup codes
    backupCodes,
    listBackupCodes,
    generateBackupCodes,
    markBackupCodeUsed,
    // Trusted devices
    devices,
    listDevices,
    trustDevice,
    revokeDevice,
    // Active sessions
    activeSessions,
    listActiveSessions,
    revokeSession,
    revokeAllOtherSessions,
    // Audit log
    auditLogs,
    listAuditLogs,
    // API keys
    apiKeys,
    listApiKeys,
    createApiKey,
    revokeApiKey,
    deleteApiKey,
  } as const;
}
