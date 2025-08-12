import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabaseClient";

export interface AppearanceSettings {
  id: string;
  theme: 'dark' | 'light' | 'auto';
  accent_color: string;
  reduce_motion: boolean;
  updated_at: string;
}

function applyAppearanceToDOM({ theme, accent_color, reduce_motion }: { theme: 'dark' | 'light' | 'auto'; accent_color: string; reduce_motion: boolean; }) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  // Theme class
  const prefersDark = typeof window !== 'undefined' && (window as any).matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  root.classList.remove('dark');
  if (theme === 'dark' || (theme === 'auto' && prefersDark)) root.classList.add('dark');
  // Accent color variable
  root.style.setProperty('--accent-color', accent_color);
  // Reduced motion
  root.style.setProperty('--reduce-motion', reduce_motion ? '1' : '0');
  if (reduce_motion) root.classList.add('rm'); else root.classList.remove('rm');
  // Persist for early boot
  try {
    localStorage.setItem('appearance_theme', theme);
    localStorage.setItem('appearance_accent', accent_color);
    localStorage.setItem('appearance_reduce_motion', reduce_motion ? '1' : '0');
  } catch {}
}

export function useAppearanceSettings() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppearanceSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = (data as any)?.user?.id ?? null;
      if (mounted) setUserId(uid);
    })();
    return () => { mounted = false; };
  }, [supabase]);

  const fetchSettings = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('appearance_settings')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      const s = (data as any) || null;
      setSettings(s);
      if (s) applyAppearanceToDOM({ theme: s.theme, accent_color: s.accent_color, reduce_motion: s.reduce_motion });
    } catch (e: any) {
      setError(e.message || 'Failed to load appearance settings');
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => { if (userId) fetchSettings(); }, [userId, fetchSettings]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;
    const ch = (supabase as any)
      .channel(`appearance:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appearance_settings', filter: `id=eq.${userId}` }, (payload: any) => {
        const { eventType } = payload;
        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          const newRow = payload.new as AppearanceSettings;
          setSettings(newRow);
          applyAppearanceToDOM({ theme: newRow.theme, accent_color: newRow.accent_color, reduce_motion: newRow.reduce_motion });
        } else if (eventType === 'DELETE') {
          setSettings(null);
        }
      })
      .subscribe();
    return () => { try { (supabase as any).removeChannel(ch); } catch {} };
  }, [supabase, userId]);

  // React to system theme changes when in auto
  useEffect(() => {
    if (!settings || settings.theme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyAppearanceToDOM({ theme: 'auto', accent_color: settings.accent_color, reduce_motion: settings.reduce_motion });
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [settings]);

  const createSettings = useCallback(async (payload: Partial<AppearanceSettings>) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('appearance_settings')
      .insert({ id: userId, theme: 'auto', accent_color: '#1dff00', reduce_motion: false, ...payload })
      .select('*')
      .single();
    if (error) throw error;
    setSettings(data as any);
    const s = data as any;
    applyAppearanceToDOM({ theme: s.theme, accent_color: s.accent_color, reduce_motion: s.reduce_motion });
    return data as any as AppearanceSettings;
  }, [supabase, userId]);

  const updateSettings = useCallback(async (patch: Partial<AppearanceSettings>) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('appearance_settings')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('*')
      .single();
    if (error) throw error;
    setSettings(data as any);
    const s = data as any;
    applyAppearanceToDOM({ theme: s.theme, accent_color: s.accent_color, reduce_motion: s.reduce_motion });
    return data as any as AppearanceSettings;
  }, [supabase, userId]);

  return { settings, loading, error, refresh: fetchSettings, createSettings, updateSettings } as const;
}
