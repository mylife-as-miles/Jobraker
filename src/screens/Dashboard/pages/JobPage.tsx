import { Briefcase, Building2, DollarSign, Share, Star, Users, CheckCircle2, FileText, UploadCloud, Pencil, Play, MapPin, Clock, MoreVertical, Filter, X, Loader2, Sparkles, Plus, ArrowRight, RefreshCw } from "lucide-react";
import { useRegisterCoachMarks, useProductTour } from "../../../providers/TourProvider";
import { events as analyticsEvents } from "../../../lib/analytics";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Search } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "../../../lib/supabaseClient";
import { applyToJobs } from "../../../services/applications/applyToJobs";
import { getRun } from "../../../services/skyvern/getRun";
import { JobListing } from "../../../../supabase/functions/_shared/types";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { SafeSelect } from "../../../components/ui/safe-select";
import { useToast } from "../../../components/ui/toast";
import { ensureApplyReadiness } from "../../../utils/applyPreflight";
import { useResumes } from "@/hooks/useResumes";
import { useProfileSettings } from "../../../hooks/useProfileSettings";

// --- Types ---
interface Job extends JobListing {
  id: string; // Mapped from source_id
  title: string;
  company: string;
  location: string;
  type: "Full-time" | "Part-time" | "Contract" | "Remote" | "Hybrid" | "On-site" | "N/A";
  salary: string;
  postedDate: string;
  rawPostedAt?: number | null;
  description: string;
  requirements: string[];
  benefits: string[];
  isApplied: boolean;
  logo: string;
  logoUrl?: string;
  source?: string;
  status: 'active' | 'applied' | 'archived';
  raw_data: any;
}

type QueueStatus = 'loading' | 'populating' | 'empty' | 'populated' | 'error';

// --- Supabase Client ---
const supabase = createClient();

// --- Helper Functions ---
const sanitizeHtml = (html: string) => {
  if (!html) return "";
  let out = String(html);
  out = out.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");
  out = out.replace(/href\s*=\s*(["'])javascript:[^"']*\1/gi, 'href="#"');
  out = out.replace(/src\s*=\s*(["'])javascript:[^"']*\1/gi, '');
  out = out.replace(/ on[a-z]+\s*=\s*(["']).*?\1/gi, "");
  return out;
};

const companyToDomain = (companyName?: string, tld: string = (import.meta as any).env?.VITE_LOGO_TLD || 'com') => {
  if (!companyName) return undefined;
  const base = companyName.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9\s.-]/g, '').replace(/\s+/g, '').replace(/-+/g, '-');
  return base ? `${base}.${tld}` : undefined;
};

const logoFailureCache = new Set<string>();
const getCompanyLogoUrl = (companyName?: string, sourceUrl?: string): string | undefined => {
  const tld = (import.meta as any).env?.VITE_LOGO_TLD || 'com';
  const tmpl = (import.meta as any).env?.VITE_LOGO_API_TEMPLATE as string | undefined;
  const domainGuess = companyToDomain(companyName, tld);
  if (tmpl && companyName) {
    const withCompany = tmpl.replace('{company}', encodeURIComponent(companyName));
    return domainGuess ? withCompany.replace('{domain}', domainGuess) : withCompany;
  }
  try {
    if (domainGuess) {
      const logoUrl = `https://logo.clearbit.com/${domainGuess}`;
      if (logoFailureCache.has(logoUrl)) return undefined;
      return logoUrl;
    }
  } catch {}
  try {
    if (sourceUrl) {
      const u = new URL(sourceUrl);
      return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(u.hostname)}`;
    }
  } catch {}
  return undefined;
};

const mapDbRowToJob = (r: any): Job => ({
  jobTitle: r.title,
  companyName: r.company,
  fullJobDescription: r.description || '',
  sourceUrl: r.apply_url,
  id: r.source_id,
  title: r.title,
  company: r.company,
  location: r.location,
  type: r.remote_type ? (String(r.remote_type).charAt(0).toUpperCase() + String(r.remote_type).slice(1)) as any : 'N/A',
  salary: (typeof r.salary_min === 'number' || typeof r.salary_max === 'number')
    ? `$${r.salary_min ?? ''}${r.salary_min && r.salary_max ? ' - ' : ''}${r.salary_max ?? ''}${r.salary_period ? ` / ${r.salary_period}` : ''}`
    : 'N/A',
  postedDate: r.posted_at ? new Date(r.posted_at).toLocaleDateString() : 'N/A',
  rawPostedAt: r.posted_at ? new Date(r.posted_at).getTime() : null,
  description: r.description || '',
  requirements: Array.isArray(r.requirements) ? r.requirements : [],
  benefits: Array.isArray(r.benefits) ? r.benefits : [],
  isApplied: r.status === 'applied',
  logo: (r.company?.[0] || '?').toUpperCase(),
  logoUrl: getCompanyLogoUrl(r.company, r.apply_url),
  source: r.source_type || 'db',
  status: r.status,
  raw_data: r.raw_data,
});

// --- Main Component ---
export const JobPage = (): JSX.Element => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("Remote");
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20; // Increased page size for a queue view
  const { profile, loading: profileLoading } = useProfileSettings();
  const { success, error: toastError, info } = useToast();

  const fetchJobQueue = useCallback(async () => {
    setQueueStatus('loading');
    setError(null);
    try {
      const { data, error: funcError } = await supabase.functions.invoke('get-jobs');
      if (funcError) throw funcError;

      const jobRows = data?.jobs || [];
      const mappedJobs = jobRows.map(mapDbRowToJob);
      setJobs(mappedJobs);

      if (mappedJobs.length > 0) {
        setQueueStatus('populated');
        setSelectedJob(mappedJobs[0].id);
      } else {
        setQueueStatus('empty');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to fetch job queue.');
      setQueueStatus('error');
    }
  }, []);

  const populateQueue = useCallback(async () => {
    if (!profile) {
      toastError("Your profile isn't loaded yet.", "Cannot find new jobs without your profile information.");
      return;
    }
    setQueueStatus('populating');
    setError(null);
    try {
      const { error: funcError } = await supabase.functions.invoke('process-and-match', {
        body: {
          searchQuery: profile.job_title || 'Software Engineer',
          location: profile.location || 'Remote',
        },
      });
      if (funcError) throw funcError;
      info("Searching for new jobs...", "Your queue will update in real-time as jobs are found.");
      setTimeout(() => {
        setQueueStatus(prev => (prev === 'populating' ? 'populated' : prev));
      }, 8000);
    } catch (e: any) {
      setError(e.message || 'Failed to populate job queue.');
      setQueueStatus('error');
    }
  }, [profile, toastError, info]);

  // Initial data load and logic
  useEffect(() => {
    if (profileLoading) {
      setQueueStatus('loading');
      return;
    }
    if (!profile) {
      setQueueStatus('error');
      setError("Could not load user profile.");
      return;
    }

    const initialLoad = async () => {
      setQueueStatus('loading');
      setError(null);
      try {
        const { data, error } = await supabase.functions.invoke('get-jobs');
        if (error) throw error;
        const jobRows = data?.jobs || [];
        if (jobRows.length > 0) {
          setJobs(jobRows.map(mapDbRowToJob));
          setQueueStatus('populated');
          setSelectedJob(jobRows[0].id);
        } else {
          populateQueue();
        }
      } catch (e: any) {
        setError(e.message);
        setQueueStatus('error');
      }
    };

    initialLoad();
  }, [profileLoading, profile, populateQueue]);

  // Real-time subscription to the jobs table
  useEffect(() => {
    const channel = supabase
      .channel('jobs-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newJob = mapDbRowToJob(payload.new);
          setJobs(prev => [newJob, ...prev]);
          if (queueStatus !== 'populated') setQueueStatus('populated');
        } else if (payload.eventType === 'UPDATE') {
          const updatedJob = mapDbRowToJob(payload.new);
          setJobs(prev => prev.map(j => j.id === updatedJob.id ? updatedJob : j));
        } else if (payload.eventType === 'DELETE') {
          const deletedId = payload.old.source_id;
          setJobs(prev => prev.filter(j => j.id !== deletedId));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queueStatus]);

  const sortedJobs = useMemo(() =>
    [...jobs].sort((a, b) => (b.rawPostedAt ?? 0) - (a.rawPostedAt ?? 0)),
    [jobs]
  );

  const total = sortedJobs.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (currentPage - 1) * pageSize;
  const end = Math.min(total, start + pageSize);
  const paginatedJobs = sortedJobs.slice(start, end);

  useEffect(() => {
    if (selectedJob && !paginatedJobs.some(j => j.id === selectedJob)) {
      setSelectedJob(paginatedJobs[0]?.id ?? null);
    }
  }, [currentPage, pageSize, selectedJob, paginatedJobs]);

  return (
    <div className="min-h-screen bg-black" role="main" aria-label="Job Queue">
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">Your Job Queue</h1>
              <p className="text-[#ffffff80] text-sm sm:text-base">Your personalized list of job opportunities.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant='outline'
                onClick={populateQueue}
                className="border-[#1dff00]/40 text-[#1dff00] hover:bg-[#1dff00]/10 hover:border-[#1dff00] transition-all"
                disabled={queueStatus === 'populating' || queueStatus === 'loading'}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${queueStatus === 'populating' ? 'animate-spin' : ''}`} />
                Find New Jobs
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-semibold text-white">
                {queueStatus === 'loading' && 'Loading Queue...'}
                {queueStatus === 'populating' && 'Populating Queue...'}
                {queueStatus === 'populated' && `${total} Jobs in Queue`}
                {queueStatus === 'empty' && 'Your Queue is Empty'}
                {queueStatus === 'error' && 'An Error Occurred'}
              </h2>
            </div>

            {(queueStatus === 'loading' || queueStatus === 'populating') && (
              <div className="flex justify-center items-center h-96">
                <Loader2 className="w-12 h-12 text-[#1dff00] animate-spin" />
              </div>
            )}

            {queueStatus === 'error' && (
              <Card className="border border-red-500/30 bg-red-500/10 text-red-200 p-8 text-center">
                <h3 className="text-xl font-medium text-white mb-2">Something went wrong</h3>
                <p className="text-red-200/80 mb-4">{error}</p>
                <Button variant="outline" className="border-red-500/40 text-red-200 hover:bg-red-500/10" onClick={fetchJobQueue}>Retry</Button>
              </Card>
            )}

            {queueStatus === 'empty' && (
              <Card className="bg-gradient-to-br from-[#ffffff08] to-[#ffffff05] border border-[#ffffff15] p-8 text-center">
                <Briefcase className="w-16 h-16 text-[#ffffff40] mx-auto mb-4" />
                <h3 className="text-xl font-medium text-white mb-2">Your Job Queue is Empty</h3>
                <p className="text-[#ffffff80] mb-4">Click the button to find jobs that match your profile.</p>
                <Button className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90" onClick={populateQueue}>
                  Find Jobs Now
                </Button>
              </Card>
            )}

            {queueStatus === 'populated' && (
              <>
                {paginatedJobs.map((job, index) => (
                  <motion.div
                    key={job.id}
                    onClick={() => setSelectedJob(job.id)}
                    className={`cursor-pointer transition-all duration-300 ${selectedJob === job.id ? "transform scale-[1.02]" : "hover:transform hover:scale-[1.01]"}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                  >
                    <Card role="listitem" className={`bg-gradient-to-br from-[#ffffff08] to-[#ffffff05] border p-4 sm:p-6 transition-all duration-300 ${selectedJob === job.id ? "border-[#1dff00] shadow-[0_0_20px_rgba(29,255,0,0.3)]" : "border-[#ffffff15] hover:border-[#1dff00]/50"}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          {job.logoUrl && !logoError[job.id] ? (
                            <img src={job.logoUrl} alt={job.company} className="w-12 h-12 rounded-xl object-contain bg-white flex-shrink-0" onError={() => setLogoError(m => ({ ...m, [job.id]: true }))} />
                          ) : (
                            <div className="w-12 h-12 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-xl flex items-center justify-center text-black font-bold text-lg flex-shrink-0">{job.logo}</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white font-semibold truncate">{job.title}</h3>
                            <p className="text-[#ffffff80] text-sm">{job.company}</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[#ffffff80]">
                        <div className="flex items-center space-x-1"><MapPin className="w-3 h-3" /><span>{job.location}</span></div>
                        <div className="flex items-center space-x-1"><Clock className="w-3 h-3" /><span>{job.postedDate}</span></div>
                        <div className="flex items-center space-x-1"><Briefcase className="w-3 h-3" /><span>{job.type}</span></div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
                <div className="mt-6 flex items-center justify-center gap-3">
                  <Button variant="outline" className="border-[#ffffff33] text-white" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>Prev</Button>
                  <span className="text-[#ffffff80]">Page {currentPage} / {totalPages}</span>
                  <Button className="bg-[#1dff00] text-black" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</Button>
                </div>
              </>
            )}
          </div>

          <div className="lg:sticky lg:top-6 lg:h-fit">
            {selectedJob && (() => {
              const job = jobs.find(j => j.id === selectedJob);
              if (!job) return null;
              return (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
                  <Card className="bg-gradient-to-br from-[#ffffff08] to-[#ffffff05] border border-[#ffffff15] p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-4 flex-1 min-w-0">
                        {job.logoUrl && !logoError[job.id] ? (
                          <img src={job.logoUrl} alt={job.company} className="w-16 h-16 rounded-xl object-contain bg-white flex-shrink-0" onError={() => setLogoError(m => ({ ...m, [job.id]: true }))} />
                        ) : (
                          <div className="w-16 h-16 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-xl flex items-center justify-center text-black font-bold text-xl flex-shrink-0">{job.logo}</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h1 className="text-xl font-bold text-white mb-1">{job.title}</h1>
                          <p className="text-lg text-[#ffffff80]">{job.company}</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-bold text-white mb-3 flex items-center"><Building2 className="w-5 h-5 mr-2" /> Job Description</h3>
                        <div className="prose prose-invert max-w-none text-[#ffffffcc] leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.description) }} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white mb-3 flex items-center"><Star className="w-5 h-5 mr-2" /> Requirements</h3>
                        <ul className="space-y-2 pl-2">
                          {job.requirements.map((req, index) => (
                            <li key={index} className="flex items-start space-x-2 text-[#ffffff80]">
                              <div className="w-1.5 h-1.5 mt-1.5 bg-[#1dff00] rounded-full flex-shrink-0"></div>
                              <span>{req}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {job.benefits.length > 0 && (
                        <div>
                          <h3 className="text-lg font-bold text-white mb-3 flex items-center"><Users className="w-5 h-5 mr-2" /> Benefits</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {job.benefits.map((benefit, index) => (
                              <div key={index} className="flex items-center space-x-2 text-[#ffffff80]">
                                <div className="w-1.5 h-1.5 bg-[#1dff00] rounded-full flex-shrink-0"></div>
                                <span>{benefit}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {job.sourceUrl && (
                        <div className="flex justify-end pt-4">
                          <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 rounded-md border border-[#1dff00]/40 text-[#1dff00] bg-[#1dff00]/20 hover:bg-[#1dff00]/30 transition">
                            Open original posting
                          </a>
                        </div>
                      )}
                    </div>
                  </Card>
                </motion.div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};