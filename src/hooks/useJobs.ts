import { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '../lib/supabaseClient';
import { createNotification, createBulkSummaryNotification } from '../utils/notifications';

export interface Job {
  id: string;
  user_id: string;
  source_type: string;
  source_id: string;
  title: string;
  company: string;
  description?: string;
  location?: string;
  remote_type?: string;
  employment_type?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency: string;
  experience_level?: string;
  tags?: string[];
  apply_url?: string;
  posted_at?: string;
  expires_at?: string;
  status: string;
  notes?: string;
  rating?: number;
  bookmarked: boolean;
  raw_data?: any;
  created_at: string;
  updated_at: string;
}

export function useJobs() {
  const supabase = useMemo(() => createClient(), []);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real-time subscription
  useEffect(() => {
    let subscription: any;
    let userId: string | null = null;
    const insertedJobIds = new Set<string>();
    const insertedCounterRef = useRef<{ date: string; count: number }>({ date: new Date().toISOString().slice(0,10), count: 0 });
    const dailySummarySentRef = useRef<string | null>(null);

    const fetchJobs = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }
        userId = user.id;

        const { data: jobsData, error: fetchError } = await supabase
          .from('user_jobs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (fetchError) {
          throw fetchError;
        }

        setJobs(jobsData || []);
        // Initial daily summary (jobs found today)
        if (userId && jobsData && jobsData.length) {
          const today = new Date().toISOString().slice(0,10);
            if (dailySummarySentRef.current !== today) {
            const todaysCount = jobsData.filter(j => (j.created_at || '').slice(0,10) === today).length;
            if (todaysCount > 0) {
              dailySummarySentRef.current = today;
              createBulkSummaryNotification(userId, todaysCount, 'jobs found today');
            }
          }
        }
      } catch (err: any) {
        console.error('Error fetching jobs:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();

    // Set up real-time subscription
    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;

      subscription = supabase
        .channel('user_jobs')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_jobs',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Jobs updated:', payload);
            if (payload.eventType === 'INSERT') {
              setJobs(prev => [payload.new as Job, ...prev]);
              // Activity notification (single new job)
              if (userId && payload.new && !insertedJobIds.has(payload.new.id)) {
                insertedJobIds.add(payload.new.id);
                createNotification({
                  user_id: userId,
                  type: 'company',
                  title: `New job: ${payload.new.title}`,
                  message: `${payload.new.title} @ ${payload.new.company}`,
                  company: payload.new.company,
                  action_url: payload.new.apply_url ?? undefined,
                });
                // Daily summary batch counter
                const today = new Date().toISOString().slice(0,10);
                if (insertedCounterRef.current.date !== today) {
                  insertedCounterRef.current = { date: today, count: 0 };
                }
                insertedCounterRef.current.count += 1;
                if (insertedCounterRef.current.count % 5 === 0) {
                  createBulkSummaryNotification(userId, insertedCounterRef.current.count, 'jobs today');
                }
              }
            } else if (payload.eventType === 'UPDATE') {
              setJobs(prev => prev.map(job => 
                job.id === payload.new.id ? payload.new as Job : job
              ));
            } else if (payload.eventType === 'DELETE') {
              setJobs(prev => prev.filter(job => job.id !== payload.old.id));
            }
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [supabase]);

  // Update job status
  const updateJobStatus = async (jobId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('user_jobs')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', jobId);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error updating job status:', err);
      throw err;
    }
  };

  // Toggle bookmark
  const toggleBookmark = async (jobId: string, bookmarked: boolean) => {
    try {
      const { error } = await supabase
        .from('user_jobs')
        .update({ bookmarked, updated_at: new Date().toISOString() })
        .eq('id', jobId);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error toggling bookmark:', err);
      throw err;
    }
  };

  // Add notes to job
  const updateJobNotes = async (jobId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('user_jobs')
        .update({ notes, updated_at: new Date().toISOString() })
        .eq('id', jobId);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error updating job notes:', err);
      throw err;
    }
  };

  // Rate job
  const rateJob = async (jobId: string, rating: number) => {
    try {
      const { error } = await supabase
        .from('user_jobs')
        .update({ rating, updated_at: new Date().toISOString() })
        .eq('id', jobId);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error rating job:', err);
      throw err;
    }
  };

  return {
    jobs,
    loading,
    error,
    updateJobStatus,
    toggleBookmark,
    updateJobNotes,
    rateJob
  };
}
