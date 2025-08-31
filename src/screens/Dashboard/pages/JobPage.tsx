import { useState, useEffect, useCallback } from "react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { 
  Search, 
  MapPin, 
  Bookmark, 
  Clock, 
  Briefcase, 
  Share, 
  Heart, 
  MoreVertical,
  Filter,
  Star,
  Building2,
  DollarSign,
  Users
} from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "../../../lib/supabaseClient";
import { JobListing } from "../../../../supabase/functions/_shared/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { useToast } from "../../../components/ui/toast";

interface Job extends JobListing {
  id: string;
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
  isBookmarked: boolean;
  isApplied: boolean;
  logo: string;
  logoUrl?: string;
  source?: string;
}

const supabase = createClient();

// Minimal HTML sanitizer to render job descriptions safely
const sanitizeHtml = (html: string) => {
  if (!html) return "";
  let out = String(html);
  // strip script/style tags and contents
  out = out.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");
  // neutralize javascript: URLs
  out = out.replace(/href\s*=\s*(["'])javascript:[^"']*\1/gi, 'href="#"');
  out = out.replace(/src\s*=\s*(["'])javascript:[^"']*\1/gi, '');
  // remove on* event handlers
  out = out.replace(/ on[a-z]+\s*=\s*(["']).*?\1/gi, "");
  return out;
};

// Lightweight bullet extractor from description as a fallback
const extractSectionBullets = (htmlOrText: string, heads: string[]): string[] => {
  if (!htmlOrText) return [];
  const clean = String(htmlOrText).replace(/\r/g, "");
  const lower = clean.toLowerCase();
  for (const h of heads) {
    const idx = lower.indexOf(h);
    if (idx !== -1) {
      const segment = clean.slice(idx, idx + 2000);
      const liMatches = Array.from(segment.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)).map(m => m[1].replace(/<[^>]+>/g, '').trim());
      if (liMatches.length) return liMatches.filter(Boolean).slice(0, 20);
      const lines = segment.split(/\n+/).map(s => s.trim());
      const bullets = lines.filter(s => /^[-*•]/.test(s)).map(s => s.replace(/^[-*•]\s*/, ''));
      if (bullets.length) return bullets.slice(0, 20);
    }
  }
  return [];
};

// Try to derive a company domain from the name
const companyToDomain = (companyName?: string, tld: string = (import.meta as any).env?.VITE_LOGO_TLD || 'com') => {
  if (!companyName) return undefined;
  const base = companyName
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s.-]/g, '')
    .replace(/\s+/g, '')
    .replace(/-+/g, '-');
  if (!base) return undefined;
  return `${base}.${tld}`;
};

// Try to get a company logo URL via optional API template, Clearbit/Google favicon, or initials
const getCompanyLogoUrl = (companyName?: string, sourceUrl?: string): string | undefined => {
  const tld = (import.meta as any).env?.VITE_LOGO_TLD || 'com';
  const tmpl = (import.meta as any).env?.VITE_LOGO_API_TEMPLATE as string | undefined;
  const domainGuess = companyToDomain(companyName, tld);
  if (tmpl && companyName) {
    const withCompany = tmpl.replace('{company}', encodeURIComponent(companyName));
    if (domainGuess) return withCompany.replace('{domain}', domainGuess);
    return withCompany;
  }
  try {
    if (domainGuess) {
      // Prefer Clearbit-like logo by domain
      return `https://logo.clearbit.com/${domainGuess}`;
    }
  } catch {}
  // As a last resort, attempt Google’s favicon service based on the source domain
  try {
    if (sourceUrl) {
      const u = new URL(sourceUrl);
      return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(u.hostname)}`;
    }
  } catch {}
  // Final fallback will be DiceBear initials handled by caller UI
  return undefined;
};

// A simple debounce hook
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
};

export const JobPage = (): JSX.Element => {
  const [searchQuery, setSearchQuery] = useState("Software Engineer");
  const [selectedLocation, setSelectedLocation] = useState("Remote");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultNote, setResultNote] = useState<string | null>(null);
  const [resultSource, setResultSource] = useState<"live" | "db" | null>(null);
  const [logoError, setLogoError] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<'relevance' | 'posted_desc'>('relevance');
  const { success, error: toastError, info } = useToast();

  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const debouncedSelectedLocation = useDebounce(selectedLocation, 500);

  const performSearch = useCallback(async () => {
    if (!debouncedSearchQuery) {
      setJobs([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('process-and-match', {
        body: {
          searchQuery: debouncedSearchQuery,
          location: debouncedSelectedLocation,
          // pass work type when selected
          type: selectedType === 'All' ? undefined : selectedType,
        },
      });

      if (error) throw error;

      let { matchedJobs, note } = data || { matchedJobs: [], note: null };
      setResultNote(note ?? null);
      setResultSource(note ? 'db' : 'live');

      // If scraping returned nothing, fallback to DB-backed function
      if (!Array.isArray(matchedJobs) || matchedJobs.length === 0) {
        const fallback = await supabase.functions.invoke('get-jobs', {
          body: { q: debouncedSearchQuery, location: debouncedSelectedLocation, type: selectedType === 'All' ? '' : selectedType }
        });
        if (!fallback.error) {
          const rows = fallback.data?.jobs || [];
          matchedJobs = rows.map((r: any) => ({
            jobTitle: r.job_title,
            companyName: r.company_name,
            location: r.location,
            workType: r.work_type,
            experienceLevel: r.experience_level,
            requiredSkills: r.required_skills,
            fullJobDescription: r.full_job_description,
            sourceUrl: r.source_url,
            salary_min: r.salary_min,
            salary_max: r.salary_max,
            _source: r.source || 'db',
            _posted_at: r.posted_at,
          }));
          setResultSource('db');
          setResultNote('fallback: provider_unavailable');
        }
      }

      const newJobs = (matchedJobs as (JobListing & { _source?: string; salary_min?: number | null; salary_max?: number | null; requirements?: string[]; benefits?: string[]; })[]).map((job) => ({
        ...job,
        id: job.sourceUrl || `${job.jobTitle}-${job.companyName}`,
        title: job.jobTitle,
        company: job.companyName,
        type: (job as any).workType || "N/A",
        salary: typeof (job as any).salary_min === 'number' || typeof (job as any).salary_max === 'number'
          ? `$${(job as any).salary_min ?? ''}${(job as any).salary_min && (job as any).salary_max ? ' - ' : ''}${(job as any).salary_max ?? ''}`
          : "N/A",
  postedDate: (job as any)._posted_at ? new Date((job as any)._posted_at).toLocaleDateString() : "N/A",
  rawPostedAt: (job as any)._posted_at ? new Date((job as any)._posted_at).getTime() : null,
        description: job.fullJobDescription,
        requirements: (job as any).requirements && (job as any).requirements.length
          ? (job as any).requirements
          : (job.requiredSkills && job.requiredSkills.length ? job.requiredSkills : extractSectionBullets(job.fullJobDescription, ['requirements', 'qualifications', "what you'll need", 'what you will need'])),
        benefits: (job as any).benefits && (job as any).benefits.length
          ? (job as any).benefits
          : extractSectionBullets(job.fullJobDescription, ['benefits', 'perks', 'what we offer', 'what you get', 'compensation & benefits']),
        isBookmarked: false,
        isApplied: false,
        logo: job.companyName?.[0]?.toUpperCase() || '?',
        logoUrl: getCompanyLogoUrl(job.companyName, job.sourceUrl),
        // marker for UI badge
        source: (job as any)._source || (note ? 'db' : 'scraped'),
      }));

      setJobs(newJobs);
      setCurrentPage(1);
      setSelectedJob(newJobs[0]?.id ?? null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchQuery, debouncedSelectedLocation, selectedType]);

  // Load existing bookmarks for the user to hydrate isBookmarked
  useEffect(() => {
    (async () => {
      try {
        const { data: userData } = await (supabase as any).auth.getUser();
        const uid = (userData as any)?.user?.id;
        if (!uid) return;
        const { data } = await (supabase as any)
          .from('bookmarks')
          .select('source_url')
          .eq('user_id', uid)
          .order('created_at', { ascending: false });
        const bookmarked = new Set((data || []).map((r: any) => r.source_url));
        setJobs((prev) => prev.map((j) => ({ ...j, isBookmarked: j.sourceUrl ? bookmarked.has(j.sourceUrl) : j.isBookmarked })));
      } catch {}
    })();
  }, []);

  const toggleBookmark = useCallback(async (job: Job) => {
    try {
      const { data: userData } = await (supabase as any).auth.getUser();
      const uid = (userData as any)?.user?.id;
      if (!uid) {
        toastError('Login required', 'Sign in to save jobs');
        return;
      }
      const isBookmarked = job.isBookmarked;
      // optimistic UI
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, isBookmarked: !isBookmarked } : j)));
      if (!isBookmarked) {
        const payload = {
          user_id: uid,
          source_url: job.sourceUrl,
          job_title: job.title,
          company: job.company,
          location: job.location,
          logo: job.logoUrl ?? null,
        };
        const { error } = await (supabase as any)
          .from('bookmarks')
          .insert(payload);
        if (error) throw error;
        success('Saved', `${job.title} @ ${job.company}`);
      } else {
        const { error } = await (supabase as any)
          .from('bookmarks')
          .delete()
          .eq('source_url', job.sourceUrl)
          .then(async (res: any) => res);
        if (error) throw error;
        info('Removed bookmark');
      }
    } catch (e: any) {
      toastError('Bookmark failed', e.message || 'Try again');
      // revert
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, isBookmarked: job.isBookmarked } : j)));
    }
  }, [supabase, success, toastError, info]);

  const quickApply = useCallback(async (job: Job) => {
    try {
      const { data: userData } = await (supabase as any).auth.getUser();
      const uid = (userData as any)?.user?.id;
      if (!uid) {
        toastError('Login required', 'Sign in to apply');
        return;
      }
      // Create minimal application record
      const { error } = await (supabase as any)
        .from('applications')
        .insert({
          user_id: uid,
          job_title: job.title,
          company: job.company,
          location: job.location,
          applied_date: new Date().toISOString(),
          status: 'Applied',
          logo: job.logoUrl ?? null,
          notes: job.sourceUrl ? `Applied via JobRaker: ${job.sourceUrl}` : null,
        });
      if (error) throw error;
      success('Application added', `${job.title} @ ${job.company}`);
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, isApplied: true } : j)));
    } catch (e: any) {
      toastError('Apply failed', e.message || 'Try again');
    }
  }, [supabase, success, toastError]);

  const shareJob = useCallback(async (job: Job) => {
    try {
      const url = job.sourceUrl || window.location.href;
      await navigator.clipboard.writeText(url);
      info('Link copied');
    } catch {
      toastError('Copy failed');
    }
  }, [info, toastError]);

  useEffect(() => {
    performSearch();
  }, [performSearch]);

  const filteredJobs = jobs.filter(job => {
    const matchesType = selectedType === "All" || job.type === selectedType;
    return matchesType;
  });

  const sortedJobs = (() => {
    if (sortBy === 'posted_desc') {
      return [...filteredJobs].sort((a, b) => {
        const at = a.rawPostedAt ?? -Infinity;
        const bt = b.rawPostedAt ?? -Infinity;
        return bt - at;
      });
    }
    // relevance: keep original order
    return filteredJobs;
  })();

  const total = sortedJobs.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (currentPage - 1) * pageSize;
  const end = Math.min(total, start + pageSize);
  const paginatedJobs = sortedJobs.slice(start, end);

  useEffect(() => {
    // ensure selected item remains visible on page change
    if (selectedJob && !paginatedJobs.some(j => j.id === selectedJob)) {
      setSelectedJob(paginatedJobs[0]?.id ?? null);
    }
  }, [currentPage, pageSize, selectedJob, paginatedJobs]);

  // Keyboard navigation: Up/Down select, PageUp/PageDown change page
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName.match(/INPUT|TEXTAREA|SELECT/)) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!selectedJob && paginatedJobs.length) {
          setSelectedJob(paginatedJobs[0].id);
          return;
        }
        const idx = paginatedJobs.findIndex(j => j.id === selectedJob);
        if (idx >= 0 && idx < paginatedJobs.length - 1) setSelectedJob(paginatedJobs[idx + 1].id);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const idx = paginatedJobs.findIndex(j => j.id === selectedJob);
        if (idx > 0) setSelectedJob(paginatedJobs[idx - 1].id);
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        setCurrentPage(p => Math.min(totalPages, p + 1));
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        setCurrentPage(p => Math.max(1, p - 1));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [paginatedJobs, selectedJob, totalPages]);

  return (
    <div className="min-h-screen bg-black">
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">Job Search</h1>
              <div className="flex items-center gap-2">
                <p className="text-[#ffffff80] text-sm sm:text-base">Find your next opportunity</p>
                {resultSource && (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wide border ${
                      resultSource === 'live'
                        ? 'border-[#1dff00]/40 text-[#1dff00] bg-[#1dff0033]'
                        : 'border-amber-400/40 text-amber-300 bg-amber-500/10'
                    }`}
                    title={resultNote || undefined}
                  >
                    {resultSource === 'live' ? 'Live' : 'DB fallback'}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <Button 
                variant="outline" 
                className="border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:border-[#1dff00]/50 hover:scale-105 transition-all duration-300"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
              <Button 
                className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 hover:scale-105 transition-all duration-300"
              >
                <Bookmark className="w-4 h-4 mr-2" />
                Saved Jobs
              </Button>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Search Input */}
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#ffffff60]" />
              <Input
                placeholder="Search jobs, companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] hover:border-[#ffffff4d] transition-all duration-300"
              />
            </div>
            
            {/* Location Filter */}
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#ffffff60]" />
              <Input
                placeholder="Location..."
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="pl-10 bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] hover:border-[#ffffff4d] transition-all duration-300"
              />
            </div>
            
            {/* Work Type Filter */}
            <div className="flex gap-1">
              {["All", "Remote", "Hybrid", "On-site"].map((type) => (
                <Button
                  key={type}
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedType(type)}
                  className={`text-xs flex-1 transition-all duration-300 hover:scale-105 ${
                    selectedType === type
                      ? "bg-[#1dff00] text-black hover:bg-[#1dff00]/90"
                      : "text-[#ffffff80] hover:text-white hover:bg-[#ffffff1a]"
                  }`}
                >
                  {type}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Job List and Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Job List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-semibold text-white">
                {loading ? "Searching..." : `${filteredJobs.length} Jobs Found`}
              </h2>
              <div className="flex items-center space-x-2 text-sm text-[#ffffff80]">
                <span className="hidden sm:inline">Showing</span>
                <span className="text-white">{start + 1}–{end}</span>
                <span>of</span>
                <span className="text-white">{total}</span>
                <div className="hidden md:flex items-center gap-2 ml-3">
                  <span>Rows:</span>
                  <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(parseInt(v)); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[90px] h-8">
                      <SelectValue placeholder="Rows" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="hidden md:flex items-center gap-2 ml-3">
                  <span>Sort:</span>
                  <Select value={sortBy} onValueChange={(v) => { setSortBy(v as any); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[160px] h-8">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevance">Relevance</SelectItem>
                      <SelectItem value="posted_desc">Date (Newest)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="ml-2 hidden sm:flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="text-[#1dff00] hover:bg-[#1dff00]/10 disabled:opacity-50"
                  >
                    Prev
                  </Button>
                  <span className="text-[#ffffff80]">Page {currentPage} / {totalPages}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="text-[#1dff00] hover:bg-[#1dff00]/10 disabled:opacity-50"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
            {loading && (
              <div className="space-y-4">
                {Array.from({ length: pageSize }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-4 sm:p-6">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#ffffff1a] rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-[#ffffff1a] rounded w-2/3" />
                          <div className="h-3 bg-[#ffffff12] rounded w-1/2" />
                          <div className="flex gap-2 mt-2">
                            <div className="h-3 bg-[#ffffff12] rounded w-24" />
                            <div className="h-3 bg-[#ffffff12] rounded w-20" />
                            <div className="h-3 bg-[#ffffff12] rounded w-16" />
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            )}
            {error && <p className="text-red-500">{error}</p>}

            {!loading && !error && paginatedJobs.map((job, index) => (
              <motion.div
                key={job.id}
                onClick={() => setSelectedJob(job.id)}
                className={`cursor-pointer transition-all duration-300 ${
                  selectedJob === job.id
                    ? "transform scale-[1.02]"
                    : "hover:transform hover:scale-[1.01]"
                }`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                whileHover={{ x: 4 }}
              >
                <Card className={`bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border backdrop-blur-[25px] p-4 sm:p-6 transition-all duration-300 hover:shadow-lg ${
                  selectedJob === job.id
                    ? "border-[#1dff00] shadow-[0_0_20px_rgba(29,255,0,0.3)]"
                    : "border-[#ffffff15] hover:border-[#1dff00]/50"
                }`}>
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        {job.logoUrl && !logoError[job.id] ? (
                          <img
                            src={job.logoUrl}
                            alt={job.company}
                            className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-contain bg-white flex-shrink-0"
                            onError={() => setLogoError((m) => ({ ...m, [job.id]: true }))}
                          />
                        ) : (
                          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-xl flex items-center justify-center text-black font-bold text-lg flex-shrink-0">
                            {job.logo}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-semibold text-sm sm:text-base lg:text-lg truncate">{job.title}</h3>
                          <p className="text-[#ffffff80] text-xs sm:text-sm">{job.company}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => { e.stopPropagation(); toggleBookmark(job); }}
                          className={`text-[#ffffff60] hover:text-white hover:scale-110 transition-all duration-300 ${
                            job.isBookmarked ? "text-[#1dff00]" : ""
                          }`}
                        >
                          <Bookmark className={`w-4 h-4 ${job.isBookmarked ? "fill-current" : ""}`} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => { e.stopPropagation(); shareJob(job); }}
                          className="text-[#ffffff60] hover:text-white hover:scale-110 transition-all duration-300"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Details */}
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-[#ffffff80]">
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span>{job.location}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span>{job.postedDate}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Briefcase className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span>{job.type}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          <DollarSign className="w-4 h-4 text-[#1dff00]" />
                          <span className="text-sm sm:text-base text-white font-semibold">{job.salary}</span>
                        </div>
                        {"source" in job && (job as any).source && (
                          <span className="ml-2 px-2 py-0.5 rounded text-[10px] uppercase tracking-wide border border-[#ffffff33] text-[#ffffffb3] bg-[#ffffff14]">{(job as any).source}</span>
                        )}
                      </div>
                      
                        <div className="flex items-center space-x-2">
                        <span className="px-2 py-1 bg-[#ffffff1a] text-white text-xs rounded border border-[#ffffff33]">{job.type}</span>
                        {job.isApplied && (
                          <span className="px-2 py-1 bg-[#1dff0020] text-[#1dff00] text-xs rounded border border-[#1dff00]/30">Applied</span>
                        )}
                          {job.sourceUrl && (
                            <a
                              href={job.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                              className="px-2 py-1 text-xs rounded border border-[#ffffff33] text-[#ffffffb3] bg-[#ffffff14] hover:bg-[#1dff00]/10 hover:border-[#1dff00]/40 transition"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View posting
                            </a>
                          )}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Job Details */}
          <div className="lg:sticky lg:top-6 lg:h-fit">
            {selectedJob ? (
              <>
                {(() => {
                  const job = jobs.find(j => j.id === selectedJob);
                  if (!job) return null;
                  
                  return (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      {/* Job Header */}
                      <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6 mb-6 hover:shadow-lg transition-all duration-300">
                        <div className="flex items-start justify-between mb-6">
                          <div className="flex items-center space-x-4 flex-1 min-w-0">
                            {job.logoUrl && !logoError[job.id] ? (
                              <img
                                src={job.logoUrl}
                                alt={job.company}
                                className="w-16 h-16 rounded-xl object-contain bg-white flex-shrink-0"
                                onError={() => setLogoError((m) => ({ ...m, [job.id]: true }))}
                              />
                            ) : (
                              <div className="w-16 h-16 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-xl flex items-center justify-center text-black font-bold text-xl flex-shrink-0">
                                {job.logo}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">{job.title}</h1>
                              <p className="text-lg text-[#ffffff80] mb-2">{job.company}</p>
                              <div className="flex flex-wrap items-center gap-3 text-sm text-[#ffffff60]">
                                <div className="flex items-center space-x-1">
                                  <MapPin className="w-4 h-4" />
                                  <span>{job.location}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Clock className="w-4 h-4" />
                                  <span>Posted {job.postedDate}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Briefcase className="w-4 h-4" />
                                  <span>{job.type}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2 flex-shrink-0">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-[#ffffff80] hover:text-white hover:scale-110 transition-all duration-300"
                            >
                              <Share className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-[#ffffff80] hover:text-white hover:scale-110 transition-all duration-300"
                            >
                              <Heart className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-1">
                              <DollarSign className="w-5 h-5 text-[#1dff00]" />
                              <span className="text-xl font-bold text-white">{job.salary}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3 w-full sm:w-auto">
                            <Button 
                              variant="outline" 
                              onClick={() => toggleBookmark(job)}
                              className="border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:border-[#1dff00]/50 hover:scale-105 transition-all duration-300 flex-1 sm:flex-none"
                            >
                              <Bookmark className="w-4 h-4 mr-2" />
                              {job.isBookmarked ? 'Unsave' : 'Save Job'}
                            </Button>
                            <Button 
                              onClick={() => quickApply(job)}
                              className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 hover:scale-105 transition-all duration-300 flex-1 sm:flex-none"
                            >
                              {job.isApplied ? "Applied" : "Apply Now"}
                            </Button>
                          </div>
                        </div>
                      </Card>

                      {/* Job Content */}
                      <div className="space-y-6">
                        {/* Description */}
                        <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6 hover:shadow-lg transition-all duration-300">
                          <h3 className="text-lg font-bold text-white mb-3 flex items-center">
                            <Building2 className="w-5 h-5 mr-2 text-white" />
                            Job Description
                          </h3>
                          <div className="prose prose-invert max-w-none text-[#ffffffcc] leading-relaxed">
                            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.description) }} />
                          </div>
                        </Card>
                        
                        {/* Requirements */}
                        <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6 hover:shadow-lg transition-all duration-300">
                          <h3 className="text-lg font-bold text-white mb-3 flex items-center">
                            <Star className="w-5 h-5 mr-2 text-white" />
                            Requirements
                          </h3>
                          <ul className="space-y-2">
                            {job.requirements.map((req, index) => (
                              <motion.li 
                                key={index} 
                                className="flex items-center space-x-2 text-[#ffffff80]"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                              >
                                <div className="w-1.5 h-1.5 bg-[#1dff00] rounded-full flex-shrink-0"></div>
                                <span>{req}</span>
                              </motion.li>
                            ))}
                          </ul>
                        </Card>
                        
                        {/* Benefits */}
                        <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6 hover:shadow-lg transition-all duration-300">
                          <h3 className="text-lg font-bold text-white mb-3 flex items-center">
                            <Users className="w-5 h-5 mr-2 text-white" />
                            Benefits
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {job.benefits.map((benefit, index) => (
                              <motion.div 
                                key={index} 
                                className="flex items-center space-x-2 text-[#ffffff80]"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                              >
                                <div className="w-1.5 h-1.5 bg-[#1dff00] rounded-full flex-shrink-0"></div>
                                <span>{benefit}</span>
                              </motion.div>
                            ))}
                          </div>
                        </Card>
                        {/* External Link */}
                        {job.sourceUrl && (
                          <div className="flex justify-end">
                            <a
                              href={job.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                              className="inline-flex items-center px-4 py-2 rounded-md border border-[#1dff00]/40 text-[#1dff00] bg-[#1dff0033] hover:bg-[#1dff004d] transition"
                            >
                              Open original job posting
                            </a>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })()}
              </>
            ) : (
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-8 text-center">
                <Briefcase className="w-16 h-16 text-[#ffffff40] mx-auto mb-4" />
                <h3 className="text-xl font-medium text-white mb-2">Select a job</h3>
                <p className="text-[#ffffff60]">Choose a job from the list to view details</p>
              </Card>
            )}
          </div>
        </div>

  {/* Mobile Pagination & Controls */}
        <div className="mt-6 flex sm:hidden items-center justify-center gap-3">
          <Button
            variant="outline"
            className="border-[#ffffff33] text-white hover:bg-[#ffffff1a]"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          >
            Prev
          </Button>
          <span className="text-[#ffffff80]">{currentPage} / {totalPages}</span>
          <Button
            className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};