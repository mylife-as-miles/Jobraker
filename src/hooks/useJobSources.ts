import { useState, useEffect, useMemo } from 'react';
import { createClient } from '../lib/supabaseClient';
import { createNotification } from '../utils/notifications';

export interface JobSource {
  id: string;
  user_id: string;
  type: 'remotive' | 'remoteok' | 'arbeitnow' | 'linkedin' | 'indeed' | 'feedcoyote' | 'trulyremote' | 'remoteco' | 'jobspresso' | 'skipthedrive' | 'json' | 'deepresearch';
  name: string;
  enabled: boolean;
  config: {
    query?: string;
    url?: string;
    workType?: string[];
    location?: string;
    salaryRange?: string;
    experienceLevel?: string;
    maxResults?: number;
  };
  last_run_at?: string;
  jobs_found?: number;
  created_at: string;
  updated_at: string;
}

export interface JobSourceSettings {
  id: string; // This is the user_id in the existing table
  cron_enabled?: boolean;
  cron_expression?: string;
  firecrawl_api_key?: string;
  notification_enabled?: boolean;
  sources?: JobSource[];
  include_linkedin?: boolean;
  include_indeed?: boolean;
  include_search?: boolean;
  allowed_domains?: string[];
  enabled_sources?: string[];
  created_at?: string;
  updated_at: string;
}

export function useJobSources() {
  const supabase = useMemo(() => createClient(), []);
  const [settings, setSettings] = useState<JobSourceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real-time subscription
  useEffect(() => {
    let subscription: any;

    const fetchJobSources = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Try to get existing settings
        const { data: existingSettings, error: fetchError } = await supabase
          .from('job_source_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError;
        }

        if (existingSettings) {
          setSettings(existingSettings);
        } else {
          // Create default settings
          const defaultSettings = {
            user_id: user.id,
            cron_enabled: false,
            cron_expression: '0 */6 * * *', // Every 6 hours
            notification_enabled: true,
            sources: [
              {
                id: crypto.randomUUID(),
                user_id: user.id,
                type: 'linkedin' as const,
                name: 'LinkedIn Jobs',
                enabled: true,
                config: { query: 'software engineer' },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              },
              {
                id: crypto.randomUUID(),
                user_id: user.id,
                type: 'indeed' as const,
                name: 'Indeed Jobs',
                enabled: false,
                config: { query: 'full stack developer' },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
            ],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const { data: newSettings, error: createError } = await supabase
            .from('job_source_settings')
            .insert(defaultSettings)
            .select()
            .single();

          if (createError) throw createError;
          setSettings(newSettings);
        }
      } catch (err: any) {
        console.error('Error fetching job sources:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchJobSources();

    // Set up real-time subscription
    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      subscription = supabase
        .channel('job_source_settings')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'job_source_settings',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Job sources updated:', payload);
            if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
              setSettings(payload.new as JobSourceSettings);
            } else if (payload.eventType === 'DELETE') {
              setSettings(null);
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

  // Add a new job source
  const addJobSource = async (sourceData: Omit<JobSource, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !settings) throw new Error('Not authenticated or no settings');

      const newSource: JobSource = {
        id: crypto.randomUUID(),
        user_id: user.id,
        ...sourceData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const currentSources = settings.sources || [];
      const updatedSettings = {
        ...settings,
        sources: [...currentSources, newSource],
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('job_source_settings')
        .update(updatedSettings)
        .eq('user_id', user.id);

      if (error) throw error;
      // Activity notification
      createNotification({
        user_id: user.id,
        type: 'system',
        title: `Job source added: ${newSource.name}`,
        message: `${newSource.type} source enabled`,
      });
      return newSource;
    } catch (err: any) {
      console.error('Error adding job source:', err);
      throw err;
    }
  };

  // Update a job source
  const updateJobSource = async (sourceId: string, updates: Partial<JobSource>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !settings) throw new Error('Not authenticated or no settings');

      const currentSources = settings.sources || [];
      const updatedSources = currentSources.map(source =>
        source.id === sourceId
          ? { ...source, ...updates, updated_at: new Date().toISOString() }
          : source
      );

      const updatedSettings = {
        ...settings,
        sources: updatedSources,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('job_source_settings')
        .update(updatedSettings)
        .eq('user_id', user.id);

      if (error) throw error;
      const changed = Object.keys(updates).filter(k => k !== 'updated_at');
      if (changed.length) {
        createNotification({
          user_id: user.id,
          type: 'system',
          title: 'Job source updated',
          message: `${changed.slice(0,4).join(', ')} ${changed.length>4?`(+${changed.length-4} more)`:''}`,
        });
      }
    } catch (err: any) {
      console.error('Error updating job source:', err);
      throw err;
    }
  };

  // Remove a job source
  const removeJobSource = async (sourceId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !settings) throw new Error('Not authenticated or no settings');

      const currentSources = settings.sources || [];
      const updatedSources = currentSources.filter(source => source.id !== sourceId);

      const updatedSettings = {
        ...settings,
        sources: updatedSources,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('job_source_settings')
        .update(updatedSettings)
        .eq('user_id', user.id);

      if (error) throw error;
      const removed = currentSources.find(s => s.id === sourceId);
      if (removed) {
        createNotification({
          user_id: user.id,
          type: 'system',
          title: `Job source removed: ${removed.name}`,
          message: removed.type,
        });
      }
    } catch (err: any) {
      console.error('Error removing job source:', err);
      throw err;
    }
  };

  // Update global settings
  const updateSettings = async (updates: Partial<JobSourceSettings>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !settings) throw new Error('Not authenticated or no settings');

      const updatedSettings = {
        ...settings,
        ...updates,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('job_source_settings')
        .update(updatedSettings)
        .eq('user_id', user.id);

      if (error) throw error;
      const changed = Object.keys(updates).filter(k => k !== 'updated_at');
      if (changed.length) {
        createNotification({
          user_id: user.id,
          type: 'system',
          title: 'Job source settings updated',
          message: changed.slice(0,5).join(', '),
        });
      }
    } catch (err: any) {
      console.error('Error updating settings:', err);
      throw err;
    }
  };

  // Trigger job scraping manually
  const triggerJobScraping = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Call the Supabase Edge Function for job scraping
      const { data, error } = await supabase.functions.invoke('jobs-cron', {
        body: {
          user_id: user.id,
          manual_trigger: true
        }
      });

      if (error) throw error;
      // Attempt to derive count of new jobs from response structure
      let count: number | null = null;
      if (data && typeof data === 'object') {
        const candKeys = ['jobs_added','jobs_found','count','new_jobs'];
        for (const k of candKeys) {
          if (typeof (data as any)[k] === 'number') { count = (data as any)[k]; break; }
        }
      }
      if (count && user.id) {
        createNotification({
          user_id: user.id,
          type: 'system',
          title: `Job search completed (${count})`,
          message: `Found ${count} potential jobs across enabled sources.`,
        });
      } else {
        createNotification({
          user_id: user.id,
          type: 'system',
          title: 'Job search triggered',
          message: 'Your job sources are being scanned now.',
        });
      }
      return data;
    } catch (err: any) {
      console.error('Error triggering job scraping:', err);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          createNotification({
            user_id: user.id,
            type: 'system',
            title: 'Job search failed',
            message: err.message?.slice(0, 500) || 'Unknown error',
          });
        }
      } catch {}
      throw err;
    }
  };

  return {
    settings,
    loading,
    error,
    addJobSource,
    updateJobSource,
    removeJobSource,
    updateSettings,
    triggerJobScraping
  };
}
