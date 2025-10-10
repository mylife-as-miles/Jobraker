import { Briefcase, Search, MapPin, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Switch } from "../../../components/ui/switch";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { motion } from "framer-motion";
import { createClient } from "../../../lib/supabaseClient";
import { useProfileSettings } from "../../../hooks/useProfileSettings";
import { events } from "../../../lib/analytics";
import { useToast } from "../../../components/ui/toast";

// The Job interface now represents a row from our personal 'jobs' table.
interface Job {
  id: string; // This will be the DB UUID
  title: string;
  company: string;
  description: string | null;
  location: string | null;
  remote_type: string | null;
  apply_url: string | null;
  posted_at: string | null;
  raw_data?: any;
  logoUrl?: string;
  logo: string;
  status?: string;
  source_type?: string | null;
  source_id?: string | null;
}

const supabase = createClient();

const getCompanyLogoUrl = (companyName?: string, sourceUrl?: string): string | undefined => {
    if (!companyName) return undefined;
    try {
        const domain = new URL(sourceUrl || `https://www.${companyName.toLowerCase().replace(/\s/g, '')}.com`).hostname;
        return `https://logo.clearbit.com/${domain}`;
    } catch {
        return undefined;
    }
};

// Helper to map a DB row from the `jobs` table to the frontend `Job` interface
const mapDbJobToUiJob = (dbJob: any): Job => {
    return {
      ...dbJob,
      id: dbJob.id,
      description: dbJob.description || dbJob.raw_data?.fullJobDescription || '',
      logoUrl: dbJob.raw_data?.companyLogoUrl || getCompanyLogoUrl(dbJob.company, dbJob.apply_url),
      logo: dbJob.company?.[0]?.toUpperCase() || '?',
      status: dbJob.status,
      source_type: dbJob.source_type ?? null,
      source_id: dbJob.source_id ?? null,
    };
  };

const sanitizeHtml = (html: string) => {
    if (!html) return "";
    let out = String(html);
    out = out.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
    out = out.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");
    out = out.replace(/href\s*=\s*(["'])javascript:[^"']*\1/gi, 'href="#"');
    out = out.replace(/ on[a-z]+\s*=\s*(["']).*?\1/gi, "");
    return out;
};

export const JobPage = (): JSX.Element => {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedLocation, setSelectedLocation] = useState("Remote");
    const [selectedJob, setSelectedJob] = useState<string | null>(null);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [queueStatus, setQueueStatus] = useState<'idle' | 'loading' | 'populating' | 'ready' | 'empty'>('loading');
    const [error, setError] = useState<{ message: string, link?: string } | null>(null);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  // Incremental run state
  const [incrementalMode, setIncrementalMode] = useState(false);
  const [incrementalCanceled, setIncrementalCanceled] = useState(false);
  const [insertedThisRun, setInsertedThisRun] = useState(0);
  const [runUrls, setRunUrls] = useState<string[] | null>(null);
  const [currentSource, setCurrentSource] = useState<string | null>(null);
  const [lastReason, setLastReason] = useState<string | null>(null);
    const [debugMode, setDebugMode] = useState(false);
    const [logoError, setLogoError] = useState<Record<string, boolean>>({});
    const [currentPage] = useState(1); // (Pagination placeholder; future enhancement)
    const [pageSize] = useState(10);
    const [applyingAll, setApplyingAll] = useState(false);
    const [applyProgress, setApplyProgress] = useState({ done: 0, total: 0, success: 0, fail: 0 });
  const [relaxSchema, setRelaxSchema] = useState(false);
    const [remoteOnly, setRemoteOnly] = useState(false);
    const [recentOnly, setRecentOnly] = useState(false);
  // Runs are initiated via jobs-search; no special flag needed

  // Debug payload capture for in-app panel
  const [dbgSearchReq, setDbgSearchReq] = useState<any>(null);
  const [dbgSearchRes, setDbgSearchRes] = useState<any>(null);
  const [dbgPMReq, setDbgPMReq] = useState<any>(null);
  const [dbgPMRes, setDbgPMRes] = useState<any>(null);
  const [dbgStatus, setDbgStatus] = useState<any>(null);

  const { profile, loading: profileLoading } = useProfileSettings();
  const { info } = useToast();
  // Toast dedupe/throttle: avoid spamming repeated toasts
  const lastToastRef = useRef<{ msg: string; ts: number } | null>(null);
  const safeInfo = useCallback((msg: string, desc?: string, cooldownMs: number = 20000) => {
    const now = Date.now();
    const last = lastToastRef.current;
    if (last && last.msg === (desc ? `${msg}::${desc}` : msg) && now - last.ts < cooldownMs) {
      return; // suppress duplicate within cooldown window
    }
    info(msg, desc);
    lastToastRef.current = { msg: desc ? `${msg}::${desc}` : msg, ts: now };
  }, [info]);
  // Error dedupe to avoid flicker and repeated inline banners
  const lastErrorRef = useRef<{ msg: string; ts: number } | null>(null);
  const setErrorDedup = useCallback((payload: { message: string, link?: string } | null, cooldownMs: number = 15000) => {
    if (!payload) { setError(null); return; }
    const now = Date.now();
    const last = lastErrorRef.current;
    const key = payload.link ? `${payload.message}::${payload.link}` : payload.message;
    if (last && last.msg === key && now - last.ts < cooldownMs) return;
    setError(payload);
    lastErrorRef.current = { msg: key, ts: now };
  }, []);

  // Guard flags to prevent overlapping runs/requests
  const autoPopulatedRef = useRef(false);
  // Removed per-URL incremental loop; keep a simple flag if needed in future
  // const startInFlightRef = useRef(false);

    // Step-by-step loading banner
    const LoadingBanner = ({ subtitle, steps, activeStep, onCancel, foundCount }: { subtitle?: string; steps: string[]; activeStep: number; onCancel?: () => void; foundCount?: number }) => (
      <Card className="relative overflow-hidden bg-gradient-to-br from-[#0b0b0b] via-[#0f0f0f] to-[#0b0b0b] border border-[#1dff00]/30 p-4 sm:p-5 mb-4">
        {/* Soft radial glow backdrop */}
        <motion.div
          className="pointer-events-none absolute -inset-24 opacity-30"
          style={{ background: 'radial-gradient(600px 200px at 20% -10%, rgba(29,255,0,0.25), rgba(29,255,0,0) 60%)' }}
          initial={{ opacity: 0.15 }}
          animate={{ opacity: [0.15, 0.30, 0.15] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="flex items-center gap-3">
          {/* Radar pulse */}
          <div className="relative w-6 h-6">
            <span className="absolute inset-0 rounded-full bg-[#1dff00] opacity-70" />
            <motion.span
              className="absolute inset-0 rounded-full bg-[#1dff00]"
              initial={{ scale: 0.9, opacity: 0.75 }}
              animate={{ scale: [0.9, 1.25, 0.9], opacity: [0.75, 0.15, 0.75] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-medium flex items-center gap-2">
              <span>Building your results…</span>
              {typeof foundCount === 'number' && (
                <motion.span
                  key={foundCount}
                  initial={{ scale: 0.9, opacity: 0.6 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  className="text-[11px] px-2 py-0.5 rounded-full border border-[#1dff00]/40 text-[#1dff00] bg-[#1dff00]/10"
                >
                  Found {foundCount}
                </motion.span>
              )}
            </div>
            <div className="text-xs text-[#ffffff90]">{subtitle || 'This may take a few minutes depending on sources.'}</div>
          </div>
          {onCancel && (
            <Button variant="ghost" className="text-[#ffffffb3] hover:bg-[#ffffff12] border border-[#ffffff1e] h-8 px-3" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>

        {/* Steps with animated active pill */}
        <div className="mt-3 grid grid-cols-3 gap-3 relative">
          {steps.map((label, idx) => {
            const isActive = idx === activeStep;
            return (
              <div key={label} className={`relative flex items-center gap-2 rounded-md border p-2 ${isActive ? 'border-[#1dff00] bg-[#1dff00]/10' : 'border-[#ffffff18] bg-[#ffffff08]'}`}>
                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-[#1dff00]' : 'bg-[#ffffff40]'}`} aria-hidden />
                <div className={`text-[11px] truncate ${isActive ? 'text-[#eaffea]' : 'text-[#ffffff90]'}`}>{label}</div>
                {isActive && (
                  <motion.span
                    layoutId="activeStepGlow"
                    className="absolute inset-0 rounded-md"
                    style={{ boxShadow: '0 0 20px rgba(29,255,0,0.35) inset' }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Shimmering progress bar */}
        <div className="mt-3 h-1.5 bg-[#0f0f0f] rounded overflow-hidden border border-[#1dff00]/20">
          <motion.div
            className="h-full"
            style={{ background: 'linear-gradient(90deg, rgba(29,255,0,0.15) 0%, rgba(29,255,0,0.9) 50%, rgba(29,255,0,0.15) 100%)' }}
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ repeat: Infinity, duration: 1.25, ease: 'easeInOut' }}
            aria-hidden
          />
        </div>
      </Card>
    );

  const [stepIndex, setStepIndex] = useState(0);
    const steps = useMemo(() => [
      'Discovering sources',
      'Extracting',
      'Inserting'
    ], []);
    const getHost = (url?: string | null) => {
      if (!url) return '';
      try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
    };


    // Real step updates occur at key phases of the flow; no cycling needed now.

    // Steps reflect phases; no cancel/try-different actions per request

    const fetchJobQueue = useCallback(async (): Promise<Job[]> => {
        setQueueStatus('loading');
        setError(null);
        try {
          const { data, error: fetchError } = await supabase.functions.invoke('get-jobs');
          if (fetchError) throw new Error(fetchError.message);

          const jobList = (data.jobs || []).map(mapDbJobToUiJob);
          setJobs(jobList);

          if (jobList.length > 0) {
            setQueueStatus('ready');
            setSelectedJob(jobList[0].id);
          } else {
            setQueueStatus('empty');
          }
          return jobList; // Return the list for chaining
        } catch (e: any) {
          setError({ message: e.message });
          setQueueStatus('idle');
          return []; // Return empty array on error
        }
    }, [supabase]);

    const populateQueue = useCallback(async (query: string, location?: string) => {
      // Prevent re-entry if a run is active
      if (incrementalMode || pollingJobId) return;
      if (!query || !query.trim()) {
        setError({ message: 'Please enter a job title or keywords to search.' });
        return;
      }
      setQueueStatus('populating');
      setError(null);
      setLastReason(null);
      setPollingJobId(null);
      setStepIndex(0); // Discovering sources
      setIncrementalMode(true);
      setIncrementalCanceled(false);
      setInsertedThisRun(0);
  // reset per-run counters only
  // Reset counters for this run
  setInsertedThisRun(0);

      try {
        // Use backend jobs-search to discover curated sources (OpenAPI shape)
        safeInfo("Searching the web for sources…");
        const attemptInvoke = async (): Promise<any> => {
          const searchPayload = {
            searchQuery: query,
            location: location || 'Remote',  // Default to Remote for broader results
            relaxSchema,
            limit: 50,
          };
          if (debugMode) console.log('[debug] jobs-search request', searchPayload);
          setDbgSearchReq(searchPayload);
          const { data, error: invokeErr } = await supabase.functions.invoke('jobs-search', {
            body: searchPayload,
          });
          if (invokeErr) throw new Error(invokeErr.message);
          if (debugMode) console.log('[debug] jobs-search response', data);
          setDbgSearchRes(data);
          return data;
        };

        let searchData = await attemptInvoke();
        if (searchData?.error === 'rate_limited') {
          const retrySec = Math.max(10, Math.min(120, Number(searchData?.retryAfterSeconds || 55)));
          setErrorDedup({ message: `Rate limited by Firecrawl. Retrying in ${retrySec}s…` });
          await new Promise((r) => setTimeout(r, retrySec * 1000));
          searchData = await attemptInvoke();
        }

        if (searchData?.error) {
          if (searchData.error === 'missing_api_key') {
            setErrorDedup({ message: 'Firecrawl is not configured. Ask your admin to set FIRECRAWL_API_KEY in Supabase Function Secrets.' });
          } else if (searchData.error === 'rate_limited') {
            setErrorDedup({ message: 'Rate limited by Firecrawl. Please try again shortly.' });
          } else {
            const detail = searchData.detail || 'An unknown error occurred.';
            setErrorDedup({ message: `Failed to search: ${detail}` });
          }
          setQueueStatus('ready');
          setIncrementalMode(false);
          return;
        }

        // Expect shape: { success: true, data: { web: [ { url, title, description, category } ] } }
        const webItems = Array.isArray(searchData?.data?.web) ? searchData.data.web : [];
        const urls: string[] = webItems
          .map((it: any) => (typeof it?.url === 'string' ? it.url : undefined))
          .filter(Boolean);

        if (!urls.length) {
          setLastReason('no_sources');
          setErrorDedup({ message: 'No sources found. Try broadening your search.' });
          setQueueStatus('ready');
          setIncrementalMode(false);
          return;
        }

        // Start extraction separately using process-and-match
        const pmPayload = { searchQuery: query, location, urls, relaxSchema };
        if (debugMode) console.log('[debug] process-and-match request', pmPayload);
        setDbgPMReq(pmPayload);
        const { data: pmData, error: pmErr } = await supabase.functions.invoke('process-and-match', {
          body: pmPayload,
        });
        if (pmErr) throw new Error(pmErr.message);
        if (debugMode) console.log('[debug] process-and-match response', pmData);
        setDbgPMRes(pmData);
        if (pmData?.error) {
          const detail = pmData.detail || pmData.error || 'unknown';
          setErrorDedup({ message: `Failed to start extraction: ${detail}` });
          setQueueStatus('ready');
          setIncrementalMode(false);
          return;
        }

        if (pmData?.jobId) {
          setRunUrls(urls);
          setPollingJobId(pmData.jobId);
          setQueueStatus('populating');
          setStepIndex(1); // Extracting
          if (urls.length > 0) {
            try { setCurrentSource(new URL(urls[0]).hostname.replace(/^www\./, '')); } catch { setCurrentSource(urls[0]); }
          }
          safeInfo('Job search started...', 'Streaming results as we find them.');
        } else {
          setErrorDedup({ message: 'Failed to start extraction: unexpected response.' });
          setQueueStatus('idle');
          setIncrementalMode(false);
        }
      } catch (e: any) {
        setError({ message: `Failed to build job feed: ${e.message}` });
        setQueueStatus('idle');
        setIncrementalMode(false);
  // simplified flow
      }
  }, [supabase, debugMode, pollingJobId, incrementalMode, relaxSchema, jobs.length]);

    // Removed per-URL incremental starter; jobs-search now initiates a single batch extraction

    // Effect for polling the job status
    useEffect(() => {
      if (!pollingJobId) return;

      const interval = setInterval(async () => {
        try {
          const { data: statusData, error: statusError } = await supabase.functions.invoke('get-extract-status', {
            body: { jobId: pollingJobId, searchQuery, searchLocation: selectedLocation },
          });

          if (statusError) throw new Error(statusError.message);
          if (debugMode) console.log('[debug] get-extract-status response', statusData);
          setDbgStatus(statusData);

          if (statusData.status === 'completed') {
            clearInterval(interval);
            setPollingJobId(null);
            const inserted = typeof statusData.jobsInserted === 'number'
              ? statusData.jobsInserted
              : (Array.isArray(statusData?.data?.jobs) ? statusData.data.jobs.length : undefined);
            if (!inserted) setLastReason('no_structured_results');
            setStepIndex(2); // Inserting
            // Refresh and summarize
            await fetchJobQueue();
            setInsertedThisRun((prev) => prev + (inserted || 0));
            safeInfo("Job search complete!", inserted ? "Your results have been updated." : "No structured results were found for this search.");
            setCurrentSource(null);
            setIncrementalMode(false);
          } else if (statusData.status === 'failed') {
            clearInterval(interval);
            setPollingJobId(null);
            setLastReason('deep_research_failed');
            setErrorDedup({ message: 'Job search failed during processing.' });
            setQueueStatus('idle');
            setIncrementalMode(false);
            setCurrentSource(null);
            // Nothing else to do in simplified flow
          }
          // If still 'processing', do nothing and let the interval continue.
        } catch (e: any) {
          clearInterval(interval);
          setPollingJobId(null);
          setErrorDedup({ message: `Failed to check job status: ${e.message}` });
          setQueueStatus('idle');
            setIncrementalMode(false);
        }
      }, 10000); // Poll every 10 seconds

      return () => clearInterval(interval);
  }, [pollingJobId, supabase, fetchJobQueue, info, searchQuery, selectedLocation, incrementalMode, incrementalCanceled, runUrls, insertedThisRun, jobs]);

    const cancelPopulation = useCallback(() => {
      setIncrementalCanceled(true);
      setIncrementalMode(false);
      setPollingJobId(null);
      setQueueStatus('ready');
      setCurrentSource(null);
  // no currentUrl tracking in simplified flow
  // simplified flow
    }, []);

    // Apply all jobs (mark as applied) sequentially with simple progress + analytics events
    const applyAllJobs = useCallback(async () => {
      if (applyingAll || !jobs.length) return;
      setApplyingAll(true);
      setApplyProgress({ done: 0, total: jobs.length, success: 0, fail: 0 });
      try {
        events.autoApplyStarted(jobs.length);
        let success = 0; let fail = 0; let done = 0;
        // Sequential to simplify UI feedback; could be batched later
        for (const job of jobs) {
          const start = performance.now();
          try {
            if (!job.apply_url) {
              fail++; done++; setApplyProgress(p => ({ ...p, done, fail }));
              events.autoApplyJobFailed(job.id, job.status || job.remote_type || 'unknown', 'missing_apply_url');
              continue;
            }
            const { error: upErr } = await supabase.from('jobs').update({ status: 'applied' }).eq('id', job.id);
            if (upErr) {
              fail++; done++; setApplyProgress(p => ({ ...p, done, fail }));
              events.autoApplyJobFailed(job.id, job.status || 'unknown', 'update_failed');
            } else {
              success++; done++;
              const duration_ms = Math.round(performance.now() - start);
              events.autoApplyJobSuccess(job.id, job.status || 'unknown', duration_ms);
              setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'applied' } : j));
              setApplyProgress(p => ({ ...p, done, success }));
            }
          } catch (inner) {
            fail++; done++; setApplyProgress(p => ({ ...p, done, fail }));
            events.autoApplyJobFailed(job.id, job.status || 'unknown', 'exception');
          }
        }
        events.autoApplyFinished(success, fail);
      } finally {
        setApplyingAll(false);
      }
    }, [applyingAll, jobs, supabase]);

    // Unified effect for initial load and real-time updates
  useEffect(() => {
        if (profileLoading) {
            setQueueStatus('loading');
            return;
        }

        // Define the initial loading sequence
        const initialLoad = async () => {
            const initialJobs = await fetchJobQueue();
            // If the queue is empty AND we have a profile with a job title, auto-populate it.
      if (!autoPopulatedRef.current && initialJobs.length === 0 && profile?.job_title) {
        autoPopulatedRef.current = true;
        safeInfo("No results yet. Building a personalized job feed...", "This may take a moment.");
        await populateQueue(profile.job_title, profile.location || undefined);
            }
        };

        initialLoad();

        // Set up the real-time subscription
        const channel = supabase
            .channel('jobs-queue-changes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jobs' }, () => {
              // During an active search/extraction run, avoid thrashing the UI
              if (incrementalMode || pollingJobId) return;
              fetchJobQueue();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
  }, [profileLoading, profile, fetchJobQueue, populateQueue, supabase, info, incrementalMode, pollingJobId]);

    // Effect to pre-fill search query from profile
    useEffect(() => {
        if (profile && !searchQuery) {
            setSearchQuery(profile.job_title || '');
            setSelectedLocation(profile.location || 'Remote');
        }
    }, [profile, searchQuery]);

    const visibleJobs = useMemo(() => {
      let arr: Job[] = jobs;
      if (remoteOnly) {
        arr = arr.filter(j => (j.remote_type || '').toLowerCase().includes('remote'));
      }
      if (recentOnly) {
        const now = Date.now();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        arr = arr.filter(j => j.posted_at ? (now - new Date(j.posted_at).getTime()) <= sevenDays : true);
      }
      return arr;
    }, [jobs, remoteOnly, recentOnly]);

    const sortedJobs = useMemo(() => {
      return [...visibleJobs].sort((a, b) => new Date(b.posted_at || 0).getTime() - new Date(a.posted_at || 0).getTime());
    }, [visibleJobs]);

    const total = sortedJobs.length;
  // totalPages currently unused (pagination UI not yet implemented fully)
    const paginatedJobs = sortedJobs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    useEffect(() => {
      if (selectedJob && !paginatedJobs.some(j => j.id === selectedJob)) {
        setSelectedJob(paginatedJobs[0]?.id ?? null);
      }
    }, [currentPage, pageSize, selectedJob, paginatedJobs]);

    // Small helper for relative timestamps
    const formatRelative = (iso?: string | null) => {
      if (!iso) return '';
      const d = new Date(iso);
      const now = new Date();
      const diff = Math.max(0, now.getTime() - d.getTime());
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      return `${days}d ago`;
    };

    // Deadline formatting helper
    const formatDeadlineMeta = (value?: string): { label: string; level: 'overdue' | 'soon' | 'future' } | null => {
      if (!value) return null;
      const ts = Date.parse(value);
      if (Number.isNaN(ts)) return { label: value, level: 'future' };
      const d = new Date(ts);
      const now = new Date();
      const ms = d.getTime() - now.getTime();
      const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
      if (days < 0) return { label: `Closed ${Math.abs(days)}d ago`, level: 'overdue' };
      if (days === 0) return { label: 'Closes today', level: 'soon' };
      if (days === 1) return { label: 'Closes tomorrow', level: 'soon' };
      const level: 'soon' | 'future' = days <= 7 ? 'soon' : 'future';
      return { label: `Closes in ${days}d`, level };
    };

    const deadlineClasses = (level: 'overdue' | 'soon' | 'future') => {
      if (level === 'overdue') return 'border-[#ff4d4f]/30 text-[#ff4d4f] bg-[#ff4d4f]/10';
      if (level === 'soon') return 'border-[#ffbf00]/30 text-[#ffbf00] bg-[#ffbf00]/10';
      return 'border-[#14b8a6]/30 text-[#14b8a6] bg-[#14b8a6]/10';
    };

    return (
      <div className="min-h-screen bg-black" role="main" aria-label="Job search">
        <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">Job Search</h1>
                <p className="text-[#ffffff80] text-sm sm:text-base">A personalized list of jobs waiting for you.</p>
              </div>
              <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-[#ffffff70]">
                    <span>Broaden</span>
                    <Switch checked={relaxSchema} onCheckedChange={setRelaxSchema} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#ffffff70]">
                    <span>Remote</span>
                    <Switch checked={remoteOnly} onCheckedChange={setRemoteOnly} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#ffffff70]">
                    <span>Recent</span>
                    <Switch checked={recentOnly} onCheckedChange={setRecentOnly} />
                  </div>
                  {/* Target selector removed: fixed to 10 to minimize API usage and keep runs bounded */}
                  <div className="flex items-center gap-2 text-xs text-[#ffffff70] select-none">
                    <button
                      type="button"
                      onClick={() => setDebugMode(v => !v)}
                      className="px-1 py-0.5 rounded hover:text-white focus:outline-none focus:ring-1 focus:ring-[#1dff00]/50"
                      aria-pressed={debugMode}
                      title="Toggle Diagnostics"
                    >
                      Diagnostics
                    </button>
                    <Switch checked={debugMode} onCheckedChange={setDebugMode} />
                  </div>
                  <Button
                    variant="ghost"
                    onClick={applyAllJobs}
                    className="text-[#1dff00] hover:bg-[#1dff00]/10"
                    title="Auto apply all visible jobs"
                    disabled={applyingAll || queueStatus !== 'ready' || jobs.length === 0}
                  >
                    {applyingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Briefcase className="w-4 h-4 mr-2" />}
                    {applyingAll ? `Applying (${applyProgress.done}/${applyProgress.total})` : 'Auto Apply All'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => populateQueue(searchQuery, selectedLocation)}
                    className="text-[#1dff00] hover:bg-[#1dff00]/10"
                    title="Find a fresh batch of jobs"
                    disabled={queueStatus === 'populating' || queueStatus === 'loading'}
                  >
                    {queueStatus === 'populating' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                    {queueStatus === 'populating' ? 'Building results…' : 'Find New Jobs'}
                  </Button>
                </div>
            </div>
          </div>

          {queueStatus === 'populating' && (
            <LoadingBanner
              subtitle={`Streaming results… ${currentSource ? `Source: ${currentSource}` : ''}`}
              steps={steps}
              activeStep={stepIndex}
              onCancel={cancelPopulation}
              foundCount={insertedThisRun}
            />
          )}

          <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] p-4 sm:p-6 mb-6 sm:mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="lg:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#ffffff60]" />
                <Input
                  placeholder="Search jobs, companies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#ffffff1a] border-[#ffffff33] text-white"
                />
              </div>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#ffffff60]" />
                <Input
                  placeholder="Location..."
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="pl-10 bg-[#ffffff1a] border-[#ffffff33] text-white"
                />
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg sm:text-xl font-semibold text-white">
                  {queueStatus === 'loading' && "Loading results..."}
                  {queueStatus === 'populating' && "Building your results..."}
                  {(queueStatus === 'ready' || queueStatus === 'empty') && `${total} Jobs Found`}
                </h2>
              </div>

              { (queueStatus === 'loading' || queueStatus === 'populating') && (
                <div className="space-y-4">
                  {Array.from({ length: pageSize }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <Card className="relative overflow-hidden bg-gradient-to-br from-[#ffffff08] to-[#ffffff05] border border-[#ffffff15] p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 bg-[#ffffff1a] rounded-xl" />
                          <div className="flex-1 min-w-0">
                            <div className="h-4 bg-[#ffffff1a] rounded w-2/3 mb-2" />
                            <div className="h-3 bg-[#ffffff12] rounded w-1/2 mb-3" />
                            <div className="flex items-center gap-2">
                              <span className="inline-block h-4 w-16 rounded-full bg-[#ffffff12]" />
                              <span className="inline-block h-4 w-20 rounded-full bg-[#ffffff12]" />
                              <span className="inline-block h-4 w-12 rounded-full bg-[#ffffff12]" />
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <Card className="border-red-500/30 bg-red-500/10 text-red-200 p-4 flex items-center justify-between">
                  <span>{error.message}</span>
                  {error.link && (
                    <Link to={error.link} className="underline font-bold ml-4 whitespace-nowrap">
                      Go to Settings
                    </Link>
                  )}
                </Card>
              )}
              {applyingAll && (
                <Card className="border border-[#1dff00]/30 bg-[#1dff00]/10 text-[#1dff00] p-3 text-sm flex items-center justify-between">
                  <span>Auto applying jobs...</span>
                  <span>{applyProgress.done}/{applyProgress.total} • {applyProgress.success} ✓ {applyProgress.fail > 0 && `• ${applyProgress.fail} ✕`}</span>
                  <div className="absolute left-0 right-0 -bottom-0.5 h-0.5 bg-[#1dff00]/20">
                    <motion.div
                      className="h-full bg-[#1dff00]"
                      initial={{ width: '0%' }}
                      animate={{ width: `${Math.min(100, Math.round((applyProgress.done / Math.max(1, applyProgress.total)) * 100))}%` }}
                      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                    />
                  </div>
                </Card>
              )}

              {queueStatus === 'empty' && (
                <Card className="bg-gradient-to-br from-[#ffffff08] to-[#ffffff05] border border-[#ffffff15] p-8 text-center">
                  <Briefcase className="w-14 h-14 text-[#ffffff40] mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-white mb-2">Your Queue is Empty</h3>
                  <p className="text-[#ffffff80] mb-2">Click "Find New Jobs" to build your personalized job feed.</p>
                  {lastReason && (
                    <p className="text-[#ffffff60] text-sm">
                      {lastReason === 'no_sources' && 'No sources found. Broaden your search (e.g., remove seniority or location).'}
                      {lastReason === 'no_structured_results' && 'Sources were found but could not be parsed.'}
                    </p>
                  )}
                </Card>
              )}

              {queueStatus === 'ready' && paginatedJobs.map((job, index) => (
                <motion.div key={job.id} onClick={() => setSelectedJob(job.id)} className={`cursor-pointer transition-all duration-300 ${selectedJob === job.id ? "transform scale-[1.02]" : "hover:transform hover:scale-[1.01]"}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: index * 0.05 }}>
                  <Card className={`bg-gradient-to-br from-[#ffffff08] to-[#ffffff05] border p-4 transition-all duration-300 ${selectedJob === job.id ? "border-[#1dff00] shadow-[0_0_20px_rgba(29,255,0,0.3)]" : "border-[#ffffff15] hover:border-[#1dff00]/50"}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        {job.logoUrl && !logoError[job.id] ? <img src={job.logoUrl} alt={job.company} className="w-12 h-12 rounded-xl object-contain bg-white" onError={() => setLogoError(e => ({...e, [job.id]: true}))} /> : <div className="w-12 h-12 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-xl flex items-center justify-center text-black font-bold text-lg">{job.logo}</div>}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-semibold truncate">{job.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[#ffffffb3] text-sm truncate">{job.company}</span>
                            {job.location && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full border border-[#ffffff20] text-[#ffffffa6] bg-[#ffffff0d]">
                                {job.location}
                              </span>
                            )}
                            {job.remote_type && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full border border-[#1dff00]/30 text-[#1dff00] bg-[#1dff00]/10">
                                {job.remote_type}
                              </span>
                            )}
                            {(job.apply_url || (job as any)?.raw_data?.sourceUrl || job.source_id) && (() => {
                              const href = job.apply_url || (job as any)?.raw_data?.sourceUrl || job.source_id || '';
                              const host = getHost(href);
                              const ico = host ? `https://icons.duckduckgo.com/ip3/${host}.ico` : '';
                              return (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-[#ffffff1e] text-[#ffffffa6] bg-[#ffffff08]" title={href}>
                                  {host && <img src={ico} alt="" className="w-3 h-3 rounded-sm" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />}
                                  {host}
                                </span>
                              );
                            })()}
                            {(() => {
                              const raw = (job as any)?.raw_data;
                              const salary = (raw?.salaryRange || raw?.salary) as string | undefined;
                              if (!salary) return null;
                              const short = salary.length > 36 ? salary.slice(0, 33) + '…' : salary;
                              return (
                                <span className="text-[10px] px-2 py-0.5 rounded-full border border-[#ffffff20] text-[#ffffffc0] bg-[#ffffff0d]" title={salary}>
                                  {short}
                                </span>
                              );
                            })()}
                            {(() => {
                              const deadline = (job as any)?.raw_data?.applicationDeadline as string | undefined;
                              const meta = formatDeadlineMeta(deadline);
                              if (!meta) return null;
                              return (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${deadlineClasses(meta.level)}`} title={deadline}>
                                  {meta.label}
                                </span>
                              );
                            })()}
                            {job.posted_at && (
                              <span className="ml-auto text-[10px] text-[#ffffff80]">{formatRelative(job.posted_at)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {job.status && (
                        <span className={`ml-3 shrink-0 text-[10px] px-2 py-0.5 rounded-full border ${job.status === 'applied' ? 'border-[#14b8a6]/40 text-[#14b8a6] bg-[#14b8a6]/10' : 'border-[#ffffff24] text-[#ffffffb3] bg-[#ffffff0a]'}`}>{job.status}</span>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ))}
              {queueStatus === 'ready' && sortedJobs.length > pageSize && (
                <div className="flex items-center justify-between pt-4 text-xs text-[#ffffff80]">
                  <span>{sortedJobs.length} total</span>
                  <span>Showing first {pageSize} (pagination UI TBD)</span>
                </div>
              )}

              {debugMode && (
                <Card className="bg-[#0b0b0b] border border-[#ffffff20] p-4">
                  <div className="text-xs text-[#ffffff90] mb-2">Debug Panel</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-[#d1d5db]">
                    <div>
                      <div className="text-[#9ca3af] mb-1">jobs-search request</div>
                      <pre className="bg-[#111] p-2 rounded overflow-auto max-h-48">{JSON.stringify(dbgSearchReq, null, 2) || '—'}</pre>
                    </div>
                    <div>
                      <div className="text-[#9ca3af] mb-1">jobs-search response</div>
                      <pre className="bg-[#111] p-2 rounded overflow-auto max-h-48">{JSON.stringify(dbgSearchRes, null, 2) || '—'}</pre>
                    </div>
                    <div>
                      <div className="text-[#9ca3af] mb-1">process-and-match request</div>
                      <pre className="bg-[#111] p-2 rounded overflow-auto max-h-48">{JSON.stringify(dbgPMReq, null, 2) || '—'}</pre>
                    </div>
                    <div>
                      <div className="text-[#9ca3af] mb-1">process-and-match response</div>
                      <pre className="bg-[#111] p-2 rounded overflow-auto max-h-48">{JSON.stringify(dbgPMRes, null, 2) || '—'}</pre>
                    </div>
                    <div className="md:col-span-2">
                      <div className="text-[#9ca3af] mb-1">get-extract-status latest</div>
                      <pre className="bg-[#111] p-2 rounded overflow-auto max-h-48">{JSON.stringify(dbgStatus, null, 2) || '—'}</pre>
                    </div>
                  </div>
                </Card>
              )}
            </div>

            <div className="lg:sticky lg:top-6 lg:h-fit">
        {selectedJob && (() => {
                  const job = jobs.find(j => j.id === selectedJob);
                  if (!job) return null;
          return (
                      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
                          <Card className="bg-gradient-to-br from-[#ffffff08] to-[#ffffff05] border border-[#ffffff15] p-6 mb-6">
                              <div className="flex items-start justify-between mb-6">
                                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                                      {job.logoUrl && !logoError[job.id] ? <img src={job.logoUrl} alt={job.company} className="w-16 h-16 rounded-xl object-contain bg-white" onError={() => setLogoError(e => ({...e, [job.id]: true}))} /> : <div className="w-16 h-16 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-xl flex items-center justify-center text-black font-bold text-xl">{job.logo}</div>}
                                      <div className="flex-1 min-w-0">
                                          <h1 className="text-xl font-bold text-white mb-1">{job.title}</h1>
                      <div className="flex items-center gap-2 text-sm text-[#ffffffb3] mb-2">
                      <span>{job.company}</span>
                      {job.location && <span className="text-[10px] px-2 py-0.5 rounded-full border border-[#ffffff20] text-[#ffffffa6] bg-[#ffffff0d]">{job.location}</span>}
                      {job.remote_type && <span className="text-[10px] px-2 py-0.5 rounded-full border border-[#1dff00]/30 text-[#1dff00] bg-[#1dff00]/10">{job.remote_type}</span>}
                      {(job.apply_url || (job as any)?.raw_data?.sourceUrl || job.source_id) && (() => {
                        const href = job.apply_url || (job as any)?.raw_data?.sourceUrl || job.source_id || '';
                        const host = getHost(href);
                        const ico = host ? `https://icons.duckduckgo.com/ip3/${host}.ico` : '';
                        return (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-[#ffffff1e] text-[#ffffffa6] bg-[#ffffff08]" title={href}>
                            {host && <img src={ico} alt="" className="w-3 h-3 rounded-sm" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />}
                            {host}
                          </span>
                        );
                      })()}
                      {job.posted_at && <span className="ml-auto text-[10px] text-[#ffffff80]">Posted {formatRelative(job.posted_at)}</span>}
                      </div>
                                      </div>
                                  </div>
                              </div>
                              <div className="prose prose-invert max-w-none text-[#ffffffcc] leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.description || '') }} />
                              {/* Sources list, if available from Firecrawl */}
                              {(() => {
                                const sources = (job as any)?.raw_data?._sources;
                                if (!sources || (Array.isArray(sources) && sources.length === 0)) return null;
                                const items: any[] = Array.isArray(sources) ? sources : [sources];
                                return (
                                  <div className="mt-6">
                                    <div className="text-xs uppercase tracking-wide text-[#ffffff70] mb-2">Sources</div>
                                    <ul className="space-y-1">
                                      {items.map((s, i) => {
                                        const href = typeof s === 'string' ? s : (s?.url || s?.source || '');
                                        if (!href) return null;
                                        const host = getHost(href);
                                        const ico = host ? `https://icons.duckduckgo.com/ip3/${host}.ico` : '';
                                        return (
                                          <li key={i} className="text-sm flex items-center gap-2">
                                            {host && <img src={ico} alt="" className="w-4 h-4 rounded-sm" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />}
                                            <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#1dff00] hover:underline">
                                              {host || href}
                                            </a>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                );
                              })()}
                              {(() => {
                                const deadline = (job as any)?.raw_data?.applicationDeadline as string | undefined;
                                const meta = formatDeadlineMeta(deadline);
                                if (!meta) return null;
                                return (
                                  <div className="mt-4 text-xs text-[#ffffffb3]">
                                    Application deadline: <span className={`${deadlineClasses(meta.level)}`.replace('border', 'text').replace(/bg\[[^\]]+\]/g, '')}>{meta.label}</span>
                                  </div>
                                );
                              })()}
                              {(() => {
                                const raw = (job as any)?.raw_data;
                                const salary = (raw?.salaryRange || raw?.salary) as string | undefined;
                                if (!salary) return null;
                                return (
                                  <div className="mt-2 text-xs text-[#ffffffb3]">
                                    Salary: <span className="text-[#ffffffd0]">{salary}</span>
                                  </div>
                                );
                              })()}
                              {(() => {
                                const primaryHref = job.apply_url || (job as any)?.raw_data?.sourceUrl || job.source_id;
                                if (!primaryHref) return null;
                                return (
                                  <div className="flex justify-end mt-4">
                                    <a href={primaryHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 rounded-md border border-[#1dff00]/40 text-[#1dff00] bg-[#1dff00]/20 hover:bg-[#1dff00]/30 transition">
                                      View Original Posting
                                    </a>
                                  </div>
                                );
                              })()}
                          </Card>
                      </motion.div>
                  );
              })()}
              {queueStatus === 'populating' && !selectedJob && (
                <div className="animate-pulse">
                  <Card className="relative overflow-hidden bg-gradient-to-br from-[#ffffff08] to-[#ffffff05] border border-[#ffffff15] p-6 mb-6">
                    <div className="flex items-start gap-4 mb-6">
                      <div className="w-16 h-16 bg-[#ffffff1a] rounded-xl" />
                      <div className="flex-1 min-w-0">
                        <div className="h-5 bg-[#ffffff1a] rounded w-1/2 mb-2" />
                        <div className="h-4 bg-[#ffffff12] rounded w-1/3 mb-3" />
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-4 w-20 rounded-full bg-[#ffffff12]" />
                          <span className="inline-block h-4 w-16 rounded-full bg-[#ffffff12]" />
                          <span className="inline-block h-4 w-24 rounded-full bg-[#ffffff12]" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 bg-[#ffffff12] rounded w-full" />
                      <div className="h-4 bg-[#ffffff0f] rounded w-11/12" />
                      <div className="h-4 bg-[#ffffff0a] rounded w-10/12" />
                      <div className="h-4 bg-[#ffffff08] rounded w-9/12" />
                    </div>
                  </Card>
                </div>
              )}
              {!selectedJob && queueStatus === 'ready' && (
                   <Card className="bg-gradient-to-br from-[#ffffff08] to-[#ffffff05] border border-[#ffffff15] p-8 text-center">
                      <Briefcase className="w-16 h-16 text-[#ffffff40] mx-auto mb-4" />
                      <h3 className="text-xl font-medium text-white mb-2">Select a job</h3>
                      <p className="text-[#ffffff60]">Choose a job from the list to view details</p>
                  </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };