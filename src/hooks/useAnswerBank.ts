import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '../lib/supabaseClient';
import { useToast } from '../components/ui/toast';

export type AnswerTheme = 'identity' | 'beliefs' | 'stories' | 'career' | 'skills' | 'voice';

export interface AnswerBankEntry {
  id: string;
  user_id: string;
  theme: AnswerTheme;
  slug: string;
  question: string;
  tags: string[];
  body: string;
  created_at: string;
  updated_at: string;
}

interface State<T> { data: T[]; loading: boolean; error: string | null; }

export function useAnswerBank() {
  const supabase = useMemo(() => createClient(), []);
  const { success, error: toastError } = useToast();
  const [userId, setUserId] = useState<string | null>(null);

  const [answers, setAnswers] = useState<State<AnswerBankEntry>>({ data: [], loading: false, error: null });

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

  const fetchAnswers = useCallback(async () => {
    if (!userId) return;
    setAnswers(s => ({ ...s, loading: true, error: null }));
    try {
      const { data, error } = await supabase
        .from('answer_bank')
        .select('*')
        .eq('user_id', userId)
        .order('theme')
        .order('slug');
      if (error) throw error;
      setAnswers({ data: data || [], loading: false, error: null });
    } catch (e: any) {
      setAnswers(s => ({ ...s, loading: false, error: e.message || 'Failed to load Answer Bank entries' }));
    }
  }, [supabase, userId]);

  // initial fetch
  useEffect(() => { if (userId) { fetchAnswers(); } }, [userId, fetchAnswers]);

  // realtime subscriptions
  useEffect(() => {
    if (!userId) return;
    const channel = (supabase as any)
      .channel(`answer_bank:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'answer_bank', filter: `user_id=eq.${userId}` }, () => fetchAnswers())
      .subscribe();
    return () => {
      try { (supabase as any).removeChannel(channel); } catch {}
    };
  }, [supabase, userId, fetchAnswers]);

  // CRUD helpers
  const addAnswer = useCallback(async (payload: Partial<AnswerBankEntry>) => {
    if (!userId) return;
    try {
      const insert = { ...payload, user_id: userId } as any;
      delete insert.id;
      const { error } = await supabase.from('answer_bank').insert(insert);
      if (error) throw error;
      success('Answer entry added');
    } catch (e: any) { toastError('Add failed', e.message); }
  }, [supabase, userId, success, toastError]);

  const updateAnswer = useCallback(async (id: string, patch: Partial<AnswerBankEntry>) => {
    try {
      const { error } = await supabase.from('answer_bank').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      success('Answer entry updated');
    } catch (e: any) { toastError('Update failed', e.message); }
  }, [supabase, success, toastError]);

  const deleteAnswer = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('answer_bank').delete().eq('id', id);
      if (error) throw error;
      success('Answer entry removed');
    } catch (e: any) { toastError('Delete failed', e.message); }
  }, [supabase, success, toastError]);

  const generateAnswers = useCallback(async (payload?: {
    themes?: AnswerTheme[];
    limit?: number;
    replaceExisting?: boolean;
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-answer-bank', {
        body: {
          themes: payload?.themes,
          limit: payload?.limit,
          replace_existing: payload?.replaceExisting === true,
        },
      });
      if (error) throw error;
      const inserted = Number((data as any)?.inserted ?? 0);
      const updated = Number((data as any)?.updated ?? 0);
      success(
        'Answer Bank refreshed',
        inserted || updated
          ? `${inserted} added, ${updated} updated`
          : 'No new entries were generated',
      );
      return data;
    } catch (e: any) {
      toastError('Generation failed', e.message || 'Could not generate Answer Bank entries');
      throw e;
    }
  }, [supabase, success, toastError]);

  return {
    userId,
    answers,
    refresh: fetchAnswers,
    addAnswer,
    updateAnswer,
    deleteAnswer,
    generateAnswers,
  } as const;
}
