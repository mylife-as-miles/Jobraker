import { Briefcase, Bookmark, Building2, DollarSign, Heart, Share, Star, Users, CheckCircle2, FileText, UploadCloud } from "lucide-react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Search, MapPin, Clock, Filter } from "lucide-react";
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
// import { createClient as createSbClient } from "@/lib/supabaseClient";

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

type FacetItem = { value: string; count: number };

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

// Cache for failed logo URLs to avoid repeated 404s
const logoFailureCache = new Set<string>();

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
      const logoUrl = `https://logo.clearbit.com/${domainGuess}`;
      // Skip if we already know this URL fails
      if (logoFailureCache.has(logoUrl)) {
        return undefined;
      }
      return logoUrl;
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
  const [lastLiveJobs, setLastLiveJobs] = useState<Job[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultNote, setResultNote] = useState<string | null>(null);
  const [resultSource, setResultSource] = useState<"live" | "db" | null>(null);
  const [logoError, setLogoError] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<'relevance' | 'posted_desc'>('relevance');
  // Facet state
  const [facets, setFacets] = useState<{ requirements: FacetItem[]; benefits: FacetItem[] }>({ requirements: [], benefits: [] });
  const [selectedReq, setSelectedReq] = useState<Set<string>>(new Set());
  const [selectedBen, setSelectedBen] = useState<Set<string>>(new Set());
  const [facetLoading, setFacetLoading] = useState(false);
  // Salary and time filters
  const [minSalary, setMinSalary] = useState<string>("");
  const [maxSalary, setMaxSalary] = useState<string>("");
  const [postedSince, setPostedSince] = useState<string>(""); // days: 3,7,14,30
  const { success, error: toastError, info } = useToast();
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<{ profile: boolean; resume: boolean } | null>(null);

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
      // Optionally provide Firecrawl key from local env for development
      const headers: Record<string, string> = {};
      const fcKey = (import.meta as any).env?.VITE_FIRECRAWL_API_KEY as string | undefined;
      if (fcKey) headers['x-firecrawl-api-key'] = fcKey;

      const { data, error } = await supabase.functions.invoke('process-and-match', {
        body: {
          searchQuery: debouncedSearchQuery,
          location: debouncedSelectedLocation,
          // pass work type when selected
          type: selectedType === 'All' ? undefined : selectedType,
        },
        headers,
      });

      if (error) throw error;

      let { matchedJobs, note } = data || { matchedJobs: [], note: null };
      setResultNote(note ?? null);
      setResultSource(note ? 'db' : 'live');

      // If scraping returned nothing, fallback to DB-backed function
      if (!Array.isArray(matchedJobs) || matchedJobs.length === 0) {
        const fallback = await supabase.functions.invoke('get-jobs', {
          body: {
            q: debouncedSearchQuery,
            location: debouncedSelectedLocation,
            type: selectedType === 'All' ? '' : selectedType,
            minSalary: minSalary ? Number(minSalary) : undefined,
            maxSalary: maxSalary ? Number(maxSalary) : undefined,
            posted: postedSince ? Number(postedSince) : undefined,
          }
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
            salary_period: r.salary_period,
            salary_currency: r.salary_currency,
            requirements: r.requirements,
            benefits: r.benefits,
            _source: r.source || 'db',
            _posted_at: r.posted_at,
          }));
          setResultSource('db');
          setResultNote('fallback: provider_unavailable');
        }
      }

      const newJobs = (matchedJobs as (JobListing & { _source?: string; salary_min?: number | null; salary_max?: number | null; salary_period?: string | null; salary_currency?: string | null; requirements?: string[]; benefits?: string[]; })[]).map((job) => ({
        ...job,
        id: job.sourceUrl || `${job.jobTitle}-${job.companyName}`,
        title: job.jobTitle,
        company: job.companyName,
        type: (job as any).workType || "N/A",
        salary: (typeof (job as any).salary_min === 'number' || typeof (job as any).salary_max === 'number')
          ? `$${(job as any).salary_min ?? ''}${(job as any).salary_min && (job as any).salary_max ? ' - ' : ''}${(job as any).salary_max ?? ''}${(job as any).salary_period ? ` / ${(job as any).salary_period}` : ''}`
          : ((job as any).salary_period && ((job as any).salary_min || (job as any).salary_max))
            ? `$${(job as any).salary_min ?? (job as any).salary_max ?? ''} / ${(job as any).salary_period}`
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
      // remember last live results so clearing facets restores them
      if (!note) setLastLiveJobs(newJobs);
      setCurrentPage(1);
      setSelectedJob(newJobs[0]?.id ?? null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchQuery, debouncedSelectedLocation, selectedType]);

  // Helper: map DB rows to Job shape
  const mapDbRowsToJobs = useCallback((rows: any[]): Job[] => {
    return rows.map((r: any) => ({
  // JobListing fields (to satisfy Job extends JobListing)
  jobTitle: r.job_title,
  companyName: r.company_name,
  fullJobDescription: r.full_job_description || '',
  sourceUrl: r.source_url,
      id: r.source_url || `${r.job_title}-${r.company_name}`,
      title: r.job_title,
      company: r.company_name,
      location: r.location,
      type: r.work_type || 'N/A',
      salary: typeof r.salary_min === 'number' || typeof r.salary_max === 'number'
        ? `$${r.salary_min ?? ''}${r.salary_min && r.salary_max ? ' - ' : ''}${r.salary_max ?? ''}${r.salary_period ? ` / ${r.salary_period}` : ''}`
        : 'N/A',
      postedDate: r.posted_at ? new Date(r.posted_at).toLocaleDateString() : 'N/A',
      rawPostedAt: r.posted_at ? new Date(r.posted_at).getTime() : null,
      description: r.full_job_description || '',
      requirements: Array.isArray(r.requirements) && r.requirements.length
        ? r.requirements : extractSectionBullets(r.full_job_description || '', ['requirements', 'qualifications', "what you'll need", 'what you will need']),
      benefits: Array.isArray(r.benefits) && r.benefits.length
        ? r.benefits : extractSectionBullets(r.full_job_description || '', ['benefits', 'perks', 'what we offer', 'what you get', 'compensation & benefits']),
      isBookmarked: false,
      isApplied: false,
      logo: (r.company_name?.[0] || '?').toUpperCase(),
      logoUrl: getCompanyLogoUrl(r.company_name, r.source_url),
      source: r.source || 'db',
    }));
  }, []);

  // Fetch facets for current query/location/type (no req/benefit filters)
  const fetchFacets = useCallback(async () => {
    if (!debouncedSearchQuery) {
      setFacets({ requirements: [], benefits: [] });
      return;
    }
    setFacetLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-jobs', {
        body: {
          q: debouncedSearchQuery,
          location: debouncedSelectedLocation,
          type: selectedType === 'All' ? '' : selectedType,
          minSalary: minSalary ? Number(minSalary) : undefined,
          maxSalary: maxSalary ? Number(maxSalary) : undefined,
          posted: postedSince ? Number(postedSince) : undefined,
        }
      });
      if (error) throw error;
      const f = (data?.facets as any) || {};
      setFacets({
        requirements: Array.isArray(f?.requirements) ? f.requirements : [],
        benefits: Array.isArray(f?.benefits) ? f.benefits : [],
      });
    } catch (_) {
      setFacets({ requirements: [], benefits: [] });
    } finally {
      setFacetLoading(false);
    }
  }, [debouncedSearchQuery, debouncedSelectedLocation, selectedType, minSalary, maxSalary, postedSince]);

  // Apply facet filters by switching to DB-backed results
  const applyFacetFilters = useCallback(async (reqArr: string[], benArr: string[]) => {
    // If no filters selected, restore live results if available
    if (reqArr.length === 0 && benArr.length === 0) {
      if (lastLiveJobs) {
        setJobs(lastLiveJobs);
        setResultSource('live');
        setResultNote(null);
      } else {
        await performSearch();
      }
      // refresh facets in either case
      fetchFacets();
      return;
    }
    setLoading(true);
    setError(null);
    try {
    const { data, error } = await supabase.functions.invoke('get-jobs', {
        body: {
          q: debouncedSearchQuery,
          location: debouncedSelectedLocation,
          type: selectedType === 'All' ? '' : selectedType,
          requirements: reqArr,
          benefits: benArr,
      minSalary: minSalary ? Number(minSalary) : undefined,
      maxSalary: maxSalary ? Number(maxSalary) : undefined,
      posted: postedSince ? Number(postedSince) : undefined,
        }
      });
      if (error) throw error;
      const rows = Array.isArray(data?.jobs) ? data.jobs : [];
      const mapped = mapDbRowsToJobs(rows);
      setJobs(mapped);
      setCurrentPage(1);
      setSelectedJob(mapped[0]?.id ?? null);
      setResultSource('db');
      setResultNote('filtered');
      // update facets to reflect filtered set
      const f = (data?.facets as any) || {};
      setFacets({
        requirements: Array.isArray(f?.requirements) ? f.requirements : [],
        benefits: Array.isArray(f?.benefits) ? f.benefits : [],
      });
    } catch (e: any) {
      setError(e.message || 'Failed to apply filters');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchQuery, debouncedSelectedLocation, selectedType, lastLiveJobs, mapDbRowsToJobs, performSearch, fetchFacets, minSalary, maxSalary, postedSince]);

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
  // NOTE: This function may receive a resume URL override via closure (state)
    if (applyingJobId) return; // prevent parallel
    setApplyingJobId(job.id);
    try {
      const { data: userData } = await (supabase as any).auth.getUser();
      const uid = (userData as any)?.user?.id;
      if (!uid) {
        toastError('Login required', 'Sign in to apply');
        setApplyingJobId(null);
        return;
      }
      // Preflight: capture readiness result
      try {
        const r: any = await ensureApplyReadiness();
        if (r && typeof r === 'object' && 'profile' in r && 'resume' in r) setReadiness({ profile: !!r.profile, resume: !!r.resume });
      } catch {}
      const payload: any = { job_urls: job.sourceUrl ? [job.sourceUrl] : [] }; 
      // If a resume has been selected and signed, include it
      if (selectedResumeSignedUrl.current) {
        payload.resume = selectedResumeSignedUrl.current;
      }
      try {
        const res = await applyToJobs(payload);
        const runId = (res as any)?.skyvern?.id || (res as any)?.skyvern?.run_id || null;
        const appUrl = (res as any)?.skyvern?.app_url || null;
        const workflowId = (res as any)?.submitted?.workflow_id || (res as any)?.skyvern?.workflow_id || null;

        const notes = [
          job.sourceUrl ? `Source: ${job.sourceUrl}` : null,
          appUrl ? `Skyvern: ${appUrl}` : null,
          runId ? `Run: ${runId}` : null,
          workflowId ? `Workflow: ${workflowId}` : null,
        ].filter(Boolean).join(' | ');

        const { data: inserted, error } = await (supabase as any)
          .from('applications')
          .insert({
            user_id: uid,
            job_title: job.title,
            company: job.company,
            location: job.location,
            applied_date: new Date().toISOString(),
            status: 'Pending',
            logo: job.logoUrl ?? null,
            notes,
            run_id: runId,
            workflow_id: workflowId,
            app_url: appUrl,
            provider_status: 'queued',
          })
          .select('*')
          .single();
        if (error) throw error;
        const applicationId = (inserted as any)?.id as string | undefined;
        success('Application started', appUrl ? 'Skyvern workflow triggered' : `${job.title} @ ${job.company}`);
        setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, isApplied: true } : j)));

        if (runId && applicationId) {
          const stop = new Set(['succeeded','failed','error','cancelled','completed']);
          let tries = 0;
          const maxTries = 36; // ~3 minutes at 5s
          const poll = async () => {
            try {
              const r = await getRun(runId);
              const st = r?.run?.status?.toLowerCase?.() || '';
              if (stop.has(st)) {
                const finalStatus = st === 'succeeded' || st === 'completed' ? 'Applied' : 'Rejected';
                const noteBits = [notes];
                if (r?.run?.recording_url) noteBits.push(`Recording: ${r.run.recording_url}`);
                if (r?.run?.failure_reason) noteBits.push(`Failure: ${r.run.failure_reason}`);
                await (supabase as any)
                  .from('applications')
                  .update({
                    status: finalStatus,
                    notes: noteBits.filter(Boolean).join(' | '),
                    provider_status: st,
                    recording_url: r?.run?.recording_url ?? null,
                    failure_reason: r?.run?.failure_reason ?? null,
                  })
                  .eq('id', applicationId);
                return;
              }
            } catch {}
            if (++tries < maxTries) setTimeout(poll, 5000);
          };
          setTimeout(poll, 5000);
        }
      } catch (efErr: any) {
        const { error } = await (supabase as any)
          .from('applications')
          .insert({
            user_id: uid,
            job_title: job.title,
            company: job.company,
            location: job.location,
            applied_date: new Date().toISOString(),
            status: 'Pending',
            logo: job.logoUrl ?? null,
            notes: job.sourceUrl ? `Apply trigger failed; saved locally. ${job.sourceUrl}` : 'Apply trigger failed; saved locally.',
          });
        if (error) throw error;
        info('Saved application', 'Apply trigger failed; saved locally');
        setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, isApplied: true } : j)));
      }
    } catch (e: any) {
      const msg = e.message || 'Try again';
      toastError('Apply failed', msg);
      try {
        window.dispatchEvent(new CustomEvent('toast', { detail: { title: 'Retry apply?', description: msg, action: { label: 'Retry', jobId: job.id } } }));
      } catch {}
    } finally {
      try {
        const r: any = await ensureApplyReadiness();
        if (r && typeof r === 'object' && 'profile' in r && 'resume' in r) setReadiness({ profile: !!r.profile, resume: !!r.resume });
      } catch {}
      setApplyingJobId(null);
    }
  }, [supabase, success, toastError, info, applyingJobId]);

  // ==== Resume Picker (Modern UI) ====
  const { resumes: resumeOptions, getSignedUrl } = useResumes();
  const [resumePickerOpen, setResumePickerOpen] = useState(false);
  const [jobPendingApply, setJobPendingApply] = useState<Job | null>(null);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const selectedResumeSignedUrl = useRef<string | null>(null);

  const openResumePicker = useCallback((job: Job) => {
    setJobPendingApply(job);
    // Preselect favorite or most recent
    const pick = (resumeOptions || []).slice().sort((a, b) => {
      const favA = (a as any).is_favorite ? 1 : 0;
      const favB = (b as any).is_favorite ? 1 : 0;
      if (favA !== favB) return favB - favA;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    })[0];
    setSelectedResumeId(pick?.id ?? null);
    setResumePickerOpen(true);
  }, [resumeOptions]);

  const cancelResumePicker = useCallback(() => {
    setResumePickerOpen(false);
    setJobPendingApply(null);
    setSelectedResumeId(null);
    selectedResumeSignedUrl.current = null;
  }, []);

  const confirmResumePicker = useCallback(async () => {
    if (!jobPendingApply) return;
    try {
      selectedResumeSignedUrl.current = null;
      if (selectedResumeId) {
        const chosen = (resumeOptions || []).find(r => r.id === selectedResumeId);
        if (chosen?.file_path) {
          // Longer expiry to be safe for backend call
          const url = await getSignedUrl(chosen.file_path);
          if (url) selectedResumeSignedUrl.current = url;
          else info?.('Using latest resume', 'Could not sign selected; falling back');
        }
      }
      setResumePickerOpen(false);
      // Trigger apply with possible override
      await quickApply(jobPendingApply);
    } finally {
      // reset override to avoid leaking into other applies
      setTimeout(() => { selectedResumeSignedUrl.current = null; }, 0);
      setJobPendingApply(null);
    }
  }, [jobPendingApply, selectedResumeId, resumeOptions, getSignedUrl, quickApply, info]);

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

  // Preflight once on initial page load (capture readiness)
  useEffect(() => {
    (async () => {
      try {
        const r: any = await ensureApplyReadiness();
        if (r && typeof r === 'object' && 'profile' in r && 'resume' in r) setReadiness({ profile: !!r.profile, resume: !!r.resume });
      } catch {}
    })();
  }, []);

  // Whenever the main query inputs change, refresh facets and clear selected facet filters
  useEffect(() => {
    setSelectedReq(new Set());
    setSelectedBen(new Set());
    fetchFacets();
  }, [debouncedSearchQuery, debouncedSelectedLocation, selectedType, minSalary, maxSalary, postedSince, fetchFacets]);

  // URL sync: initial read on mount
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      const q = u.searchParams.get('q');
      const loc = u.searchParams.get('location');
      const type = u.searchParams.get('type');
      const req = u.searchParams.getAll('req');
      const ben = u.searchParams.getAll('benefit');
      const min = u.searchParams.get('minSalary');
      const max = u.searchParams.get('maxSalary');
      const posted = u.searchParams.get('posted');
      if (q) setSearchQuery(q);
      if (loc) setSelectedLocation(loc);
      if (type) setSelectedType(type);
      if (req?.length) setSelectedReq(new Set(req.flatMap(s => s.split(',').map(x => x.trim()).filter(Boolean))));
      if (ben?.length) setSelectedBen(new Set(ben.flatMap(s => s.split(',').map(x => x.trim()).filter(Boolean))));
      if (min) setMinSalary(min);
      if (max) setMaxSalary(max);
      if (posted) setPostedSince(posted);
    } catch {}
  }, []);

  // URL sync: write when query/filters change
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      const sp = u.searchParams;
      const setOrDel = (k: string, v?: string) => { if (v && v.trim()) sp.set(k, v); else sp.delete(k); };
      setOrDel('q', debouncedSearchQuery);
      setOrDel('location', debouncedSelectedLocation);
      setOrDel('type', selectedType === 'All' ? '' : selectedType);
      sp.delete('req');
      sp.delete('benefit');
      for (const r of Array.from(selectedReq)) sp.append('req', r);
      for (const b of Array.from(selectedBen)) sp.append('benefit', b);
      setOrDel('minSalary', minSalary);
      setOrDel('maxSalary', maxSalary);
      setOrDel('posted', postedSince);
      const next = u.toString();
      if (next !== window.location.href) window.history.replaceState({}, '', next);
    } catch {}
  }, [debouncedSearchQuery, debouncedSelectedLocation, selectedType, selectedReq, selectedBen, minSalary, maxSalary, postedSince]);

  // Derived chip counts
  const activeFacetCount = useMemo(() => selectedReq.size + selectedBen.size, [selectedReq, selectedBen]);

  const toggleReq = (value: string) => {
    const next = new Set(selectedReq);
    if (next.has(value)) next.delete(value); else next.add(value);
    setSelectedReq(next);
    applyFacetFilters(Array.from(next), Array.from(selectedBen));
  };
  const toggleBen = (value: string) => {
    const next = new Set(selectedBen);
    if (next.has(value)) next.delete(value); else next.add(value);
    setSelectedBen(next);
    applyFacetFilters(Array.from(selectedReq), Array.from(next));
  };
  const clearFacetFilters = () => {
    setSelectedReq(new Set());
    setSelectedBen(new Set());
    applyFacetFilters([], []);
  };

  // Clear all filter chips and salary/time in one action
  const clearAllFilters = useCallback(() => {
    setSelectedReq(new Set());
    setSelectedBen(new Set());
    setMinSalary("");
    setMaxSalary("");
    setPostedSince("");
    // Will restore live results if available and refresh facets internally
    applyFacetFilters([], []);
  }, [applyFacetFilters]);

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
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-black">
      {/* Subtle background pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      
      <div className="relative w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <motion.div 
          className="mb-8 sm:mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-brand via-brand to-emerald-400 rounded-2xl flex items-center justify-center shadow-lg shadow-brand/25">
                  <Briefcase className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-white via-white to-gray-300 bg-clip-text text-transparent">
                    Job Discovery
                  </h1>
                  <div className="flex items-center gap-3 mt-2">
                    <p className="text-muted-foreground text-sm sm:text-base">
                      Powered by AI • Enterprise-grade matching
                    </p>
                    {/* Status indicators with enhanced styling */}
                    {resultSource && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={`px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-sm ${
                          resultSource === 'live'
                            ? 'border-brand/40 text-brand bg-brand/10 shadow-md shadow-brand/20'
                            : 'border-amber-400/40 text-amber-300 bg-amber-500/10 shadow-md shadow-amber-500/20'
                        }`}
                        title={resultNote || undefined}
                      >
                        {resultSource === 'live' ? '🔴 Live Data' : '📊 Cached Results'}
                      </motion.span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Readiness indicators with modern design */}
              {readiness && (
                <div className="flex items-center gap-2 mt-4">
                  <span className="text-xs text-muted-foreground font-medium">Application Status:</span>
                  <motion.span
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className={`px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-sm ${readiness.profile ? 'border-emerald-400/40 text-emerald-300 bg-emerald-500/10 shadow-md shadow-emerald-500/20' : 'border-destructive/40 text-destructive bg-destructive/10 shadow-md shadow-destructive/20'}`}
                    title={readiness.profile ? 'Profile complete and ready' : 'Profile needs completion'}
                  >
                    {readiness.profile ? '✓ Profile Ready' : '⚠ Profile Incomplete'}
                  </motion.span>
                  <motion.span
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className={`px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-sm ${readiness.resume ? 'border-emerald-400/40 text-emerald-300 bg-emerald-500/10 shadow-md shadow-emerald-500/20' : 'border-destructive/40 text-destructive bg-destructive/10 shadow-md shadow-destructive/20'}`}
                    title={readiness.resume ? 'Resume uploaded and ready' : 'Resume needs to be uploaded'}
                  >
                    {readiness.resume ? '✓ Resume Ready' : '⚠ Resume Missing'}
                  </motion.span>
                </div>
              )}
            </div>
            
            {/* Action buttons with enhanced styling */}
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                className="relative group border-border/40 text-foreground hover:bg-accent/50 hover:border-brand/50 hover:scale-105 transition-all duration-300 backdrop-blur-sm"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-brand/0 via-brand/5 to-brand/0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Filter className="w-4 h-4 mr-2" />
                {activeFacetCount > 0 ? `Filters (${activeFacetCount})` : 'Advanced Filters'}
              </Button>
              <Button 
                variant="neo"
                className="relative group overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-brand via-emerald-400 to-brand opacity-90 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative flex items-center">
                  <Bookmark className="w-4 h-4 mr-2" />
                  Saved Jobs
                </div>
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Enhanced Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Card className="relative bg-gradient-to-br from-card/80 via-card/60 to-card/40 border border-border/40 backdrop-blur-xl p-6 sm:p-8 mb-8 sm:mb-12 shadow-2xl">
            {/* Subtle glow effect */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand/5 via-transparent to-brand/5 opacity-50" />
            
            <div className="relative space-y-6">
              {/* Primary search row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Enhanced Search Input */}
                <div className="lg:col-span-1 relative group">
                  <label htmlFor="job-search" className="block text-sm font-medium text-foreground/80 mb-2">
                    Job Title or Keywords
                  </label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground group-hover:text-brand transition-colors duration-200" />
                    <Input
                      id="job-search"
                      name="job-search"
                      placeholder="e.g. Senior Software Engineer, Product Manager..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-12 h-12 bg-input/50 border-border/40 text-foreground placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/20 hover:border-border transition-all duration-300 backdrop-blur-sm"
                    />
                  </div>
                </div>
                
                {/* Enhanced Location Filter */}
                <div className="relative group">
                  <label htmlFor="job-location" className="block text-sm font-medium text-foreground/80 mb-2">
                    Location Preference
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground group-hover:text-brand transition-colors duration-200" />
                    <Input
                      id="job-location"
                      name="job-location"
                      placeholder="Remote, New York, San Francisco..."
                      value={selectedLocation}
                      onChange={(e) => setSelectedLocation(e.target.value)}
                      className="pl-12 h-12 bg-input/50 border-border/40 text-foreground placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/20 hover:border-border transition-all duration-300 backdrop-blur-sm"
                    />
                  </div>
                </div>
                
                {/* Enhanced Work Type Filter */}
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-2">
                    Work Arrangement
                  </label>
                  <div className="grid grid-cols-4 gap-1 p-1 bg-muted/30 rounded-xl border border-border/20 backdrop-blur-sm">
                    {["All", "Remote", "Hybrid", "On-site"].map((type) => (
                      <Button
                        key={type}
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedType(type)}
                        className={`relative text-xs font-medium transition-all duration-300 hover:scale-105 ${
                          selectedType === type
                            ? "bg-brand text-black hover:bg-brand/90 shadow-md shadow-brand/25"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                        }`}
                      >
                        {selectedType === type && (
                          <motion.div
                            className="absolute inset-0 bg-brand rounded-lg"
                            layoutId="activeType"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                        <span className="relative z-10">{type}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Advanced filters row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-border/20">
                <div className="space-y-2">
                  <label htmlFor="salary-min" className="block text-sm font-medium text-foreground/80">
                    Minimum Salary
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="salary-min"
                      name="salary-min"
                      placeholder="120,000"
                      inputMode="numeric"
                      value={minSalary}
                      onChange={(e) => setMinSalary(e.target.value.replace(/[^0-9]/g, ''))}
                      className="pl-10 h-10 bg-input/50 border-border/40 text-foreground placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all duration-300"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="salary-max" className="block text-sm font-medium text-foreground/80">
                    Maximum Salary
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="salary-max"
                      name="salary-max"
                      placeholder="200,000"
                      inputMode="numeric"
                      value={maxSalary}
                      onChange={(e) => setMaxSalary(e.target.value.replace(/[^0-9]/g, ''))}
                      className="pl-10 h-10 bg-input/50 border-border/40 text-foreground placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all duration-300"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground/80">
                    Posted Within
                  </label>
                  <SafeSelect fallbackValue="any" value={postedSince} onValueChange={(v) => setPostedSince(v === 'any' ? '' : v)}>
                    <SelectTrigger className="h-10 bg-input/50 border-border/40 focus:border-brand focus:ring-2 focus:ring-brand/20">
                      <SelectValue placeholder="Any time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any time</SelectItem>
                      <SelectItem value="3">Last 3 days</SelectItem>
                      <SelectItem value="7">Last week</SelectItem>
                      <SelectItem value="14">Last 2 weeks</SelectItem>
                      <SelectItem value="30">Last month</SelectItem>
                    </SelectContent>
                  </SafeSelect>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground/80">
                    Actions
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { fetchFacets(); applyFacetFilters(Array.from(selectedReq), Array.from(selectedBen)); }}
                      className="flex-1 border-border/40 text-foreground hover:bg-accent/50 hover:border-brand/50 transition-all duration-300"
                    >
                      Apply
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-300"
                      title="Clear all filters"
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Enhanced Job List and Details */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Job List - Enhanced */}
          <div className="lg:col-span-3 space-y-6">
            {/* Smart Facet Panel */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Card className="relative bg-gradient-to-br from-card/90 via-card/70 to-card/50 border border-border/40 backdrop-blur-xl p-6 shadow-lg">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand/3 via-transparent to-emerald-500/3 opacity-50" />
                
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-brand to-emerald-400 rounded-lg flex items-center justify-center">
                        <Filter className="w-4 h-4 text-black" />
                      </div>
                      <div>
                        <h3 className="text-foreground font-semibold">Smart Filters</h3>
                        <p className="text-xs text-muted-foreground">Refine results by skills & benefits</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {facetLoading && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="w-3 h-3 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                          Analyzing...
                        </div>
                      )}
                      {activeFacetCount > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={clearFacetFilters} 
                          className="text-brand hover:bg-brand/10 hover:scale-105 transition-all duration-300"
                        >
                          Clear ({activeFacetCount})
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Requirements Section */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-brand" />
                        <h4 className="text-sm font-medium text-foreground">Required Skills</h4>
                        <span className="text-xs text-muted-foreground">({facets.requirements.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                        {(facets.requirements || []).slice(0, 15).map((f) => {
                          const active = selectedReq.has(f.value);
                          return (
                            <motion.button
                              key={`req-${f.value}`}
                              onClick={() => toggleReq(f.value)}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-300 ${
                                active 
                                  ? 'border-brand/60 text-brand bg-brand/10 shadow-md shadow-brand/20' 
                                  : 'border-border/40 text-muted-foreground bg-muted/30 hover:border-brand/40 hover:bg-brand/5 hover:text-foreground'
                              }`}
                              title={`${f.value} (${f.count} jobs)`}
                            >
                              {f.value}
                              <span className="ml-1.5 text-[10px] opacity-70 bg-background/20 px-1 rounded">
                                {f.count}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Benefits Section */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-sm font-medium text-foreground">Benefits & Perks</h4>
                        <span className="text-xs text-muted-foreground">({facets.benefits.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                        {(facets.benefits || []).slice(0, 15).map((f) => {
                          const active = selectedBen.has(f.value);
                          return (
                            <motion.button
                              key={`ben-${f.value}`}
                              onClick={() => toggleBen(f.value)}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-300 ${
                                active 
                                  ? 'border-emerald-400/60 text-emerald-400 bg-emerald-500/10 shadow-md shadow-emerald-500/20' 
                                  : 'border-border/40 text-muted-foreground bg-muted/30 hover:border-emerald-400/40 hover:bg-emerald-500/5 hover:text-foreground'
                              }`}
                              title={`${f.value} (${f.count} jobs)`}
                            >
                              {f.value}
                              <span className="ml-1.5 text-[10px] opacity-70 bg-background/20 px-1 rounded">
                                {f.count}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
            {/* Enhanced Job List Header */}
            <motion.div 
              className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                        Discovering opportunities...
                      </div>
                    ) : (
                      `${filteredJobs.length.toLocaleString()} Opportunities`
                    )}
                  </h2>
                  {!loading && (
                    <div className="px-3 py-1 bg-brand/10 text-brand text-sm font-medium rounded-full border border-brand/20">
                      Page {currentPage} of {totalPages}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Showing {start + 1}–{end} of {total.toLocaleString()} results</span>
                  {resultSource && (
                    <span className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${resultSource === 'live' ? 'bg-brand animate-pulse' : 'bg-amber-400'}`} />
                      {resultSource === 'live' ? 'Real-time data' : 'Cached results'}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Show:</span>
                  <SafeSelect fallbackValue="10" value={String(pageSize)} onValueChange={(v) => { setPageSize(parseInt(v)); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[80px] h-9 bg-input/50 border-border/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </SafeSelect>
                </div>
                
                <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Sort:</span>
                  <SafeSelect fallbackValue="relevance" value={sortBy} onValueChange={(v) => { setSortBy(v as any); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[140px] h-9 bg-input/50 border-border/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevance">🎯 Best Match</SelectItem>
                      <SelectItem value="posted_desc">🕒 Latest First</SelectItem>
                    </SelectContent>
                  </SafeSelect>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="border-border/40 text-muted-foreground hover:text-foreground hover:border-brand/50 disabled:opacity-50 disabled:hover:border-border/40 disabled:hover:text-muted-foreground transition-all duration-300"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="border-border/40 text-muted-foreground hover:text-foreground hover:border-brand/50 disabled:opacity-50 disabled:hover:border-border/40 disabled:hover:text-muted-foreground transition-all duration-300"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </motion.div>
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

            {/* Enhanced Job Cards */}
            {!loading && !error && paginatedJobs.map((job, index) => (
              <motion.div
                key={job.id}
                onClick={() => setSelectedJob(job.id)}
                className="cursor-pointer group"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                whileTap={{ scale: 0.98 }}
              >
                <Card className={`relative bg-gradient-to-br from-card/90 via-card/70 to-card/50 border backdrop-blur-xl p-6 transition-all duration-500 group-hover:shadow-2xl ${
                  selectedJob === job.id
                    ? "border-brand shadow-2xl shadow-brand/25 ring-1 ring-brand/20"
                    : "border-border/30 hover:border-brand/50 group-hover:shadow-lg"
                }`}>
                  {/* Subtle glow for selected job */}
                  {selectedJob === job.id && (
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand/5 via-brand/10 to-brand/5 opacity-80" />
                  )}
                  
                  <div className="relative space-y-5">
                    {/* Enhanced Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1 min-w-0">
                        {/* Company Logo with enhanced styling */}
                        <div className="relative flex-shrink-0">
                          {job.logoUrl && !logoError[job.id] ? (
                            <img
                              src={job.logoUrl}
                              alt={job.company}
                              className="w-14 h-14 rounded-xl object-contain bg-white/90 shadow-lg ring-1 ring-border/20"
                              onError={() => {
                                setLogoError((m) => ({ ...m, [job.id]: true }));
                                if (job.logoUrl) logoFailureCache.add(job.logoUrl);
                              }}
                            />
                          ) : (
                            <div className="w-14 h-14 bg-gradient-to-br from-brand to-emerald-400 rounded-xl flex items-center justify-center text-black font-bold text-lg shadow-lg shadow-brand/25">
                              {job.logo}
                            </div>
                          )}
                          {job.isApplied && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                              <CheckCircle2 className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0 space-y-2">
                          <div>
                            <h3 className="text-foreground font-bold text-lg leading-tight group-hover:text-brand transition-colors duration-300 line-clamp-2">
                              {job.title}
                            </h3>
                            <p className="text-muted-foreground font-medium">{job.company}</p>
                          </div>
                          
                          {/* Job meta info */}
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center space-x-1.5">
                              <MapPin className="w-4 h-4 text-brand/70" />
                              <span>{job.location}</span>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <Clock className="w-4 h-4 text-emerald-400/70" />
                              <span>{job.postedDate}</span>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <Briefcase className="w-4 h-4 text-blue-400/70" />
                              <span>{job.type}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action buttons */}
                      <div className="flex items-start space-x-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => { e.stopPropagation(); toggleBookmark(job); }}
                          className={`relative transition-all duration-300 hover:scale-110 ${
                            job.isBookmarked 
                              ? "text-brand hover:text-brand/80" 
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Bookmark className={`w-4 h-4 ${job.isBookmarked ? "fill-current" : ""}`} />
                          {job.isBookmarked && (
                            <motion.div
                              className="absolute inset-0 bg-brand/10 rounded-lg"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ duration: 0.2 }}
                            />
                          )}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => { e.stopPropagation(); shareJob(job); }}
                          className="text-muted-foreground hover:text-foreground hover:scale-110 transition-all duration-300"
                        >
                          <Share className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Salary and Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                          <DollarSign className="w-5 h-5 text-brand" />
                          <span className="text-lg font-bold text-foreground">{job.salary}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {"source" in job && (job as any).source && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full border border-border/40 text-muted-foreground bg-muted/30">
                            {(job as any).source}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Enhanced tags and status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-3 py-1.5 bg-accent/50 text-accent-foreground text-xs font-medium rounded-full border border-border/40">
                          {job.type}
                        </span>
                        {job.isApplied && (
                          <motion.span 
                            className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-full border border-emerald-500/20"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", bounce: 0.4 }}
                          >
                            ✓ Applied
                          </motion.span>
                        )}
                      </div>
                      
                      {job.sourceUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); window.open(job.sourceUrl, '_blank'); }}
                          className="opacity-0 group-hover:opacity-100 transition-all duration-300 border-border/40 text-muted-foreground hover:text-foreground hover:border-brand/50 text-xs"
                        >
                          View Original
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Enhanced Job Details Panel */}
          <div className="lg:col-span-2 lg:sticky lg:top-6 lg:h-fit">
            {selectedJob ? (
              <>
                {(() => {
                  const job = jobs.find(j => j.id === selectedJob);
                  if (!job) return null;
                  
                  return (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.6 }}
                      className="space-y-6"
                    >
                      {/* Enhanced Job Header */}
                      <Card className="relative bg-gradient-to-br from-card/95 via-card/80 to-card/60 border border-border/40 backdrop-blur-xl p-8 shadow-2xl">
                        {/* Hero gradient overlay */}
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand/8 via-transparent to-emerald-500/8 opacity-60" />
                        
                        <div className="relative">
                          <div className="flex items-start justify-between mb-8">
                            <div className="flex items-start space-x-6 flex-1 min-w-0">
                              {/* Enhanced company logo */}
                              <div className="relative flex-shrink-0">
                                {job.logoUrl && !logoError[job.id] ? (
                                  <img
                                    src={job.logoUrl}
                                    alt={job.company}
                                    className="w-20 h-20 rounded-2xl object-contain bg-white/90 shadow-xl ring-1 ring-border/20"
                                    onError={() => {
                                      setLogoError((m) => ({ ...m, [job.id]: true }));
                                      if (job.logoUrl) logoFailureCache.add(job.logoUrl);
                                    }}
                                  />
                                ) : (
                                  <div className="w-20 h-20 bg-gradient-to-br from-brand to-emerald-400 rounded-2xl flex items-center justify-center text-black font-bold text-2xl shadow-xl shadow-brand/30">
                                    {job.logo}
                                  </div>
                                )}
                                {job.isApplied && (
                                  <motion.div 
                                    className="absolute -top-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", bounce: 0.5 }}
                                  >
                                    <CheckCircle2 className="w-5 h-5 text-white" />
                                  </motion.div>
                                )}
                              </div>
                              
                              <div className="flex-1 min-w-0 space-y-3">
                                <div>
                                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 leading-tight">
                                    {job.title}
                                  </h1>
                                  <p className="text-xl text-muted-foreground font-medium">{job.company}</p>
                                </div>
                                
                                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                  <div className="flex items-center space-x-2 bg-accent/30 px-3 py-1.5 rounded-full">
                                    <MapPin className="w-4 h-4 text-brand" />
                                    <span className="font-medium">{job.location}</span>
                                  </div>
                                  <div className="flex items-center space-x-2 bg-accent/30 px-3 py-1.5 rounded-full">
                                    <Clock className="w-4 h-4 text-emerald-400" />
                                    <span className="font-medium">Posted {job.postedDate}</span>
                                  </div>
                                  <div className="flex items-center space-x-2 bg-accent/30 px-3 py-1.5 rounded-full">
                                    <Briefcase className="w-4 h-4 text-blue-400" />
                                    <span className="font-medium">{job.type}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Action menu */}
                            <div className="flex items-start space-x-2 flex-shrink-0">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => shareJob(job)}
                                className="text-muted-foreground hover:text-foreground hover:bg-accent/50 hover:scale-110 transition-all duration-300"
                              >
                                <Share className="w-5 h-5" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-muted-foreground hover:text-foreground hover:bg-accent/50 hover:scale-110 transition-all duration-300"
                              >
                                <Heart className="w-5 h-5" />
                              </Button>
                            </div>
                          </div>
                          
                          {/* Salary and CTA Section */}
                          <div className="space-y-6">
                            <div className="flex items-center justify-between p-6 bg-gradient-to-r from-brand/10 via-brand/5 to-emerald-500/10 rounded-2xl border border-brand/20">
                              <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 bg-brand/20 rounded-xl flex items-center justify-center">
                                  <DollarSign className="w-6 h-6 text-brand" />
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground font-medium">Compensation</p>
                                  <p className="text-2xl font-bold text-foreground">{job.salary}</p>
                                </div>
                              </div>
                              {"source" in job && (job as any).source && (
                                <div className="px-3 py-1.5 bg-muted/50 text-muted-foreground text-xs font-medium rounded-full border border-border/40">
                                  Source: {(job as any).source}
                                </div>
                              )}
                            </div>
                            
                            {/* Action buttons */}
                            <div className="flex items-center gap-4">
                              <Button 
                                variant="outline" 
                                onClick={() => toggleBookmark(job)}
                                className="flex-1 h-12 border-border/40 text-foreground hover:bg-accent/50 hover:border-brand/50 hover:scale-105 transition-all duration-300 backdrop-blur-sm"
                              >
                                <Bookmark className={`w-5 h-5 mr-2 ${job.isBookmarked ? "fill-current text-brand" : ""}`} />
                                {job.isBookmarked ? 'Saved' : 'Save Job'}
                              </Button>
                              <Button 
                                onClick={() => openResumePicker(job)}
                                disabled={!!applyingJobId || job.isApplied}
                                variant="neo"
                                className={`flex-1 h-12 relative overflow-hidden transition-all duration-300 ${
                                  (applyingJobId || job.isApplied) 
                                    ? 'opacity-70 cursor-not-allowed hover:scale-100' 
                                    : 'hover:scale-105 hover:shadow-xl hover:shadow-brand/30'
                                }`}
                              >
                                <div className="relative flex items-center justify-center">
                                  {applyingJobId === job.id && (
                                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin mr-2" />
                                  )}
                                  <Briefcase className="w-5 h-5 mr-2" />
                                  {job.isApplied ? '✓ Applied' : (applyingJobId === job.id ? 'Applying...' : 'Apply Now')}
                                </div>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>

                      {/* Enhanced Job Content */}
                      <div className="space-y-6">
                        {/* Job Description */}
                        <Card className="relative bg-gradient-to-br from-card/90 via-card/70 to-card/50 border border-border/40 backdrop-blur-xl p-8 shadow-lg">
                          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/5 via-transparent to-blue-500/5 opacity-50" />
                          <div className="relative">
                            <div className="flex items-center gap-3 mb-6">
                              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                                <Building2 className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-foreground">Job Description</h3>
                                <p className="text-sm text-muted-foreground">Role overview and responsibilities</p>
                              </div>
                            </div>
                            <div className="prose prose-invert max-w-none text-foreground/90 leading-relaxed">
                              <div 
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.description) }} 
                                className="space-y-4 text-base leading-7"
                              />
                            </div>
                          </div>
                        </Card>
                        
                        {/* Requirements */}
                        {job.requirements.length > 0 && (
                          <Card className="relative bg-gradient-to-br from-card/90 via-card/70 to-card/50 border border-border/40 backdrop-blur-xl p-8 shadow-lg">
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand/5 via-transparent to-brand/5 opacity-50" />
                            <div className="relative">
                              <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 bg-gradient-to-br from-brand to-emerald-400 rounded-xl flex items-center justify-center shadow-lg shadow-brand/25">
                                  <Star className="w-5 h-5 text-black" />
                                </div>
                                <div>
                                  <h3 className="text-xl font-bold text-foreground">Requirements</h3>
                                  <p className="text-sm text-muted-foreground">Skills and qualifications needed</p>
                                </div>
                              </div>
                              <div className="grid gap-3">
                                {job.requirements.map((req, index) => (
                                  <motion.div 
                                    key={index} 
                                    className="flex items-start space-x-3 p-3 bg-accent/20 rounded-xl border border-border/20 hover:bg-accent/30 transition-colors duration-300"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.08 }}
                                  >
                                    <div className="w-2 h-2 bg-brand rounded-full flex-shrink-0 mt-2"></div>
                                    <span className="text-foreground/90 leading-relaxed">{req}</span>
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          </Card>
                        )}
                        
                        {/* Benefits */}
                        {job.benefits.length > 0 && (
                          <Card className="relative bg-gradient-to-br from-card/90 via-card/70 to-card/50 border border-border/40 backdrop-blur-xl p-8 shadow-lg">
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500/5 via-transparent to-emerald-500/5 opacity-50" />
                            <div className="relative">
                              <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                                  <Users className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                  <h3 className="text-xl font-bold text-foreground">Benefits & Perks</h3>
                                  <p className="text-sm text-muted-foreground">What's included with this role</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {job.benefits.map((benefit, index) => (
                                  <motion.div 
                                    key={index} 
                                    className="flex items-start space-x-3 p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors duration-300"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.08 }}
                                  >
                                    <div className="w-2 h-2 bg-emerald-400 rounded-full flex-shrink-0 mt-2"></div>
                                    <span className="text-foreground/90 leading-relaxed">{benefit}</span>
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          </Card>
                        )}
                        
                        {/* External Link */}
                        {job.sourceUrl && (
                          <motion.div 
                            className="flex justify-end"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                          >
                            <Button
                              variant="outline"
                              onClick={() => window.open(job.sourceUrl, '_blank')}
                              className="group border-brand/40 text-brand hover:bg-brand/10 hover:border-brand/60 hover:scale-105 transition-all duration-300 backdrop-blur-sm"
                            >
                              <span className="mr-2">View Original Posting</span>
                              <motion.div
                                className="w-4 h-4"
                                animate={{ x: [0, 2, 0] }}
                                transition={{ repeat: Infinity, duration: 1.5, repeatDelay: 1 }}
                              >
                                →
                              </motion.div>
                            </Button>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  );
                })()}
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
              >
                <Card className="relative bg-gradient-to-br from-card/90 via-card/70 to-card/50 border border-border/40 backdrop-blur-xl p-12 text-center shadow-xl">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand/3 via-transparent to-emerald-500/3 opacity-50" />
                  <div className="relative space-y-6">
                    <div className="relative">
                      <div className="w-24 h-24 bg-gradient-to-br from-brand/20 to-emerald-400/20 rounded-3xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-brand/20">
                        <Briefcase className="w-12 h-12 text-brand" />
                      </div>
                      <motion.div
                        className="absolute inset-0 rounded-3xl bg-brand/10"
                        animate={{ 
                          scale: [1, 1.05, 1],
                          opacity: [0.3, 0.6, 0.3]
                        }}
                        transition={{ 
                          repeat: Infinity, 
                          duration: 2,
                          ease: "easeInOut"
                        }}
                      />
                    </div>
                    
                    <div className="space-y-3">
                      <h3 className="text-2xl font-bold text-foreground">
                        Select a Position
                      </h3>
                      <p className="text-muted-foreground text-lg leading-relaxed max-w-md mx-auto">
                        Choose any job from the list to explore detailed information, requirements, and benefits
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-center gap-2 pt-4">
                      <div className="w-2 h-2 bg-brand/60 rounded-full"></div>
                      <div className="w-2 h-2 bg-brand/40 rounded-full"></div>
                      <div className="w-2 h-2 bg-brand/20 rounded-full"></div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </div>
        </div>

        {/* Enhanced Mobile Pagination */}
        <motion.div 
          className="mt-8 lg:hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
        >
          <Card className="bg-gradient-to-r from-card/80 to-card/60 border border-border/40 backdrop-blur-xl p-4">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="border-border/40 text-foreground hover:bg-accent/50 hover:border-brand/50 disabled:opacity-50 transition-all duration-300"
              >
                ← Previous
              </Button>
              
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Page</span>
                <div className="px-3 py-1 bg-brand/10 text-brand font-medium rounded-full border border-brand/20">
                  {currentPage} of {totalPages}
                </div>
              </div>
              
              <Button
                variant="outline"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="border-border/40 text-foreground hover:bg-accent/50 hover:border-brand/50 disabled:opacity-50 transition-all duration-300"
              >
                Next →
              </Button>
            </div>
          </Card>
        </motion.div>
        {/* Resume Picker Modal Mount */}
        <ResumePickerModal
          open={resumePickerOpen}
          resumes={resumeOptions as any}
          selectedId={selectedResumeId}
          onSelect={(id) => setSelectedResumeId(id)}
          onCancel={cancelResumePicker}
          onConfirm={confirmResumePicker}
        />
      </div>
    </div>
  );
};

// Enhanced Resume Picker Modal
function ResumePickerModal({
  open,
  resumes,
  selectedId,
  onSelect,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  resumes: Array<{ id: string; name: string; template: string | null; updated_at: string; is_favorite?: boolean }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  
  return (
    <motion.div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md" 
        onClick={onCancel}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      />
      <motion.div 
        className="relative w-full max-w-4xl rounded-2xl border border-brand/30 bg-gradient-to-br from-card/95 via-card/90 to-card/85 shadow-2xl overflow-hidden backdrop-blur-xl"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.3, type: "spring", bounce: 0.1 }}
      >
        {/* Enhanced header */}
        <div className="relative px-8 py-6 border-b border-border/30 bg-gradient-to-r from-brand/10 via-brand/5 to-emerald-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-brand to-emerald-400 rounded-xl flex items-center justify-center shadow-lg shadow-brand/25">
                <UploadCloud className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Choose Your Resume</h3>
                <p className="text-sm text-muted-foreground">Select the resume to attach to your application</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="text-muted-foreground hover:text-foreground hover:bg-accent/50"
            >
              ✕
            </Button>
          </div>
        </div>
        
        {/* Resume grid */}
        <div className="p-8 max-h-[70vh] overflow-auto">
          {resumes.length === 0 ? (
            <motion.div 
              className="text-center py-16"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <h4 className="text-lg font-semibold text-foreground mb-2">No Resumes Found</h4>
              <p className="text-muted-foreground">Upload a resume from the Resumes page to get started</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {resumes.map((resume, index) => {
                const active = selectedId === resume.id;
                const template = resume.template || 'Modern';
                return (
                  <motion.button
                    key={resume.id}
                    onClick={() => onSelect(resume.id)}
                    className={`relative group rounded-2xl border overflow-hidden text-left transition-all duration-300 hover:scale-105 ${
                      active 
                        ? 'border-brand ring-2 ring-brand/40 shadow-xl shadow-brand/25' 
                        : 'border-border/40 hover:border-brand/50 hover:shadow-lg'
                    }`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {/* Resume preview */}
                    <div className="relative h-48 bg-gradient-to-br from-muted/50 to-muted/30">
                      <img 
                        src={`/templates/jpg/${template}.jpg`} 
                        alt={template} 
                        className="w-full h-full object-cover" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      
                      {/* Favorite badge */}
                      {resume.is_favorite && (
                        <div className="absolute top-3 left-3 w-6 h-6 bg-brand/90 rounded-full flex items-center justify-center">
                          <Star className="w-3 h-3 text-black fill-current" />
                        </div>
                      )}
                      
                      {/* Selection indicator */}
                      {active && (
                        <motion.div 
                          className="absolute top-3 right-3 w-8 h-8 bg-brand rounded-full flex items-center justify-center shadow-lg"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", bounce: 0.5 }}
                        >
                          <CheckCircle2 className="w-5 h-5 text-black" />
                        </motion.div>
                      )}
                    </div>
                    
                    {/* Resume info */}
                    <div className="p-4 bg-card/80 backdrop-blur-sm">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="w-4 h-4 text-brand flex-shrink-0" />
                            <h4 className="font-semibold text-foreground truncate">{resume.name}</h4>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Updated {new Date(resume.updated_at).toLocaleDateString()}
                          </p>
                          <div className="mt-2 px-2 py-1 bg-muted/50 text-xs text-muted-foreground rounded-full inline-block">
                            {template} Template
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Enhanced footer */}
        <div className="px-8 py-6 border-t border-border/30 bg-gradient-to-r from-muted/20 via-transparent to-muted/20 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {resumes.length > 0 ? `${resumes.length} resume${resumes.length === 1 ? '' : 's'} available` : 'No resumes available'}
          </p>
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              onClick={onCancel}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button 
              onClick={onConfirm}
              variant="neo"
              disabled={!selectedId}
              className="disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Briefcase className="w-4 h-4 mr-2" />
              Attach & Apply
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}