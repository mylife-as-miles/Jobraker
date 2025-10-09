import { Briefcase, Search, MapPin, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Switch } from "../../../components/ui/switch";
import { useState, useEffect, useCallback, useMemo } from "react";
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
      logoUrl: getCompanyLogoUrl(dbJob.company, dbJob.apply_url),
      logo: dbJob.company?.[0]?.toUpperCase() || '?',
      status: dbJob.status,
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
    const [lastReason, setLastReason] = useState<string | null>(null);
    const [debugMode, setDebugMode] = useState(false);
    const [logoError, setLogoError] = useState<Record<string, boolean>>({});
    const [currentPage] = useState(1); // (Pagination placeholder; future enhancement)
    const [pageSize] = useState(10);
    const [applyingAll, setApplyingAll] = useState(false);
    const [applyProgress, setApplyProgress] = useState({ done: 0, total: 0, success: 0, fail: 0 });

  const { profile, loading: profileLoading } = useProfileSettings();
  const { info } = useToast();

    // Step-by-step loading banner
    const LoadingBanner = ({ subtitle, steps, activeStep }: { subtitle?: string; steps: string[]; activeStep: number }) => (
      <Card className="bg-gradient-to-br from-[#ffffff08] to-[#ffffff05] border border-[#1dff00]/30 p-4 sm:p-5 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#1dff00] animate-pulse" aria-hidden />
          <div className="flex-1 min-w-0">
            <div className="text-white font-medium">Building your results…</div>
            <div className="text-xs text-[#ffffff90]">{subtitle || 'This may take a few minutes depending on sources.'}</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {steps.map((label, idx) => (
            <div key={label} className={`flex items-center gap-2 rounded-md border p-2 ${idx === activeStep ? 'border-[#1dff00] bg-[#1dff00]/10' : 'border-[#ffffff18] bg-[#ffffff08]'}`}>
              <div className={`w-2 h-2 rounded-full ${idx === activeStep ? 'bg-[#1dff00] animate-pulse' : 'bg-[#ffffff40]'}`} aria-hidden />
              <div className={`text-[11px] truncate ${idx === activeStep ? 'text-[#eaffea]' : 'text-[#ffffff90]'}`}>{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 h-1.5 bg-[#ffffff12] rounded overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[#1dff00]/20 via-[#1dff00] to-[#1dff00]/20"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
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

    // Real step updates occur at key phases of the flow; no cycling needed now.

    // Steps reflect phases; no cancel/try-different actions per request

    const fetchJobQueue = useCallback(async () => {
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
      if (!query || !query.trim()) {
        setError({ message: 'Please enter a job title or keywords to search.' });
        return;
      }
      setQueueStatus('populating');
      setError(null);
      setLastReason(null);
      setPollingJobId(null);
      setStepIndex(0); // Discovering sources

      try {
        // Get user and their configured job source URLs
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated.");

        // Support both schemas: some environments use job_source_settings.id = user_id (PK),
        // others store a separate user_id column. Try user_id first, then id fallback.
        let settings: any = null;
        let urls: string[] = [];
        const q1 = await supabase
          .from('job_source_settings')
          .select('allowed_domains')
          .eq('user_id', user.id)
          .maybeSingle();
        // If the column doesn't exist or no row, try fallback path using id
        if (q1.data) {
          settings = q1.data;
          urls = settings?.allowed_domains || [];
        } else {
          const q2 = await supabase
            .from('job_source_settings')
            .select('allowed_domains')
            .eq('id', user.id)
            .maybeSingle();
          if (q2.error && q2.error.code !== 'PGRST116') throw q2.error;
          settings = q2.data;
          urls = settings?.allowed_domains || [];
        }

        if (urls.length === 0) {
          // If no sources are configured, use Remotive as a default fallback.
          info("No job sources configured. Using Remotive as a default.", "You can configure sources in settings.");
          urls = ['https://remotive.com'];
        }

        // Invoke the backend function with the required payload
        const { data: processData, error: processError } = await supabase.functions.invoke('process-and-match', {
          body: {
            searchQuery: query,
            location: location || 'Remote',
            debug: debugMode,
            urls: urls,
          },
        });

        if (processError) throw new Error(processError.message);

        if (processData.error) {
          const detail = processData.detail || 'An unknown error occurred.';
          setError({ message: `Failed to start job search: ${detail}` });
          setQueueStatus('idle');
          return;
        }

        if (processData.reason === 'no_job_sources_configured') {
          setError({ message: 'No job sources configured.', link: '/dashboard/settings' });
          setQueueStatus('idle');
          return;
        }

        if (processData.jobId) {
          setPollingJobId(processData.jobId);
          setQueueStatus('populating'); // Keep it in a loading-like state
          setStepIndex(1); // Extracting
          info("Job search started...", `We’re building your results. This may take a few minutes.`);
        } else {
          setError({ message: 'Could not initiate job search process.' });
          setQueueStatus('idle');
        }
      } catch (e: any) {
        setError({ message: `Failed to build job feed: ${e.message}` });
        setQueueStatus('idle');
      }
    }, [supabase, debugMode, info]);

    // Effect for polling the job status
    useEffect(() => {
      if (!pollingJobId) return;

      const interval = setInterval(async () => {
        try {
          const { data: statusData, error: statusError } = await supabase.functions.invoke('get-extract-status', {
            body: { jobId: pollingJobId, searchQuery, searchLocation: selectedLocation },
          });

          if (statusError) throw new Error(statusError.message);

          if (statusData.status === 'completed') {
            clearInterval(interval);
            setPollingJobId(null);
            const inserted = typeof statusData.jobsInserted === 'number'
              ? statusData.jobsInserted
              : (Array.isArray(statusData?.data?.jobs) ? statusData.data.jobs.length : undefined);
            if (!inserted) setLastReason('no_structured_results');
            setStepIndex(2); // Inserting
            info("Job search complete!", inserted ? "Your results have been updated." : "No structured results were found for this search.");
            await fetchJobQueue(); // Refresh the queue with new jobs
          } else if (statusData.status === 'failed') {
            clearInterval(interval);
            setPollingJobId(null);
            setLastReason('deep_research_failed');
            setError({ message: 'Job search failed during processing.' });
            setQueueStatus('idle');
          }
          // If still 'processing', do nothing and let the interval continue.
        } catch (e: any) {
          clearInterval(interval);
          setPollingJobId(null);
          setError({ message: `Failed to check job status: ${e.message}` });
          setQueueStatus('idle');
        }
      }, 10000); // Poll every 10 seconds

      return () => clearInterval(interval);
    }, [pollingJobId, supabase, fetchJobQueue, info, searchQuery, selectedLocation]);

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
            if (initialJobs.length === 0 && profile?.job_title) {
        info("No results yet. Building a personalized job feed...", "This may take a moment.");
                await populateQueue(profile.job_title, profile.location || undefined);
            }
        };

        initialLoad();

        // Set up the real-time subscription
        const channel = supabase
            .channel('jobs-queue-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
                // Refetch the entire queue to ensure UI is in sync
                fetchJobQueue();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profileLoading, profile, fetchJobQueue, populateQueue, supabase, info]);

    // Effect to pre-fill search query from profile
    useEffect(() => {
        if (profile && !searchQuery) {
            setSearchQuery(profile.job_title || '');
            setSelectedLocation(profile.location || 'Remote');
        }
    }, [profile, searchQuery]);

    const sortedJobs = useMemo(() => {
      return [...jobs].sort((a, b) => new Date(b.posted_at || 0).getTime() - new Date(a.posted_at || 0).getTime());
    }, [jobs]);

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
                    <span>Diagnostics</span>
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
              subtitle="We’re discovering sources and extracting job details in the background."
              steps={steps}
              activeStep={stepIndex}
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
              {queueStatus === 'ready' && jobs.length > pageSize && (
                <div className="flex items-center justify-between pt-4 text-xs text-[#ffffff80]">
                  <span>{jobs.length} total</span>
                  <span>Showing first {pageSize} (pagination UI TBD)</span>
                </div>
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
                      {job.posted_at && <span className="ml-auto text-[10px] text-[#ffffff80]">Posted {formatRelative(job.posted_at)}</span>}
                      </div>
                                      </div>
                                  </div>
                              </div>
                              <div className="prose prose-invert max-w-none text-[#ffffffcc] leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.description || '') }} />
                              {job.apply_url && (
                                  <div className="flex justify-end mt-4">
                                      <a href={job.apply_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 rounded-md border border-[#1dff00]/40 text-[#1dff00] bg-[#1dff00]/20 hover:bg-[#1dff00]/30 transition">
                                      View Original Posting
                                      </a>
                                  </div>
                              )}
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