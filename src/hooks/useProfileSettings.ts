import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabaseClient";
import { useToast } from "../components/ui/toast";

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  experience_years: number | null;
  location: string | null;
  goals: string[];
  updated_at: string;
}

export function useProfileSettings() {
  const supabase = useMemo(() => createClient(), []);
  const { success, error: toastError } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Fetch userId
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

  // Fetch profile
  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (error) throw error;
      setProfile(data);
    } catch (e: any) {
      setError(e.message || "Failed to load profile");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => { if (userId) fetchProfile(); }, [userId, fetchProfile]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;
    const channel = (supabase as any)
      .channel(`profile:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload: any) => {
          const { eventType, new: newRow } = payload;
          if (eventType === 'UPDATE' || eventType === 'INSERT') setProfile(newRow);
          if (eventType === 'DELETE') setProfile(null);
        }
      )
      .subscribe();
    return () => { try { (supabase as any).removeChannel(channel); } catch {} };
  }, [supabase, userId]);

  // Update profile
  const updateProfile = useCallback(async (patch: Partial<Profile>) => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", userId)
        .select("*")
        .single();
      if (error) throw error;
      setProfile(data);
      success("Profile updated");
    } catch (e: any) {
      setError(e.message || "Failed to update profile");
      toastError("Update failed", e.message);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId, success, toastError]);

  // Create profile (onboarding)
  const createProfile = useCallback(async (payload: Partial<Profile>) => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .insert({ ...payload, id: userId })
        .select("*")
        .single();
      if (error) throw error;
      setProfile(data);
      success("Profile created");
    } catch (e: any) {
      setError(e.message || "Failed to create profile");
      toastError("Create failed", e.message);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId, success, toastError]);

  return {
    profile,
    loading,
    error,
    refresh: fetchProfile,
    updateProfile,
    createProfile,
  } as const;
}
