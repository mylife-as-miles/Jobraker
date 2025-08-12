import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '../lib/supabaseClient';
import { useToast } from '../components/ui/toast';

export type NotificationType = 'interview' | 'application' | 'system' | 'company';

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  company: string | null;
  read: boolean;
  created_at: string;
}

export function useNotifications(limit: number = 10) {
  const supabase = useMemo(() => createClient(), []);
  const { error: toastError } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // resolve user id
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

  const fetchItems = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      setItems(data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load notifications');
      setItems([]);
    } finally { setLoading(false); }
  }, [supabase, userId, limit]);

  useEffect(() => { if (userId) fetchItems(); }, [userId, fetchItems]);

  // realtime subscription
  useEffect(() => {
    if (!userId) return;
    const channel = (supabase as any)
      .channel(`notifications:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload: any) => {
        const { eventType } = payload;
        if (eventType === 'INSERT') {
          setItems(prev => [payload.new, ...prev].slice(0, limit));
        } else if (eventType === 'UPDATE') {
          setItems(prev => prev.map(n => n.id === payload.new.id ? payload.new : n));
        } else if (eventType === 'DELETE') {
          setItems(prev => prev.filter(n => n.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { try { (supabase as any).removeChannel(channel); } catch {} };
  }, [supabase, userId, limit]);

  // CRUD helpers
  const add = useCallback(async (row: Omit<NotificationRow, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase.from('notifications').insert(row as any).select('*').single();
      if (error) throw error;
      setItems(prev => [data as any, ...prev].slice(0, limit));
      return data as any as NotificationRow;
    } catch (e: any) { toastError('Create failed', e.message); throw e; }
  }, [supabase, limit, toastError]);

  const markRead = useCallback(async (id: string, read: boolean = true) => {
    try {
      const { data, error } = await supabase.from('notifications').update({ read }).eq('id', id).select('*').single();
      if (error) throw error;
      setItems(prev => prev.map(n => n.id === id ? (data as any) : n));
    } catch (e: any) { toastError('Update failed', e.message); throw e; }
  }, [supabase, toastError]);

  const remove = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) throw error;
      setItems(prev => prev.filter(n => n.id !== id));
    } catch (e: any) { toastError('Delete failed', e.message); throw e; }
  }, [supabase, toastError]);

  const markAllRead = useCallback(async () => {
    try {
      if (!userId) return;
      const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
      if (error) throw error;
      setItems(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e: any) { toastError('Update failed', e.message); throw e; }
  }, [supabase, userId, toastError]);

  return { items, loading, error, refresh: fetchItems, add, markRead, markAllRead, remove } as const;
}
