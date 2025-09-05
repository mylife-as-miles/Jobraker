import { useState, useEffect, useMemo } from 'react';
import { createClient } from '../lib/supabaseClient';

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

    const fetchJobs = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: jobsData, error: fetchError } = await supabase
          .from('user_jobs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (fetchError) {
          throw fetchError;
        }

        setJobs(jobsData || []);
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
