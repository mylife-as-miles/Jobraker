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
  // Walkthrough completion flags (added via migration 20251001100000)
  walkthrough_overview?: boolean;
  walkthrough_applications?: boolean;
  walkthrough_jobs?: boolean;
  walkthrough_resume?: boolean;
  walkthrough_analytics?: boolean;
  walkthrough_settings?: boolean;
  walkthrough_profile?: boolean;
  walkthrough_notifications?: boolean;
  walkthrough_chat?: boolean;
  "walkthrough_cover-letter"?: boolean;
}

// Lightweight collection record types (duplicated from useProfileCollections to avoid coupling)
export interface ProfileExperienceRecord { id: string; user_id: string; title: string; company: string; location: string; start_date: string; end_date: string | null; is_current: boolean; description: string; created_at: string; updated_at: string; }
export interface ProfileEducationRecord { id: string; user_id: string; degree: string; school: string; location: string; start_date: string; end_date: string | null; gpa: string | null; created_at: string; updated_at: string; }
export interface ProfileSkillRecord { id: string; user_id: string; name: string; level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert' | null; category: string; created_at: string; updated_at: string; }

interface CollectionState<T> { data: T[]; loading: boolean; error: string | null; }

export function useProfileSettings() {
  const supabase = useMemo(() => createClient(), []);
  const { success, error: toastError } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Collections state (mirrors useProfileCollections but centralized)
  const [experiences, setExperiences] = useState<CollectionState<ProfileExperienceRecord>>({ data: [], loading: false, error: null });
  const [education, setEducation] = useState<CollectionState<ProfileEducationRecord>>({ data: [], loading: false, error: null });
  const [skills, setSkills] = useState<CollectionState<ProfileSkillRecord>>({ data: [], loading: false, error: null });

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

  // Individual fetchers
  const fetchExperiences = useCallback(async () => {
    if (!userId) return;
    setExperiences(s => ({ ...s, loading: true, error: null }));
    try {
      const { data, error } = await supabase.from('profile_experiences').select('*').eq('user_id', userId).order('start_date', { ascending: false });
      if (error) throw error;
      setExperiences({ data: data || [], loading: false, error: null });
    } catch (e: any) {
      setExperiences(s => ({ ...s, loading: false, error: e.message || 'Failed to load experiences' }));
    }
  }, [supabase, userId]);

  const fetchEducation = useCallback(async () => {
    if (!userId) return;
    setEducation(s => ({ ...s, loading: true, error: null }));
    try {
      const { data, error } = await supabase.from('profile_education').select('*').eq('user_id', userId).order('start_date', { ascending: false });
      if (error) throw error;
      setEducation({ data: data || [], loading: false, error: null });
    } catch (e: any) {
      setEducation(s => ({ ...s, loading: false, error: e.message || 'Failed to load education' }));
    }
  }, [supabase, userId]);

  const fetchSkills = useCallback(async () => {
    if (!userId) return;
    setSkills(s => ({ ...s, loading: true, error: null }));
    try {
      const { data, error } = await supabase.from('profile_skills').select('*').eq('user_id', userId).order('name');
      if (error) throw error;
      setSkills({ data: data || [], loading: false, error: null });
    } catch (e: any) {
      setSkills(s => ({ ...s, loading: false, error: e.message || 'Failed to load skills' }));
    }
  }, [supabase, userId]);

  useEffect(() => { if (userId) fetchProfile(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (userId) { fetchExperiences(); fetchEducation(); fetchSkills(); } }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime for collections
  useEffect(() => {
    if (!userId) return;
    const subs = [
      { table: 'profile_experiences', handler: fetchExperiences },
      { table: 'profile_education', handler: fetchEducation },
      { table: 'profile_skills', handler: fetchSkills },
    ].map(cfg => (supabase as any)
      .channel(`${cfg.table}:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: cfg.table, filter: `user_id=eq.${userId}` }, () => cfg.handler())
      .subscribe());
    return () => { subs.forEach(ch => { try { (supabase as any).removeChannel(ch); } catch {} }); };
  }, [supabase, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // CRUD helpers
  const addExperience = useCallback(async (payload: Partial<ProfileExperienceRecord>) => {
    if (!userId) return;
    try {
      const insert = { ...payload, user_id: userId } as any; delete insert.id;
      const { error } = await supabase.from('profile_experiences').insert(insert);
      if (error) throw error;
      success('Experience added');
    } catch (e: any) { toastError('Add failed', e.message); }
  }, [supabase, userId, success, toastError]);

  const updateExperience = useCallback(async (id: string, patch: Partial<ProfileExperienceRecord>) => {
    try {
      const { error } = await supabase.from('profile_experiences').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      success('Experience updated');
    } catch (e: any) { toastError('Update failed', e.message); }
  }, [supabase, success, toastError]);

  const deleteExperience = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('profile_experiences').delete().eq('id', id);
      if (error) throw error;
      success('Experience removed');
    } catch (e: any) { toastError('Delete failed', e.message); }
  }, [supabase, success, toastError]);

  const addEducation = useCallback(async (payload: Partial<ProfileEducationRecord>) => {
    if (!userId) return;
    try {
      const insert = { ...payload, user_id: userId } as any; delete insert.id;
      const { error } = await supabase.from('profile_education').insert(insert);
      if (error) throw error;
      success('Education added');
    } catch (e: any) { toastError('Add failed', e.message); }
  }, [supabase, userId, success, toastError]);

  const updateEducation = useCallback(async (id: string, patch: Partial<ProfileEducationRecord>) => {
    try {
      const { error } = await supabase.from('profile_education').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      success('Education updated');
    } catch (e: any) { toastError('Update failed', e.message); }
  }, [supabase, success, toastError]);

  const deleteEducation = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('profile_education').delete().eq('id', id);
      if (error) throw error;
      success('Education removed');
    } catch (e: any) { toastError('Delete failed', e.message); }
  }, [supabase, success, toastError]);

  const addSkill = useCallback(async (payload: Partial<ProfileSkillRecord>) => {
    if (!userId) return;
    try {
      const insert = { ...payload, user_id: userId } as any; delete insert.id;
      const { error } = await supabase.from('profile_skills').insert(insert);
      if (error) throw error;
      success('Skill added');
    } catch (e: any) { toastError('Add failed', e.message); }
  }, [supabase, userId, success, toastError]);

  const updateSkill = useCallback(async (id: string, patch: Partial<ProfileSkillRecord>) => {
    try {
      const { error } = await supabase.from('profile_skills').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      success('Skill updated');
    } catch (e: any) { toastError('Update failed', e.message); }
  }, [supabase, success, toastError]);

  const deleteSkill = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('profile_skills').delete().eq('id', id);
      if (error) throw error;
      success('Skill removed');
    } catch (e: any) { toastError('Delete failed', e.message); }
  }, [supabase, success, toastError]);

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

  // Mark a specific walkthrough flag as complete (idempotent)
  const completeWalkthrough = useCallback(async (key: keyof Profile) => {
    if (!userId) return;
    if (!key.startsWith('walkthrough_')) return;
    try {
      await updateProfile({ [key]: true } as any);
    } catch {}
  }, [updateProfile, userId]);

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
  experiences,
  education,
  skills,
  refreshCollections: () => { fetchExperiences(); fetchEducation(); fetchSkills(); },
  addExperience, updateExperience, deleteExperience,
  addEducation, updateEducation, deleteEducation,
  addSkill, updateSkill, deleteSkill,
    refresh: fetchProfile,
    updateProfile,
    createProfile,
    completeWalkthrough,
  } as const;
}
