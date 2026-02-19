import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabaseClient';

interface JobSearchLimits {
  canSearch: boolean;
  currentCount: number;
  limit: number;
  remaining: number;
  tier: 'Free' | 'Pro' | 'Ultimate';
  resetDate: string;
}

export const useJobSearchLimits = () => {
  const [limits, setLimits] = useState<JobSearchLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  const fetchLimits = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) {
        setLoading(false);
        return;
      }

      // Call the can_search_jobs function
      const { data, error } = await supabase.rpc('can_search_jobs', {
        p_user_id: userId
      });

      if (error) {
        console.error('Error checking job search limits:', error);
      } else if (data) {
        setLimits({
          canSearch: data.can_search,
          currentCount: data.current_count,
          limit: data.limit,
          remaining: data.remaining,
          tier: data.tier,
          resetDate: data.reset_date
        });
      }
    } catch (error) {
      console.error('Error fetching job search limits:', error);
    } finally {
      setLoading(false);
    }
  };

  const incrementSearchCount = async (jobCount: number = 1) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) return;

      const { data, error } = await supabase.rpc('increment_job_search_count', {
        p_user_id: userId,
        p_job_count: jobCount
      });

      if (error) {
        console.error('Error incrementing job search count:', error);
      } else {
        // Refresh limits after incrementing
        await fetchLimits();
      }

      return data;
    } catch (error) {
      console.error('Error incrementing job search count:', error);
    }
  };

  useEffect(() => {
    fetchLimits();
  }, []);

  return {
    limits,
    loading,
    refetch: fetchLimits,
    incrementSearchCount
  };
};
