import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  /** Mirrors `settings` so async helpers avoid acting on a stale closure. */
  const settingsRef = useRef<SecuritySettings | null>(null);
  settingsRef.current = settings;

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
      .select('id,user_id,used,created_at')
      .eq('user_id', userId)
      .order('id', { ascending: true });
    if (error) throw error;
    setBackupCodes(data || []);
  }, [supabase, userId]);

  const generateBackupCodes = useCallback(async (count = 10) => {
    if (!userId) return [] as string[];
    // Store the replacement set before invalidating the previous one, so an
    // insertion failure never removes the user's existing recovery method.
    const { data: existingCodes, error: existingCodesError } = await (supabase as any)
      .from('security_backup_codes')
      .select('id')
      .eq('user_id', userId);
    if (existingCodesError) throw existingCodesError;

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

    const previousIds = (existingCodes || []).map((code: { id: number }) => code.id);
    if (previousIds.length > 0) {
      const { error: invalidateError } = await (supabase as any)
        .from('security_backup_codes')
        .delete()
        .eq('user_id', userId)
        .in('id', previousIds);
      if (invalidateError) throw invalidateError;
    }

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

  /**
   * Removes any unverified TOTP factors left behind by an abandoned setup
   * attempt (closed tab, cancelled modal, expired code). Supabase caps the
   * number of factors per user and never expires unverified ones on its own,
   * so without this cleanup repeated "Enable 2FA" clicks eventually fail.
   */
  const clearUnverifiedTotpFactors = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any).auth.mfa.listFactors();
      if (error) throw error;
      const stale = ((data?.totp ?? []) as Array<{ id: string; status: string }>).filter(
        (factor) => factor.status !== 'verified',
      );
      await Promise.all(
        stale.map((factor) =>
          (supabase as any).auth.mfa.unenroll({ factorId: factor.id }).catch(() => undefined),
        ),
      );
    } catch {
      // Best effort — enrollment can proceed even if cleanup fails.
    }
  }, [supabase]);

  const enrollTotp = useCallback(async () => {
    await clearUnverifiedTotpFactors();

    const { data, error } = await (supabase as any).auth.mfa.enroll({
      factorType: 'totp',
      issuer: 'JobRaker',
    });
    if (error) throw error;

    // Supabase returns { id, type, totp: { qr_code, secret, uri } } directly —
    // there is no `factor` wrapper. Destructuring `data.factor` here silently
    // produced `undefined` for every field, which is why the setup modal used
    // to hang on "Generating QR..." forever.
    const { id, type, totp } = data ?? {};
    if (userId) await updateSecurity({ factor_id: id as string });
    return {
      factorId: id as string,
      type: type as string | undefined,
      // Ready-to-render SVG markup; the caller only needs to URI-encode it
      // into a data: URL. No client-side QR rendering library required.
      qrCode: totp?.qr_code as string | undefined,
      secret: totp?.secret as string | undefined,
      uri: totp?.uri as string | undefined,
    };
  }, [clearUnverifiedTotpFactors, supabase, updateSecurity, userId]);

  const verifyTotp = useCallback(async (factorId: string, code: string) => {
    const { error } = await (supabase as any).auth.mfa.challengeAndVerify({ factorId, code });
    if (error) throw error;
    await updateSecurity({ two_factor_enabled: true, factor_id: factorId });
    success('Two-factor authentication enabled');
  }, [supabase, updateSecurity, success]);

  const disableTotp = useCallback(async () => {
    try {
      // Unenroll every TOTP factor Supabase actually has for this user, not
      // just the id cached in `security_settings` — if the two ever drifted,
      // relying solely on the cached id would leave a live factor behind.
      const { data } = await (supabase as any).auth.mfa.listFactors();
      const factors = (data?.totp ?? []) as Array<{ id: string }>;
      await Promise.all(
        factors.map((factor) =>
          (supabase as any).auth.mfa.unenroll({ factorId: factor.id }).catch(() => undefined),
        ),
      );
    } catch {
      /* ignore if already removed */
    }
    await updateSecurity({ two_factor_enabled: false, factor_id: null });
    success('Two-factor authentication disabled');
  }, [supabase, updateSecurity, success]);

  /**
   * Reconciles the cached `two_factor_enabled` flag against Supabase's actual
   * factor state. The two can drift (a factor removed from another device, a
   * verify that succeeded upstream but failed to save locally), and trusting
   * the cached flag blindly is what let the Composio integrations panel show
   * stale connection state — same class of bug, so the same fix applies here.
   */
  const syncTotpStatus = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await (supabase as any).auth.mfa.listFactors();
      if (error) throw error;
      const verified = ((data?.totp ?? []) as Array<{ id: string; status: string }>).find(
        (factor) => factor.status === 'verified',
      );
      const actuallyEnabled = Boolean(verified);
      const nextFactorId = verified?.id ?? null;

      const current = settingsRef.current;
      if (!current) return; // Nothing local to reconcile against yet.
      const changed =
        current.two_factor_enabled !== actuallyEnabled ||
        (current.factor_id ?? null) !== nextFactorId;
      if (!changed) return;

      setSettings((prev) =>
        prev ? { ...prev, two_factor_enabled: actuallyEnabled, factor_id: nextFactorId } : prev,
      );

      await supabase
        .from('security_settings')
        .update({
          two_factor_enabled: actuallyEnabled,
          factor_id: nextFactorId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    } catch (e) {
      console.error('Failed to sync 2FA status:', e);
    }
  }, [supabase, userId]);

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
    syncTotpStatus,
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
