import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '../lib/supabaseClient';
import { useToast } from '../components/ui/toast';

export interface ProfileExperience {
  id: string;
  user_id: string;
  title: string;
  company: string;
  location: string;
  start_date: string; // ISO
  end_date: string | null;
  is_current: boolean;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface ProfileEducation {
  id: string;
  user_id: string;
  degree: string;
  school: string;
  location: string;
  start_date: string;
  end_date: string | null;
  gpa: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileSkill {
  id: string;
  user_id: string;
  name: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert' | null;
  category: string;
  created_at: string;
  updated_at: string;
}

interface State<T> { data: T[]; loading: boolean; error: string | null; }

export function useProfileCollections() {
  const supabase = useMemo(() => createClient(), []);
  const { success, error: toastError } = useToast();
  const [userId, setUserId] = useState<string | null>(null);

  const [experiences, setExperiences] = useState<State<ProfileExperience>>({ data: [], loading: false, error: null });
  const [education, setEducation] = useState<State<ProfileEducation>>({ data: [], loading: false, error: null });
  const [skills, setSkills] = useState<State<ProfileSkill>>({ data: [], loading: false, error: null });

  // fetch user id
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const uid = (data as any)?.user?.id ?? null;
        if (active) setUserId(uid);
      } catch { if (active) setUserId(null); }
    })();
    return () => { active = false; };
  }, [supabase]);

  const fetchExperiences = useCallback(async () => {
    if (!userId) return;
    setExperiences(s => ({ ...s, loading: true, error: null }));
    try {
      const { data, error } = await supabase
        .from('profile_experiences')
        .select('*')
        .eq('user_id', userId)
        .order('start_date', { ascending: false });
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
      const { data, error } = await supabase
        .from('profile_education')
        .select('*')
        .eq('user_id', userId)
        .order('start_date', { ascending: false });
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
      const { data, error } = await supabase
        .from('profile_skills')
        .select('*')
        .eq('user_id', userId)
        .order('name');
      if (error) throw error;
      setSkills({ data: data || [], loading: false, error: null });
    } catch (e: any) {
      setSkills(s => ({ ...s, loading: false, error: e.message || 'Failed to load skills' }));
    }
  }, [supabase, userId]);

  // initial fetch
  useEffect(() => { if (userId) { fetchExperiences(); fetchEducation(); fetchSkills(); } }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // realtime subscriptions
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
  const addExperience = useCallback(async (payload: Partial<ProfileExperience>) => {
    if (!userId) return;
    try {
      const insert = { ...payload, user_id: userId } as any;
      delete insert.id;
      const { error } = await supabase.from('profile_experiences').insert(insert);
      if (error) throw error;
      success('Experience added');
    } catch (e: any) { toastError('Add failed', e.message); }
  }, [supabase, userId, success, toastError]);

  const updateExperience = useCallback(async (id: string, patch: Partial<ProfileExperience>) => {
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

  const addEducation = useCallback(async (payload: Partial<ProfileEducation>) => {
    if (!userId) return;
    try {
      const insert = { ...payload, user_id: userId } as any; delete insert.id;
      const { error } = await supabase.from('profile_education').insert(insert);
      if (error) throw error;
      success('Education added');
    } catch (e: any) { toastError('Add failed', e.message); }
  }, [supabase, userId, success, toastError]);

  const updateEducation = useCallback(async (id: string, patch: Partial<ProfileEducation>) => {
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

  const addSkill = useCallback(async (payload: Partial<ProfileSkill>) => {
    if (!userId) return;
    try {
      const insert = { ...payload, user_id: userId } as any; delete insert.id;
      const { error } = await supabase.from('profile_skills').insert(insert);
      if (error) throw error;
      success('Skill added');
    } catch (e: any) { toastError('Add failed', e.message); }
  }, [supabase, userId, success, toastError]);

  const updateSkill = useCallback(async (id: string, patch: Partial<ProfileSkill>) => {
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

  return {
    userId,
    experiences, education, skills,
    refresh: () => { fetchExperiences(); fetchEducation(); fetchSkills(); },
    addExperience, updateExperience, deleteExperience,
    addEducation, updateEducation, deleteEducation,
    addSkill, updateSkill, deleteSkill,
  } as const;
}
