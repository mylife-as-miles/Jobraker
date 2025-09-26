import { useCallback, useEffect, useRef, useState } from 'react';
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
  // Optional fields added by later migration
  is_starred?: boolean | null;
  action_url?: string | null;
  priority?: 'low' | 'medium' | 'high';
  seen_at?: string | null;
  created_at: string;
}

export function useNotifications(limit: number = 10) {
  const supabase = createClient();
  const { error: toastError, warning, info } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  // Feature capability flags (in case migration not applied yet)
  const [supportsStar, setSupportsStar] = useState(true);
  const [supportsPriority] = useState(true); // reserved for future conditional UI, setter removed to avoid unused var
  const [supportsSeen, setSupportsSeen] = useState(true);

  // Resolve user id
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
      const rows = (data || []) as NotificationRow[];
      setItems(rows);
      setHasMore(rows.length === limit);
    } catch (e: any) {
      setError(e.message || 'Failed to load notifications');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId, limit]);

  useEffect(() => { if (userId) fetchItems(); }, [userId, fetchItems]);

  // Track first load to avoid toasting historical items
  const initialLoadRef = useRef(true);
  useEffect(() => { initialLoadRef.current = true; }, [userId]);

  // realtime subscription with toast feedback
  useEffect(() => {
    if (!userId) return;
    const channel = (supabase as any)
      .channel(`notifications:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload: any) => {
        const { eventType } = payload;
        if (eventType === 'INSERT') {
          const inserted = payload.new as NotificationRow;
            // Push new item local state
          setItems(prev => [inserted, ...prev].slice(0, limit));
          // Only toast if not part of the initial hydration
          if (!initialLoadRef.current) {
            if (inserted.priority === 'high') {
              warning?.(inserted.title || 'High priority notification', inserted.message || undefined, 6000);
            } else if (inserted.priority === 'medium') {
              info?.(inserted.title || 'New notification', inserted.message || undefined, 4500);
            }
          }
        } else if (eventType === 'UPDATE') {
          setItems(prev => prev.map(n => n.id === payload.new.id ? (payload.new as NotificationRow) : n));
        } else if (eventType === 'DELETE') {
          setItems(prev => prev.filter(n => n.id !== payload.old.id));
        }
      })
      .subscribe();
    // After a small delay mark initial load complete so subsequent inserts toast
    const t = setTimeout(() => { initialLoadRef.current = false; }, 1000);
    return () => { try { (supabase as any).removeChannel(channel); } catch {} clearTimeout(t); };
  }, [supabase, userId, limit, warning, info]);

  // Listen for local optimistic creation events (in case realtime not yet delivered)
  useEffect(() => {
    function onLocalInsert(ev: Event) {
      const detail: any = (ev as CustomEvent).detail;
      if (!detail || !detail.id) return;
      if (detail.user_id !== userId) return;
      setItems(prev => {
        if (prev.some(n => n.id === detail.id)) return prev; // already present (maybe via realtime)
        return [detail as NotificationRow, ...prev].slice(0, limit);
      });
    }
    window.addEventListener('notification:insert', onLocalInsert as EventListener);
    return () => window.removeEventListener('notification:insert', onLocalInsert as EventListener);
  }, [userId, limit]);

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

  const bulkMarkRead = useCallback(async (ids: string[], read: boolean) => {
    try {
      if (!ids.length) return;
      const { error } = await supabase.from('notifications').update({ read }).in('id', ids);
      if (error) throw error;
      setItems(prev => prev.map(n => ids.includes(n.id) ? { ...n, read } : n));
    } catch (e: any) { toastError('Update failed', e.message); throw e; }
  }, [supabase, toastError]);

  const bulkRemove = useCallback(async (ids: string[]) => {
    try {
      if (!ids.length) return;
      const { error } = await supabase.from('notifications').delete().in('id', ids);
      if (error) throw error;
      setItems(prev => prev.filter(n => !ids.includes(n.id)));
    } catch (e: any) { toastError('Delete failed', e.message); throw e; }
  }, [supabase, toastError]);

  const bulkStar = useCallback(async (ids: string[], is_starred: boolean) => {
    try {
      if (!ids.length) return;
      const { error } = await supabase.from('notifications').update({ is_starred }).in('id', ids);
      if (error) throw error;
      setItems(prev => prev.map(n => ids.includes(n.id) ? { ...n, is_starred } : n));
    } catch (e: any) {
      const msg = String(e?.message || '');
      const code = e?.code;
      // Handle missing column error (migration not applied yet)
      if (code === '42703' || /column \"?is_starred\"? does not exist/i.test(msg)) {
        setSupportsStar(false);
        toastError('Star feature unavailable', 'Update your database to enable starring notifications.');
        return;
      }
      toastError('Update failed', e.message);
      throw e;
    }
  }, [supabase, toastError]);

  const toggleStar = useCallback(async (id: string) => {
    const current = items.find(n => n.id === id);
    if (!current) return;
    await bulkStar([id], !(current.is_starred ?? false));
  }, [items, bulkStar]);

  const markSeen = useCallback(async (id: string) => {
    try {
      const { data, error } = await supabase.from('notifications').update({ seen_at: new Date().toISOString() }).eq('id', id).select('*').single();
      if (error) throw error;
      setItems(prev => prev.map(n => n.id === id ? (data as any) : n));
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (/column "?seen_at"? does not exist/i.test(msg)) {
        setSupportsSeen(false);
        return;
      }
      toastError('Update failed', e.message);
    }
  }, [supabase, toastError]);

  // Batched markSeen to avoid spamming API when scrolling fast
  const pendingSeenRef = useRef<Set<string>>(new Set());
  const flushSeenRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushSeen = useCallback(async () => {
    const ids = Array.from(pendingSeenRef.current);
    if (!ids.length) return;
    pendingSeenRef.current.clear();
    flushSeenRef.current && clearTimeout(flushSeenRef.current);
    flushSeenRef.current = null;
    try {
      const ts = new Date().toISOString();
      const { error } = await supabase.from('notifications').update({ seen_at: ts }).in('id', ids).is('seen_at', null);
      if (error) throw error;
      setItems(prev => prev.map(n => ids.includes(n.id) ? { ...n, seen_at: n.seen_at ?? ts } : n));
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (/column "?seen_at"? does not exist/i.test(msg)) {
        setSupportsSeen(false);
        return;
      }
      toastError('Update failed', e.message);
    }
  }, [supabase, toastError]);

  const markSeenMany = useCallback((ids: string[]) => {
    if (!ids.length || !supportsSeen) return;
    ids.forEach(id => pendingSeenRef.current.add(id));
    if (!flushSeenRef.current) {
      flushSeenRef.current = setTimeout(flushSeen, 180); // debounce window
    }
  }, [flushSeen, supportsSeen]);

  // Cleanup on unmount
  useEffect(() => () => { if (flushSeenRef.current) clearTimeout(flushSeenRef.current); }, []);

  const loadMore = useCallback(async () => {
    if (!userId || !hasMore) return;
    try {
      const from = items.length;
      const to = from + limit - 1;
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);
      if (error) throw error;
      const rows = (data || []) as NotificationRow[];
      setItems(prev => [...prev, ...rows]);
      setHasMore(rows.length === limit);
    } catch (e: any) { toastError('Load more failed', e.message); }
  }, [supabase, userId, items.length, limit, hasMore, toastError]);

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

  return {
    items,
    loading,
    error,
    hasMore,
    supportsStar,
    supportsPriority,
    supportsSeen,
    loadMore,
    refresh: fetchItems,
    add,
    markRead,
    bulkMarkRead,
    toggleStar,
    markAllRead,
    remove,
    bulkRemove,
    markSeen,
    markSeenMany,
  } as const;
}
