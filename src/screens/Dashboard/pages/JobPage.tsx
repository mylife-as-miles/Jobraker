import { Briefcase, Search, MapPin, Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Switch } from "../../../components/ui/switch";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "../../../components/ui/button";
import Modal from "../../../components/ui/modal";
import { useResumes } from "../../../hooks/useResumes";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { motion } from "framer-motion";
import { createClient } from "../../../lib/supabaseClient";
import { useProfileSettings } from "../../../hooks/useProfileSettings";
import { events } from "../../../lib/analytics";
import { useToast } from "../../../components/ui/toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";

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
  expires_at: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
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
  // Incremental run state
  const [incrementalMode, setIncrementalMode] = useState(false);
  const [insertedThisRun, setInsertedThisRun] = useState(0);
  const [currentSource, setCurrentSource] = useState<string | null>(null);
  const [lastReason, setLastReason] = useState<string | null>(null);
    const [debugMode, setDebugMode] = useState(false);
  const [logoError, setLogoError] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [applyingAll, setApplyingAll] = useState(false);
    const [applyProgress, setApplyProgress] = useState({ done: 0, total: 0, success: 0, fail: 0 });
    const [sortBy, setSortBy] = useState<"recent" | "company" | "deadline">("recent");
  // Resume attach dialog state
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
    const [remoteOnly, setRemoteOnly] = useState(false);
    const [recentOnly, setRecentOnly] = useState(false);

  // Debug payload capture for in-app panel
  const [dbgSearchReq, setDbgSearchReq] = useState<any>(null);
  const [dbgSearchRes, setDbgSearchRes] = useState<any>(null);
  

  const { profile, loading: profileLoading } = useProfileSettings();
  // Load user resumes for selection (used by the Auto Apply -> "Choose a resume" dialog)
  const { resumes, loading: resumesLoading } = useResumes();
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
              {typeof foundCount === 'number' && foundCount > 0 && (
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

        {/* Steps with animated active pill and completion indicators */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 relative">
          {steps.map((label, idx) => {
            const isActive = idx === activeStep;
            const isCompleted = idx < activeStep;
            return (
              <motion.div 
                key={label} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`relative flex items-center gap-2 rounded-lg border p-2.5 transition-all duration-300 ${
                  isActive 
                    ? 'border-[#1dff00] bg-[#1dff00]/10 shadow-[0_0_15px_rgba(29,255,0,0.2)]' 
                    : isCompleted
                    ? 'border-[#1dff00]/50 bg-[#1dff00]/5'
                    : 'border-[#ffffff18] bg-[#ffffff08]'
                }`}
              >
                {/* Status indicator */}
                <div className="relative flex-shrink-0">
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className="w-4 h-4 rounded-full bg-[#1dff00] flex items-center justify-center"
                    >
                      <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </motion.div>
                  ) : isActive ? (
                    <motion.div
                      className="w-4 h-4 rounded-full bg-[#1dff00]"
                      animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [1, 0.7, 1]
                      }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-[#ffffff40]" />
                  )}
                </div>
                
                <div className={`text-[11px] sm:text-xs truncate font-medium ${
                  isActive ? 'text-[#eaffea]' : isCompleted ? 'text-[#1dff00]/80' : 'text-[#ffffff90]'
                }`}>
                  {label}
                </div>
                
                {isActive && (
                  <motion.span
                    layoutId="activeStepGlow"
                    className="absolute inset-0 rounded-lg pointer-events-none"
                    style={{ boxShadow: '0 0 20px rgba(29,255,0,0.25) inset' }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Enhanced progress bar with percentage */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-[#ffffff70]">
            <span>Progress</span>
            <span>{Math.round(((activeStep) / (steps.length - 1)) * 100)}%</span>
          </div>
          <div className="h-2 bg-[#0f0f0f] rounded-full overflow-hidden border border-[#1dff00]/20 relative">
            {/* Background glow */}
            <motion.div
              className="absolute inset-0 opacity-20"
              style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(29,255,0,0.4) 50%, transparent 100%)' }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
            />
            {/* Actual progress */}
            <motion.div
              className="h-full bg-gradient-to-r from-[#1dff00]/60 via-[#1dff00] to-[#1dff00]/60 relative"
              initial={{ width: '0%' }}
              animate={{ width: `${((activeStep) / (steps.length - 1)) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              {/* Shimmer effect */}
              <motion.div
                className="absolute inset-0 opacity-50"
                style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)' }}
                animate={{ x: ['-100%', '200%'] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              />
            </motion.div>
          </div>
        </div>
      </Card>
    );

  const [stepIndex, setStepIndex] = useState(0);
    const steps = useMemo(() => [
      'Searching Web',
      'Saving Results'
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

    const populateQueue = useCallback(async (query: string, _location?: string) => {
      // Prevent re-entry if a run is active
      if (incrementalMode) return;
      if (!query || !query.trim()) {
        setError({ message: 'Please enter a job title or keywords to search.' });
        return;
      }
      setQueueStatus('populating');
      setError(null);
      setLastReason(null);
      setStepIndex(0); // Step 0: Searching Web
      setIncrementalMode(true);
      setInsertedThisRun(0);

      try {
        // Use backend jobs-search to discover and save jobs directly
        safeInfo("Searching the web for jobs…");
        const attemptInvoke = async (): Promise<any> => {
          const searchPayload = {
            searchQuery: query,
            location: 'Remote',  // Always search for remote jobs for broader results
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

        // Jobs are now saved directly by jobs-search function
        const inserted = searchData?.jobsInserted || 0;

        setStepIndex(1); // Complete: Saving Results
        setInsertedThisRun(inserted);
        
        // Refresh job list
        await fetchJobQueue();
        
        setIncrementalMode(false);
        safeInfo("Job search complete!", inserted > 0 ? `Found and saved ${inserted} jobs.` : "No jobs found for this search.");
        setCurrentSource(null);

      } catch (e: any) {
        setError({ message: `Failed to search jobs: ${e.message}` });
        setQueueStatus('idle');
        setIncrementalMode(false);
      }
  }, [supabase, debugMode, incrementalMode, fetchJobQueue, safeInfo, setErrorDedup]);

    // Removed old process-and-match and polling logic - jobs are now saved directly

    const cancelPopulation = useCallback(() => {
      setIncrementalMode(false);
      setQueueStatus('ready');
      setCurrentSource(null);
    }, []);

    // Apply all jobs (mark as applied) sequentially with simple progress + analytics events
    const applyAllJobs = useCallback(async () => {
      if (applyingAll || !jobs.length) return;
      setApplyingAll(true);
      setApplyProgress({ done: 0, total: jobs.length, success: 0, fail: 0 });
      try {
        // Include selected resume id (if any) in analytics
        events.autoApplyStarted(jobs.length, selectedResumeId || undefined);
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
    }, [applyingAll, jobs, supabase, selectedResumeId]);

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
              if (incrementalMode) return;
              fetchJobQueue();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
  }, [profileLoading, profile, fetchJobQueue, populateQueue, supabase, info, incrementalMode]);

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
      const arr = [...visibleJobs];
      if (sortBy === 'company') {
        return arr.sort((a, b) => (a.company || '').localeCompare(b.company || ''));
      }
      if (sortBy === 'deadline') {
        const toTs = (v?: string | null) => {
          if (!v) return Number.POSITIVE_INFINITY;
          const t = Date.parse(v);
          return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
        };
        return arr.sort((a, b) => toTs(a.expires_at) - toTs(b.expires_at));
      }
      return arr.sort((a, b) => new Date(b.posted_at || 0).getTime() - new Date(a.posted_at || 0).getTime());
    }, [visibleJobs, sortBy]);

    const total = sortedJobs.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const clampedPage = Math.min(Math.max(1, currentPage), totalPages);
    const startIdx = (clampedPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, total);
    const paginatedJobs = sortedJobs.slice(startIdx, endIdx);

    useEffect(() => {
      if (currentPage !== clampedPage) setCurrentPage(clampedPage);
    }, [clampedPage, currentPage]);

    useEffect(() => {
      if (selectedJob && !paginatedJobs.some(j => j.id === selectedJob)) {
        setSelectedJob(paginatedJobs[0]?.id ?? null);
      }
    }, [clampedPage, pageSize, selectedJob, paginatedJobs]);

    useEffect(() => {
      setCurrentPage(1);
    }, [remoteOnly, recentOnly, searchQuery, sortBy]);

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
                    onClick={() => setResumeDialogOpen(true)}
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
                {(queueStatus === 'ready' || queueStatus === 'empty') && (
                  <div className="hidden sm:flex items-center gap-2">
                    <span className="text-[11px] text-white/50">Sort</span>
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                      <SelectTrigger className="h-8 w-[160px] bg-white/10 border-white/15 text-white">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent className="bg-black text-white border-white/15">
                        <SelectItem value="recent">Most recent</SelectItem>
                        <SelectItem value="company">Company</SelectItem>
                        <SelectItem value="deadline">Deadline</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {queueStatus === 'ready' && total > 0 && (
                <div className="hidden lg:grid grid-cols-[auto,1fr,auto] items-center gap-3 px-2 text-[11px] uppercase tracking-wide text-white/40">
                  <span className="pl-2">Role</span>
                  <div className="grid grid-cols-3 gap-2">
                    <span>Company</span>
                    <span>Meta</span>
                    <span>Posting</span>
                  </div>
                </div>
              )}

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
                <motion.div
                  key={job.id}
                  role="button"
                  aria-selected={selectedJob === job.id}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedJob(job.id); } }}
                  onClick={() => setSelectedJob(job.id)}
                  className={`cursor-pointer transition-all duration-300 ${selectedJob === job.id ? 'transform scale-[1.01]' : 'hover:transform hover:scale-[1.005]'} focus:outline-none focus:ring-2 focus:ring-[#1dff00]/40 rounded-xl`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.04 }}
                >
                  <Card className={`relative overflow-hidden group bg-gradient-to-br from-[#ffffff08] to-[#ffffff05] border p-3 sm:p-4 transition-all duration-300 ${selectedJob === job.id ? 'border-[#1dff00] shadow-[0_0_20px_rgba(29,255,0,0.25)]' : 'border-[#ffffff15] hover:border-[#1dff00]/40'}`}>
                    <span className={`pointer-events-none absolute left-0 top-0 h-full w-[3px] ${selectedJob === job.id ? 'bg-[#1dff00]' : 'bg-transparent group-hover:bg-[#1dff00]/70'} transition-colors`} />
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {job.logoUrl && !logoError[job.id]
                          ? <img src={job.logoUrl} alt={job.company} className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-contain bg-white" onError={() => setLogoError(e => ({...e, [job.id]: true}))} />
                          : <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-xl flex items-center justify-center text-black font-bold text-base sm:text-lg">{job.logo}</div>}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <h3 className="text-white font-semibold truncate text-sm sm:text-base" title={job.title}>{job.title}</h3>
                            {job.status && (
                              <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border ${job.status === 'applied' ? 'border-[#14b8a6]/40 text-[#14b8a6] bg-[#14b8a6]/10' : 'border-[#ffffff24] text-[#ffffffb3] bg-[#ffffff0a]'}`}>{job.status}</span>
                            )}
                          </div>
                          <div className="mt-1 grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[#ffffffb3] text-xs sm:text-sm truncate" title={job.company || ''}>{job.company}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {job.location && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full border border-[#ffffff20] text-[#ffffffa6] bg-[#ffffff0d]" title={job.location}>
                                  {job.location}
                                </span>
                              )}
                              {job.remote_type && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full border border-[#1dff00]/30 text-[#1dff00] bg-[#1dff00]/10" title={job.remote_type}>
                                  {job.remote_type}
                                </span>
                              )}
                              {(() => {
                                if (job.salary_min || job.salary_max || job.salary_currency) {
                                  const currency = job.salary_currency || 'USD';
                                  const currencySymbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency;
                                  let salaryText = '';
                                  if (job.salary_min && job.salary_max) {
                                    const min = job.salary_min >= 1000 ? `${Math.round(job.salary_min / 1000)}k` : job.salary_min;
                                    const max = job.salary_max >= 1000 ? `${Math.round(job.salary_max / 1000)}k` : job.salary_max;
                                    salaryText = `${currencySymbol}${min}-${max}`;
                                  } else if (job.salary_min) {
                                    const min = job.salary_min >= 1000 ? `${Math.round(job.salary_min / 1000)}k` : job.salary_min;
                                    salaryText = `${currencySymbol}${min}+`;
                                  } else if (job.salary_max) {
                                    const max = job.salary_max >= 1000 ? `${Math.round(job.salary_max / 1000)}k` : job.salary_max;
                                    salaryText = `Up to ${currencySymbol}${max}`;
                                  }
                                  if (salaryText) {
                                    return (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-[#1dff00]/30 text-[#1dff00] bg-[#1dff00]/10" title={`Salary: ${salaryText}`}>
                                        💰 {salaryText}
                                      </span>
                                    );
                                  }
                                }
                                const raw = (job as any)?.raw_data;
                                const salary = (raw?.scraped_data?.salary || raw?.salaryRange || raw?.salary) as string | undefined;
                                if (!salary) return null;
                                const short = salary.length > 36 ? salary.slice(0, 33) + '…' : salary;
                                return (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-[#ffffff20] text-[#ffffffc0] bg-[#ffffff0d]" title={salary}>
                                    {short}
                                  </span>
                                );
                              })()}
                              {(() => {
                                const deadline = job.expires_at || (job as any)?.raw_data?.deadline || (job as any)?.raw_data?.applicationDeadline;
                                const meta = formatDeadlineMeta(deadline);
                                if (!meta) return null;
                                return (
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${deadlineClasses(meta.level)}`} title={deadline}>
                                    {meta.label}
                                  </span>
                                );
                              })()}
                            </div>
                            <div className="flex items-center gap-2 justify-between md:justify-end min-w-0">
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
                              {job.posted_at && (
                                <span className="text-[10px] text-[#ffffff80] whitespace-nowrap">{formatRelative(job.posted_at)}</span>
                              )}
                              {(job.apply_url || (job as any)?.raw_data?.sourceUrl || job.source_id) && (() => {
                                const href = job.apply_url || (job as any)?.raw_data?.sourceUrl || job.source_id || '';
                                return (
                                  <a
                                    href={href}
                                    onClick={(e) => e.stopPropagation()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="Open job posting in new tab"
                                    className="ml-2 inline-flex items-center justify-center text-[11px] px-2 py-1 rounded-md border border-[#ffffff20] text-[#ffffffc0] hover:text-white hover:border-white/40 hover:bg-white/10"
                                  >
                                    <ExternalLink className="w-4 h-4 sm:mr-1" />
                                    <span className="hidden sm:inline">Open</span>
                                  </a>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
              {queueStatus === 'ready' && total > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4">
                  <div className="text-[12px] text-white/60">
                    Showing <span className="text-white/80">{total === 0 ? 0 : startIdx + 1}</span>–<span className="text-white/80">{endIdx}</span> of <span className="text-white/80">{total}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-white/50">Rows</span>
                      <Select value={String(pageSize)} onValueChange={(v) => { const n = parseInt(v); if (!Number.isNaN(n)) { setPageSize(n); setCurrentPage(1); } }}>
                        <SelectTrigger className="h-8 w-[90px] bg-white/10 border-white/15 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-black text-white border-white/15">
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="First page"
                        disabled={clampedPage === 1}
                        onClick={() => setCurrentPage(1)}
                        className={`h-8 w-8 grid place-items-center rounded-md border ${clampedPage===1 ? 'border-white/10 text-white/30' : 'border-white/20 text-white/70 hover:text-white hover:border-white/40 hover:bg-white/10'}`}
                      >
                        <ChevronsLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Previous page"
                        disabled={clampedPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className={`h-8 w-8 grid place-items-center rounded-md border ${clampedPage===1 ? 'border-white/10 text-white/30' : 'border-white/20 text-white/70 hover:text-white hover:border-white/40 hover:bg-white/10'}`}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <div className="hidden md:flex items-center gap-1">
                        {(() => {
                          const pages: (number | '…')[] = [];
                          const maxToShow = 5;
                          let start = Math.max(1, clampedPage - 2);
                          let end = Math.min(totalPages, start + maxToShow - 1);
                          start = Math.max(1, end - maxToShow + 1);
                          if (start > 1) pages.push(1, '…');
                          for (let i = start; i <= end; i++) pages.push(i);
                          if (end < totalPages) pages.push('…', totalPages);
                          return pages.map((p, idx) => (
                            typeof p === 'number' ? (
                              <button
                                key={idx}
                                onClick={() => setCurrentPage(p)}
                                className={`h-8 min-w-8 px-2 rounded-md border text-[12px] ${p===clampedPage ? 'border-[#1dff00]/50 text-[#1dff00] bg-[#1dff00]/10' : 'border-white/20 text-white/70 hover:text-white hover:border-white/40 hover:bg-white/10'}`}
                              >{p}</button>
                            ) : (
                              <span key={idx} className="px-2 text-white/40">…</span>
                            )
                          ));
                        })()}
                      </div>
                      <button
                        type="button"
                        aria-label="Next page"
                        disabled={clampedPage === totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className={`h-8 w-8 grid place-items-center rounded-md border ${clampedPage===totalPages ? 'border-white/10 text-white/30' : 'border-white/20 text-white/70 hover:text-white hover:border-white/40 hover:bg-white/10'}`}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Last page"
                        disabled={clampedPage === totalPages}
                        onClick={() => setCurrentPage(totalPages)}
                        className={`h-8 w-8 grid place-items-center rounded-md border ${clampedPage===totalPages ? 'border-white/10 text-white/30' : 'border-white/20 text-white/70 hover:text-white hover:border-white/40 hover:bg-white/10'}`}
                      >
                        <ChevronsRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="md:hidden text-[12px] text-white/60 text-right">
                      Page {clampedPage} of {totalPages}
                    </div>
                  </div>
                </div>
              )}

              {debugMode && (
                <Card className="bg-[#0b0b0b] border border-[#ffffff20] p-4">
                  <div className="text-xs text-[#ffffff90] mb-2">Debug Panel - Simplified Flow</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-[#d1d5db]">
                    <div>
                      <div className="text-[#9ca3af] mb-1">jobs-search request</div>
                      <pre className="bg-[#111] p-2 rounded overflow-auto max-h-48">{JSON.stringify(dbgSearchReq, null, 2) || '—'}</pre>
                    </div>
                    <div>
                      <div className="text-[#9ca3af] mb-1">jobs-search response</div>
                      <pre className="bg-[#111] p-2 rounded overflow-auto max-h-48">{JSON.stringify(dbgSearchRes, null, 2) || '—'}</pre>
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] text-[#666] italic">
                    Note: Jobs are now saved directly by jobs-search. No extraction phase needed.
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
                              
                              {/* Screenshot display */}
                              {(() => {
                                const screenshot = (job as any)?.raw_data?.screenshot;
                                if (!screenshot) return null;
                                return (
                                  <div className="mt-6">
                                    <div className="text-xs uppercase tracking-wide text-[#ffffff70] mb-2">Job Page Preview</div>
                                    <div className="border border-[#ffffff15] rounded-lg overflow-hidden bg-[#ffffff08]">
                                      <img 
                                        src={screenshot} 
                                        alt="Job page screenshot" 
                                        className="w-full h-auto"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                          const parent = target.parentElement;
                                          if (parent) {
                                            parent.innerHTML = '<div class="p-4 text-center text-[#ffffff60] text-sm">Screenshot unavailable</div>';
                                          }
                                        }}
                                      />
                                    </div>
                                  </div>
                                );
                              })()}
                              
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
                              
                              {/* Deadline from expires_at or raw_data */}
                              {(() => {
                                const deadline = job.expires_at || (job as any)?.raw_data?.deadline || (job as any)?.raw_data?.applicationDeadline;
                                if (!deadline) return null;
                                const meta = formatDeadlineMeta(deadline);
                                if (!meta) return null;
                                return (
                                  <div className="mt-4 text-xs text-[#ffffffb3]">
                                    Application deadline: <span className={`${deadlineClasses(meta.level)}`.replace('border', 'text').replace(/bg\[[^\]]+\]/g, '')}>{meta.label}</span>
                                  </div>
                                );
                              })()}
                              
                              {/* Salary from structured fields or raw_data */}
                              {(() => {
                                // Try structured fields first
                                if (job.salary_min || job.salary_max || job.salary_currency) {
                                  const currency = job.salary_currency || 'USD';
                                  const currencySymbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency;
                                  
                                  let salaryText = '';
                                  if (job.salary_min && job.salary_max) {
                                    salaryText = `${currencySymbol}${job.salary_min.toLocaleString()} - ${currencySymbol}${job.salary_max.toLocaleString()}`;
                                  } else if (job.salary_min) {
                                    salaryText = `${currencySymbol}${job.salary_min.toLocaleString()}+`;
                                  } else if (job.salary_max) {
                                    salaryText = `Up to ${currencySymbol}${job.salary_max.toLocaleString()}`;
                                  }
                                  
                                  if (salaryText) {
                                    return (
                                      <div className="mt-2 text-xs text-[#ffffffb3]">
                                        Salary: <span className="text-[#ffffffd0]">{salaryText}</span>
                                      </div>
                                    );
                                  }
                                }
                                
                                // Fall back to raw_data salary string
                                const raw = (job as any)?.raw_data;
                                const salary = (raw?.scraped_data?.salary || raw?.salaryRange || raw?.salary) as string | undefined;
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
          {/* Resume selection dialog for Auto Apply */}
          <Modal
            open={resumeDialogOpen}
            onClose={() => setResumeDialogOpen(false)}
            title="Attach a Resume"
            size="md"
            side="center"
          >
            <div className="space-y-3">
              <p className="text-sm text-[#ffffffb3]">Choose a resume to attach when applying to these jobs.</p>
              <div className="max-h-64 overflow-auto rounded-md border border-[#ffffff15]">
                {resumesLoading ? (
                  <div className="p-3 text-[12px] text-[#ffffff80]">Loading your resumes…</div>
                ) : (resumes && resumes.length > 0 ? (
                  <ul className="divide-y divide-[#ffffff10]">
                    {resumes.map((r: any) => (
                      <li key={r.id} className="flex items-center gap-3 p-3 hover:bg-[#ffffff08]">
                        <input
                          type="radio"
                          name="resume-choice"
                          className="accent-[#1dff00]"
                          checked={selectedResumeId === r.id}
                          onChange={() => setSelectedResumeId(r.id)}
                          aria-label={`Select resume ${r.name}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-white text-sm font-medium" title={r.name}>{r.name}</span>
                            {r.is_favorite && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-[#1dff00]/40 text-[#1dff00] bg-[#1dff00]/10">Favorite</span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#ffffff70] truncate">
                            {(r.file_ext || 'pdf').toUpperCase()} • {r.size ? `${Math.round(r.size/1024)} KB` : 'Unknown size'} • Updated {new Date(r.updated_at).toLocaleDateString()}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-3 text-[12px] text-[#ffffff80]">
                    No resumes found. You can import one from the Resumes page.
                    <div className="mt-3">
                      <a href="/dashboard/resumes" className="inline-flex items-center px-3 py-2 rounded-md border border-[#1dff00]/40 text-[#1dff00] bg-[#1dff00]/10 hover:bg-[#1dff00]/20">Go to Resumes</a>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" className="border-white/20" onClick={() => setResumeDialogOpen(false)}>Cancel</Button>
                <Button
                  className="border-[#1dff00]/40 text-[#1dff00] bg-[#1dff00]/20 hover:bg-[#1dff00]/30"
                  onClick={() => { setResumeDialogOpen(false); applyAllJobs(); }}
                  disabled={applyingAll || jobs.length === 0}
                >
                  Continue
                </Button>
              </div>
            </div>
          </Modal>
        </div>
      </div>
    );
  };