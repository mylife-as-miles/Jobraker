import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabaseClient";
import { useToast } from "../components/ui/toast";

export interface PrivacySettings {
  id: string;
  is_profile_public: boolean;
  show_email: boolean;
  allow_search_indexing: boolean;
  share_analytics: boolean;
  personalized_ads: boolean;
  resume_default_public: boolean;
  allow_location_sharing?: boolean;
  allow_activity_tracking?: boolean;
  allow_third_party_sharing?: boolean;
  allow_cookie_tracking?: boolean;
  data_retention_days?: number;
  auto_delete_inactive?: boolean;
  allow_marketing_emails?: boolean;
  allow_analytics_cookies?: boolean;
  allow_functional_cookies?: boolean;
  allow_advertising_cookies?: boolean;
  gdpr_consent_given?: boolean;
  gdpr_consent_date?: string;
  allow_data_portability?: boolean;
  allow_data_deletion?: boolean;
  share_with_recruiters?: boolean;
  allow_profile_search?: boolean;
  show_application_status?: boolean;
  allow_company_access?: boolean;
  updated_at: string;
}

export interface PrivacyAuditLog {
  id: string;
  user_id: string;
  action_type: string;
  setting_name?: string;
  old_value?: string;
  new_value?: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: any;
  created_at: string;
}

export interface DataDeletionRequest {
  id: string;
  user_id: string;
  request_type: 'full_deletion' | 'partial_deletion' | 'anonymization';
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  requested_data_types?: string[];
  reason?: string;
  scheduled_deletion_date?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export function usePrivacySettings() {
  const supabase = useMemo(() => createClient(), []);
  const { success } = useToast();
  const [settings, setSettings] = useState<PrivacySettings | null>(null);
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

  const fetchSettings = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('privacy_settings')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      setSettings((data as any) || null);
    } catch (e: any) {
      setError(e.message || 'Failed to load privacy settings');
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => { if (userId) fetchSettings(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!userId) return;
    const ch = (supabase as any)
      .channel(`privacy:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'privacy_settings', filter: `id=eq.${userId}` }, (payload: any) => {
        const { eventType, new: newRow } = payload;
        if (eventType === 'INSERT' || eventType === 'UPDATE') setSettings(newRow as any);
        if (eventType === 'DELETE') setSettings(null);
      })
      .subscribe();
    return () => { try { (supabase as any).removeChannel(ch); } catch {} };
  }, [supabase, userId]);

  const createSettings = useCallback(async (payload: Partial<PrivacySettings>) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('privacy_settings')
      .insert({ id: userId, ...payload })
      .select('*')
      .single();
    if (error) throw error;
    setSettings(data as any);
    success('Privacy settings created');
    return data as any as PrivacySettings;
  }, [supabase, userId, success]);

  const updateSettings = useCallback(async (patch: Partial<PrivacySettings>) => {
    if (!userId) return null;
    
    // Get current settings to log changes
    const currentSettings = settings;
    
    // Log each changed setting
    const changes = Object.keys(patch).filter(key => {
      if (key === 'updated_at') return false;
      const oldVal = (currentSettings as any)?.[key];
      const newVal = (patch as any)[key];
      return oldVal !== newVal;
    });

    const { data, error } = await supabase
      .from('privacy_settings')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('*')
      .single();
    if (error) throw error;
    setSettings(data as any);
    
    // Log privacy changes to audit log
    if (changes.length > 0) {
      try {
        const userAgent = navigator.userAgent;
        const ipAddress = null; // Would need backend to get real IP
        
        for (const key of changes) {
          await (supabase as any).from('privacy_audit_log').insert({
            user_id: userId,
            action_type: 'setting_changed',
            setting_name: key,
            old_value: String((currentSettings as any)?.[key] ?? 'null'),
            new_value: String((patch as any)[key] ?? 'null'),
            user_agent: userAgent,
            metadata: { source: 'settings_page' }
          });
        }
      } catch (e) {
        console.warn('Failed to log privacy change:', e);
      }
    }
    
    success('Privacy settings updated');
    return data as any as PrivacySettings;
  }, [supabase, userId, success, settings]);

  const logPrivacyAction = useCallback(async (
    actionType: string,
    metadata?: any
  ) => {
    if (!userId) return;
    try {
      const userAgent = navigator.userAgent;
      await (supabase as any).from('privacy_audit_log').insert({
        user_id: userId,
        action_type: actionType,
        user_agent: userAgent,
        metadata: metadata || {}
      });
    } catch (e) {
      console.warn('Failed to log privacy action:', e);
    }
  }, [supabase, userId]);

  const listAuditLogs = useCallback(async (limit = 50) => {
    if (!userId) return [];
    const { data, error } = await (supabase as any)
      .from('privacy_audit_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as PrivacyAuditLog[];
  }, [supabase, userId]);

  const createDeletionRequest = useCallback(async (
    requestType: 'full_deletion' | 'partial_deletion' | 'anonymization',
    requestedDataTypes?: string[],
    reason?: string
  ) => {
    if (!userId) return null;
    const { data, error } = await (supabase as any)
      .from('privacy_data_deletion_requests')
      .insert({
        user_id: userId,
        request_type: requestType,
        requested_data_types: requestedDataTypes || [],
        reason: reason,
        status: 'pending'
      })
      .select('*')
      .single();
    if (error) throw error;
    
    await logPrivacyAction('gdpr_request', { request_type: requestType });
    return data as DataDeletionRequest;
  }, [supabase, userId, logPrivacyAction]);

  const listDeletionRequests = useCallback(async () => {
    if (!userId) return [];
    const { data, error } = await (supabase as any)
      .from('privacy_data_deletion_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as DataDeletionRequest[];
  }, [supabase, userId]);

  const updateGDPRConsent = useCallback(async (consent: boolean) => {
    if (!userId) return null;
    const updateData: any = {
      gdpr_consent_given: consent,
      updated_at: new Date().toISOString()
    };
    if (consent) {
      updateData.gdpr_consent_date = new Date().toISOString();
    }
    
    const { data, error } = await supabase
      .from('privacy_settings')
      .update(updateData)
      .eq('id', userId)
      .select('*')
      .single();
    if (error) throw error;
    setSettings(data as any);
    
    await logPrivacyAction(consent ? 'consent_given' : 'consent_withdrawn');
    return data as any as PrivacySettings;
  }, [supabase, userId, logPrivacyAction]);

  // Realtime subscriptions for audit log and deletion requests
  const [auditLogs, setAuditLogs] = useState<PrivacyAuditLog[]>([]);
  const [deletionRequests, setDeletionRequests] = useState<DataDeletionRequest[]>([]);

  useEffect(() => {
    if (!userId) return;
    listAuditLogs().then(setAuditLogs).catch(console.error);
    listDeletionRequests().then(setDeletionRequests).catch(console.error);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!userId) return;
    const ch1 = (supabase as any)
      .channel(`privacy_audit:${userId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'privacy_audit_log', 
        filter: `user_id=eq.${userId}` 
      }, () => {
        listAuditLogs().then(setAuditLogs).catch(console.error);
      })
      .subscribe();
    
    const ch2 = (supabase as any)
      .channel(`privacy_deletion:${userId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'privacy_data_deletion_requests', 
        filter: `user_id=eq.${userId}` 
      }, () => {
        listDeletionRequests().then(setDeletionRequests).catch(console.error);
      })
      .subscribe();
    
    return () => { 
      try { (supabase as any).removeChannel(ch1); } catch {} 
      try { (supabase as any).removeChannel(ch2); } catch {} 
    };
  }, [supabase, userId, listAuditLogs, listDeletionRequests]);

  return { 
    settings, 
    loading, 
    error, 
    refresh: fetchSettings, 
    createSettings, 
    updateSettings,
    logPrivacyAction,
    listAuditLogs,
    auditLogs,
    createDeletionRequest,
    listDeletionRequests,
    deletionRequests,
    updateGDPRConsent
  } as const;
}
