import { Briefcase, Building2, DollarSign, Share, Star, Users, CheckCircle2, FileText, UploadCloud, Pencil, Play, MapPin, Clock, MoreVertical, Filter, X, Loader2, Sparkles, Plus, ArrowRight } from "lucide-react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Search } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "../../../lib/supabaseClient";
import { useProfileSettings } from "../../../hooks/useProfileSettings";
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
}

const supabase = createClient();

// Helper to map a DB row from the `jobs` table to the frontend `Job` interface
const mapDbJobToUiJob = (dbJob: any): Job => {
    return {
      ...dbJob,
      id: dbJob.id,
      description: dbJob.description || dbJob.raw_data?.fullJobDescription || '',
      logoUrl: getCompanyLogoUrl(dbJob.company, dbJob.apply_url),
      logo: dbJob.company?.[0]?.toUpperCase() || '?',
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

const getCompanyLogoUrl = (companyName?: string, sourceUrl?: string): string | undefined => {
    if (!companyName) return undefined;
    try {
        const domain = new URL(sourceUrl || `https://www.${companyName.toLowerCase().replace(/\s/g, '')}.com`).hostname;
        return `https://logo.clearbit.com/${domain}`;
    } catch {
        return undefined;
    }
};

export const JobPage = (): JSX.Element => {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedLocation, setSelectedLocation] = useState("Remote");
    const [selectedJob, setSelectedJob] = useState<string | null>(null);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [queueStatus, setQueueStatus] = useState<'idle' | 'loading' | 'populating' | 'ready' | 'empty'>('idle');
    const [error, setError] = useState<string | null>(null);
    const [logoError, setLogoError] = useState<Record<string, boolean>>({});
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(10);

    const { profile, loading: profileLoading } = useProfileSettings();
    const { info } = useToast();

    // Fetches jobs from the user's personal 'jobs' table
    const fetchJobQueue = useCallback(async () => {
      setQueueStatus('loading');
      setError(null);
      try {
        const { data, error: fetchError } = await supabase.functions.invoke('get-jobs');
        if (fetchError) throw fetchError;

        const jobList = (data.jobs || []).map(mapDbJobToUiJob);
        setJobs(jobList);

        if (jobList.length > 0) {
          setQueueStatus('ready');
          setSelectedJob(jobList[0].id);
        } else {
          setQueueStatus('empty');
        }
      } catch (e: any) {
        setError(e.message);
        setQueueStatus('idle');
      }
    }, [supabase]);

    // Populates the queue by calling the backend, then fetches the results
    const populateQueue = useCallback(async (query: string, location?: string) => {
      setQueueStatus('populating');
      setError(null);
      try {
        const { error: processError } = await supabase.functions.invoke('process-and-match', {
          body: { searchQuery: query, location: location || 'Remote' },
        });
        if (processError) throw processError;
        // The real-time subscription will handle updating the job list.
        // No need to call fetchJobQueue() here as it would be redundant.
        info("Job queue is being updated...", "New jobs will appear shortly.");
      } catch (e: any) {
        setError(`Failed to build job feed: ${e.message}`);
        setQueueStatus('idle');
      }
    }, [supabase, info]);

    // Effect for initial load and auto-population
    useEffect(() => {
        if (profileLoading) {
            setQueueStatus('loading');
            return;
        }

        // Once profile is loaded, check if we need to auto-populate
        if (queueStatus === 'empty' && profile?.job_title) {
            info("Your queue is empty. Building a personalized job feed...", "This may take a moment.");
            populateQueue(profile.job_title, profile.location);
        }
    }, [profileLoading, profile, queueStatus, populateQueue, info]);

    // Initial fetch and real-time subscription
    useEffect(() => {
      fetchJobQueue(); // Initial fetch

      const channel = supabase
        .channel('jobs-queue-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
          fetchJobQueue(); // Refetch whenever a change occurs
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [supabase, fetchJobQueue]);

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
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const paginatedJobs = sortedJobs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    useEffect(() => {
      if (selectedJob && !paginatedJobs.some(j => j.id === selectedJob)) {
        setSelectedJob(paginatedJobs[0]?.id ?? null);
      }
    }, [currentPage, pageSize, selectedJob, paginatedJobs]);

    return (
      <div className="min-h-screen bg-black" role="main" aria-label="Job search">
        <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">Your Job Queue</h1>
                <p className="text-[#ffffff80] text-sm sm:text-base">A personalized list of jobs waiting for you.</p>
              </div>
              <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => populateQueue(searchQuery, selectedLocation)}
                    className="text-[#1dff00] hover:bg-[#1dff00]/10"
                    title="Find a fresh batch of jobs"
                    disabled={queueStatus === 'populating'}
                  >
                    {queueStatus === 'populating' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                    {queueStatus === 'populating' ? 'Building new queue...' : 'Find New Jobs'}
                  </Button>
                </div>
            </div>
          </div>

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
                  {queueStatus === 'loading' && "Loading your queue..."}
                  {queueStatus === 'populating' && "Building your new job queue..."}
                  {(queueStatus === 'ready' || queueStatus === 'empty') && `${total} Jobs Found`}
                </h2>
              </div>

              { (queueStatus === 'loading' || queueStatus === 'populating') && (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <Card className="bg-gradient-to-br from-[#ffffff08] to-[#ffffff05] border border-[#ffffff15] p-4">
                          <div className="flex items-start gap-3">
                              <div className="w-12 h-12 bg-[#ffffff1a] rounded-xl" />
                              <div className="flex-1 space-y-2">
                                  <div className="h-4 bg-[#ffffff1a] rounded w-2/3" />
                                  <div className="h-3 bg-[#ffffff12] rounded w-1/2" />
                              </div>
                          </div>
                      </Card>
                    </div>
                  ))}
                </div>
              )}

              {error && <Card className="border-red-500/30 bg-red-500/10 text-red-200 p-4">{error}</Card>}

              {queueStatus === 'empty' && (
                <Card className="bg-gradient-to-br from-[#ffffff08] to-[#ffffff05] border border-[#ffffff15] p-8 text-center">
                  <Briefcase className="w-14 h-14 text-[#ffffff40] mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-white mb-2">Your Queue is Empty</h3>
                  <p className="text-[#ffffff80] mb-4">Click "Find New Jobs" to build your personalized job feed.</p>
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
                          <p className="text-[#ffffff80] text-sm">{job.company}</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
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
                                          <p className="text-lg text-[#ffffff80] mb-2">{job.company}</p>
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