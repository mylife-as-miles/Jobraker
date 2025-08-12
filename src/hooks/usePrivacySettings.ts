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

  useEffect(() => { if (userId) fetchSettings(); }, [userId, fetchSettings]);

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
    const { data, error } = await supabase
      .from('privacy_settings')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('*')
      .single();
    if (error) throw error;
    setSettings(data as any);
    success('Privacy settings updated');
    return data as any as PrivacySettings;
  }, [supabase, userId, success]);

  return { settings, loading, error, refresh: fetchSettings, createSettings, updateSettings } as const;
}
