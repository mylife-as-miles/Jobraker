import { useEffect, useRef, useState, useCallback } from 'react';
import { getRun, SkyvernRunSubset } from '../services/skyvern/getRun';

export interface UseSkyvernRunOptions {
  intervalMs?: number; // polling interval
  stopStatuses?: string[]; // statuses at which to stop
  enabled?: boolean;
  raw?: boolean;
}

export interface UseSkyvernRunResult {
  run: SkyvernRunSubset | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  status: string | null;
  isFinished: boolean;
}

const DEFAULT_STOP = ['succeeded', 'failed', 'error', 'cancelled', 'completed'];

export function useSkyvernRun(run_id: string | null | undefined, opts: UseSkyvernRunOptions = {}): UseSkyvernRunResult {
  const { intervalMs = 5000, stopStatuses = DEFAULT_STOP, enabled = true, raw = false } = opts;
  const [run, setRun] = useState<SkyvernRunSubset | null>(null);
  const [loading, setLoading] = useState<boolean>(!!run_id);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const status = run?.status || null;
  const isFinished = status ? stopStatuses.map(s => s.toLowerCase()).includes(status.toLowerCase()) : false;

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const fetchRun = useCallback(async () => {
    if (!run_id || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getRun(run_id, { raw });
      if (!res.ok) throw new Error(res.error || 'Run fetch failed');
      setRun(res.run);
    } catch (e: any) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [run_id, enabled, raw]);

  const schedule = useCallback(() => {
    clearTimer();
    if (!run_id || !enabled) return;
    if (isFinished) return; // stop polling
    timerRef.current = window.setTimeout(async () => {
      await fetchRun();
    }, intervalMs) as any;
  }, [run_id, enabled, intervalMs, fetchRun, isFinished]);

  useEffect(() => {
    if (!run_id || !enabled) return;
    fetchRun();
    return () => clearTimer();
  }, [run_id, enabled, fetchRun]);

  useEffect(() => {
    if (loading) return; // wait for current fetch
    if (isFinished) {
      clearTimer();
      return;
    }
    schedule();
    return () => clearTimer();
  }, [status, loading, isFinished, schedule]);

  return { run, loading, error, refresh: fetchRun, status, isFinished };
}
