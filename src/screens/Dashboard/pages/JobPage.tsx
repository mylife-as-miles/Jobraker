import { Briefcase, Bookmark, Building2, DollarSign, Heart, Share, Star, Users, CheckCircle2, FileText, UploadCloud } from "lucide-react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Search, MapPin, Clock, MoreVertical, Filter } from "lucide-react";
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
  // Facet panel ref for header button scroll
  const facetPanelRef = useRef<HTMLDivElement | null>(null);
  const [facetPulse, setFacetPulse] = useState(false);
  // Salary and time filters
  const [minSalary, setMinSalary] = useState<string>("");
  const [maxSalary, setMaxSalary] = useState<string>("");
  const [postedSince, setPostedSince] = useState<string>(""); // days: 3,7,14,30
  const { success, error: toastError, info } = useToast();
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<{ profile: boolean; resume: boolean } | null>(null);
  // Display density removed (simplified UI)

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
      // If a cover letter has been requested, hint it in additional info
      if (selectedCoverAttachRef.current) {
        const tmpl = selectedCoverTemplateRef.current || 'Standard';
        payload.additional_information = [
          payload.additional_information,
          `Attach Cover Letter: yes (template: ${tmpl})`
        ].filter(Boolean).join(' | ');
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
          selectedCoverAttachRef.current ? `Cover Letter: ${selectedCoverTemplateRef.current || 'Standard'}` : null,
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
  // Cover letter (cover page) attach options
  const [attachCoverLetter, setAttachCoverLetter] = useState(false);
  const [selectedCoverTemplate, setSelectedCoverTemplate] = useState<string | null>('Standard');
  const selectedCoverAttachRef = useRef<boolean>(false);
  const selectedCoverTemplateRef = useRef<string | null>(null);

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
      // Preserve cover letter selection across apply
      selectedCoverAttachRef.current = !!attachCoverLetter;
      selectedCoverTemplateRef.current = selectedCoverTemplate;
      setResumePickerOpen(false);
      // Trigger apply with possible override
      await quickApply(jobPendingApply);
      // Note: cover selection is passed inside quickApply payload below
    } finally {
      // reset override to avoid leaking into other applies
      setTimeout(() => { selectedResumeSignedUrl.current = null; }, 0);
      setTimeout(() => { selectedCoverAttachRef.current = false; selectedCoverTemplateRef.current = null; }, 0);
      setJobPendingApply(null);
    }
  }, [jobPendingApply, selectedResumeId, resumeOptions, getSignedUrl, quickApply, info, attachCoverLetter, selectedCoverTemplate]);

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

  // Reset only salary/time filters and refresh current results/facets
  const resetSalaryTime = useCallback(() => {
    setMinSalary("");
    setMaxSalary("");
    setPostedSince(""); // 'any'
    // Refresh facets and re-apply current facet selections against DB
    fetchFacets();
    applyFacetFilters(Array.from(selectedReq), Array.from(selectedBen));
  }, [fetchFacets, applyFacetFilters, selectedReq, selectedBen]);

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

  // Compute simple match score vs. selected facet filters for a job
  const getMatchScore = useCallback((job: Job) => {
    const totalFilters = selectedReq.size + selectedBen.size;
    if (totalFilters === 0) return { matched: 0, total: 0, pct: 0 };
    const reqSet = new Set(job.requirements.map((r) => r.toLowerCase()));
    const benSet = new Set(job.benefits.map((b) => b.toLowerCase()));
    let matched = 0;
    for (const r of selectedReq) if (reqSet.has(r.toLowerCase())) matched++;
    for (const b of selectedBen) if (benSet.has(b.toLowerCase())) matched++;
    const pct = Math.round((matched / totalFilters) * 100);
    return { matched, total: totalFilters, pct };
  }, [selectedReq, selectedBen]);

  return (
    <div className="min-h-screen bg-black" role="main" aria-label="Job search">
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">Job Search</h1>
              <div className="flex items-center gap-2 flex-wrap">
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
                {readiness && (
                  <>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wide border ${readiness.profile ? 'border-emerald-400/40 text-emerald-300 bg-emerald-500/10' : 'border-red-400/40 text-red-300 bg-red-500/10'}`}
                      title={readiness.profile ? 'Profile info available' : 'Missing profile info'}
                    >
                      Profile {readiness.profile ? '✓' : 'Missing'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wide border ${readiness.resume ? 'border-emerald-400/40 text-emerald-300 bg-emerald-500/10' : 'border-red-400/40 text-red-300 bg-red-500/10'}`}
                      title={readiness.resume ? 'Resume available' : 'Missing resume'}
                    >
                      Resume {readiness.resume ? '✓' : 'Missing'}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <Button 
                variant="outline" 
                onClick={() => {
                  if (facetPanelRef.current) {
                    facetPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    setFacetPulse(true);
                    setTimeout(() => setFacetPulse(false), 1200);
                  }
                }}
                className="border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:border-[#1dff00]/50 hover:scale-105 transition-all duration-300"
              >
                <Filter className="w-4 h-4 mr-2" />
                {activeFacetCount > 0 ? `Filters (${activeFacetCount})` : 'Filters'}
              </Button>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-4 sm:p-6 mb-6 sm:mb-8" role="region" aria-label="Search and filters">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Search Input */}
            <div className="lg:col-span-2 relative">
              <label htmlFor="job-search" className="sr-only">Search jobs</label>
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#ffffff60]" />
              <Input
                id="job-search"
                name="job-search"
                placeholder="Search jobs, companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] hover:border-[#ffffff4d] transition-all duration-300"
              />
            </div>
            
            {/* Location Filter */}
            <div className="relative">
              <label htmlFor="job-location" className="sr-only">Location</label>
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#ffffff60]" />
              <Input
                id="job-location"
                name="job-location"
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
          {/* Salary & Time filters row */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="relative">
              <label htmlFor="salary-min" className="sr-only">Minimum salary</label>
              <Input
                id="salary-min"
                name="salary-min"
              placeholder="Min salary (e.g. 120000)"
              inputMode="numeric"
              value={minSalary}
              onChange={(e) => setMinSalary(e.target.value.replace(/[^0-9]/g, ''))}
              className="bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00]"
              />
            </div>
            <div className="relative">
              <label htmlFor="salary-max" className="sr-only">Maximum salary</label>
              <Input
                id="salary-max"
                name="salary-max"
              placeholder="Max salary (e.g. 200000)"
              inputMode="numeric"
              value={maxSalary}
              onChange={(e) => setMaxSalary(e.target.value.replace(/[^0-9]/g, ''))}
              className="bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00]"
              />
            </div>
            <div className="relative">
              <label id="posted-since-label" className="sr-only">Posted since</label>
              <SafeSelect fallbackValue="any" value={postedSince} onValueChange={(v) => setPostedSince(v === 'any' ? '' : v)}>
                <SelectTrigger className="h-10" aria-labelledby="posted-since-label" aria-label="Posted since" name="posted-since">
                <SelectValue placeholder="Posted since" />
                </SelectTrigger>
                <SelectContent>
        <SelectItem value="any">Any time</SelectItem>
                <SelectItem value="3">Last 3 days</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                </SelectContent>
              </SafeSelect>
            </div>
            <div className="flex gap-2 items-center">
              <Button
                variant="outline"
                onClick={() => { fetchFacets(); applyFacetFilters(Array.from(selectedReq), Array.from(selectedBen)); }}
                className="border-[#ffffff33] text-white hover:bg-[#ffffff1a]"
              >
                Apply filters
              </Button>
              <Button
                variant="ghost"
                onClick={resetSalaryTime}
                className="text-[#1dff00] hover:bg-[#1dff00]/10"
                title="Reset salary and posted time filters"
              >
                Reset salary/time
              </Button>
              <Button
                variant="ghost"
                onClick={clearAllFilters}
                className="text-[#1dff00] hover:bg-[#1dff00]/10"
                title="Clear all facet chips and salary/time"
              >
                Clear all filters
              </Button>
            </div>
          </div>
        </Card>

        {/* Job List and Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8" aria-label="Results and details">
          {/* Job List */}
          <div className="space-y-4" role="region" aria-label="Filters and results list">
            {/* Facet Panel */}
            <Card ref={facetPanelRef} className={`bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border backdrop-blur-[25px] p-4 ${facetPulse ? 'border-[#1dff00] shadow-[0_0_20px_rgba(29,255,0,0.3)]' : 'border-[#ffffff15]'}` }>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold text-sm">Facet Filters</h3>
                <div className="flex items-center gap-2">
                  {facetLoading && <span className="text-xs text-[#ffffff80]">Loading…</span>}
                  {activeFacetCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFacetFilters} className="text-[#1dff00] hover:bg-[#1dff00]/10">
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-[#ffffff80] mb-2">Requirements</div>
                  <div className="flex flex-wrap gap-2">
                    {(facets.requirements || []).slice(0, 12).map((f) => {
                      const active = selectedReq.has(f.value);
                      return (
                        <button
                          key={`req-${f.value}`}
                          onClick={() => toggleReq(f.value)}
                          className={`px-2 py-1 rounded border text-xs transition ${active ? 'border-[#1dff00]/60 text-[#1dff00] bg-[#1dff0033]' : 'border-[#ffffff2a] text-[#ffffffb3] bg-[#ffffff10] hover:border-[#1dff00]/40 hover:bg-[#1dff00]/10'}`}
                          title={`${f.value} (${f.count})`}
                        >
                          {f.value}
                          <span className="ml-1 text-[10px] opacity-70">{f.count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-[#ffffff80] mb-2">Benefits</div>
                  <div className="flex flex-wrap gap-2">
                    {(facets.benefits || []).slice(0, 12).map((f) => {
                      const active = selectedBen.has(f.value);
                      return (
                        <button
                          key={`ben-${f.value}`}
                          onClick={() => toggleBen(f.value)}
                          className={`px-2 py-1 rounded border text-xs transition ${active ? 'border-[#1dff00]/60 text-[#1dff00] bg-[#1dff0033]' : 'border-[#ffffff2a] text-[#ffffffb3] bg-[#ffffff10] hover:border-[#1dff00]/10 hover:bg-[#1dff00]/10'}`}
                          title={`${f.value} (${f.count})`}
                        >
                          {f.value}
                          <span className="ml-1 text-[10px] opacity-70">{f.count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
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
                  <SafeSelect fallbackValue="10" value={String(pageSize)} onValueChange={(v) => { setPageSize(parseInt(v)); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[90px] h-8">
            <SelectValue placeholder="Rows" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </SafeSelect>
                </div>
                <div className="hidden md:flex items-center gap-2 ml-3">
                  <span>Sort:</span>
                  <SafeSelect fallbackValue="relevance" value={sortBy} onValueChange={(v) => { setSortBy(v as any); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[160px] h-8">
            <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevance">Relevance</SelectItem>
                      <SelectItem value="posted_desc">Date (Newest)</SelectItem>
                    </SelectContent>
                  </SafeSelect>
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
                    <Card className={`bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-4 sm:p-6`}>
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
            {error && (
              <Card className="border border-red-500/30 bg-red-500/10 text-red-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">We hit a snag</div>
                    <div className="text-sm opacity-90">{error}</div>
                  </div>
                  <Button variant="outline" className="border-red-500/40 text-red-200 hover:bg-red-500/10" onClick={() => performSearch()}>Retry</Button>
                </div>
              </Card>
            )}

            {!loading && !error && filteredJobs.length === 0 && (
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-8 text-center">
                <Briefcase className="w-14 h-14 text-[#ffffff40] mx-auto mb-4" />
                <h3 className="text-xl font-medium text-white mb-2">No results</h3>
                <p className="text-[#ffffff80] mb-4">Try broadening your search or clearing filters.</p>
                <div className="flex items-center justify-center gap-2">
                  <Button variant="outline" className="border-[#ffffff33] text-white hover:bg-[#ffffff1a]" onClick={() => { setSearchQuery(''); setSelectedLocation(''); }}>
                    Reset query
                  </Button>
                  <Button className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90" onClick={clearAllFilters}>Clear all filters</Button>
                </div>
              </Card>
            )}

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
                <Card role="listitem" aria-label={`${job.title} at ${job.company}`} className={`bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border backdrop-blur-[25px] p-4 sm:p-6 transition-all duration-300 hover:shadow-lg ${
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
                            onError={() => {
                              setLogoError((m) => ({ ...m, [job.id]: true }));
                              // Cache failed logo URL to avoid future 404s
                              if (job.logoUrl) logoFailureCache.add(job.logoUrl);
                            }}
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
                        {/* Match indicator */}
                        {activeFacetCount > 0 && (() => { const ms = getMatchScore(job); return (
                          <span className="inline-flex items-center gap-2 px-2 py-1 rounded border border-[#ffffff2a] text-xs text-[#ffffffb3] bg-[#ffffff10]" title={`Matches ${ms.matched}/${ms.total} selected filters`}>
                            <span className="inline-block w-20 h-1.5 bg-white/10 rounded overflow-hidden">
                              <span className="block h-full bg-[#1dff00]" style={{ width: `${ms.pct}%` }} />
                            </span>
                            <span>{ms.pct}% match</span>
                          </span>
                        ); })()}
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
                                onError={() => {
                                  setLogoError((m) => ({ ...m, [job.id]: true }));
                                  // Cache failed logo URL to avoid future 404s
                                  if (job.logoUrl) logoFailureCache.add(job.logoUrl);
                                }}
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
                              onClick={() => shareJob(job)}
                              className="text-[#ffffff80] hover:text-white hover:scale-110 transition-all duration-300"
                              aria-label="Copy job link"
                            >
                              <Share className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => toggleBookmark(job)}
                              className={`text-[#ffffff80] hover:text-white hover:scale-110 transition-all duration-300 ${job.isBookmarked ? 'text-[#1dff00]' : ''}`}
                              aria-label={job.isBookmarked ? 'Unsave job' : 'Save job'}
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
                            {activeFacetCount > 0 && (() => { const ms = getMatchScore(job); return (
                              <span className="hidden sm:inline-flex items-center gap-2 px-2 py-1 rounded border border-[#ffffff2a] text-xs text-[#ffffffb3] bg-[#ffffff10]" title={`Matches ${ms.matched}/${ms.total} selected filters`}>
                                <span className="inline-block w-24 h-1.5 bg-white/10 rounded overflow-hidden">
                                  <span className="block h-full bg-[#1dff00]" style={{ width: `${ms.pct}%` }} />
                                </span>
                                <span>{ms.pct}% match</span>
                              </span>
                            ); })()}
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
                              onClick={() => openResumePicker(job)}
                              disabled={!!applyingJobId || job.isApplied}
                              className={`bg-[#1dff00] text-black hover:bg-[#1dff00]/90 transition-all duration-300 flex-1 sm:flex-none ${(applyingJobId || job.isApplied) ? 'opacity-70 cursor-not-allowed hover:scale-100' : 'hover:scale-105'}`}
                            >
                              {job.isApplied ? 'Applied' : (applyingJobId === job.id ? 'Applying…' : 'Apply Now')}
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
        {/* Resume Picker Modal Mount */}
        <ResumePickerModal
          open={resumePickerOpen}
          resumes={resumeOptions as any}
          selectedId={selectedResumeId}
          onSelect={(id) => setSelectedResumeId(id)}
          onCancel={cancelResumePicker}
          onConfirm={confirmResumePicker}
          attachCoverLetter={attachCoverLetter}
          onToggleCoverLetter={(v) => setAttachCoverLetter(v)}
          selectedCoverTemplate={selectedCoverTemplate}
          onSelectCoverTemplate={(tmpl) => setSelectedCoverTemplate(tmpl)}
        />
      </div>
    </div>
  );
};

// Resume Picker Modal
function ResumePickerModal({
  open,
  resumes,
  selectedId,
  onSelect,
  onCancel,
  onConfirm,
  attachCoverLetter = false,
  onToggleCoverLetter,
  selectedCoverTemplate = 'Standard',
  onSelectCoverTemplate,
}: {
  open: boolean;
  resumes: Array<{ id: string; name: string; template: string | null; updated_at: string; is_favorite?: boolean }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  attachCoverLetter?: boolean;
  onToggleCoverLetter?: (v: boolean) => void;
  selectedCoverTemplate?: string | null;
  onSelectCoverTemplate?: (tmpl: string) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-3xl rounded-xl border border-[#1dff00]/20 bg-gradient-to-br from-[#0a0a0a] via-[#0b0b0b] to-[#050505] shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1dff00]/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#1dff00]">
            <UploadCloud className="w-4 h-4" />
            <h3 className="font-semibold">Choose a resume to attach</h3>
          </div>
          <button onClick={onCancel} className="text-white/60 hover:text-white">✕</button>
        </div>
        <div className="p-5 max-h-[60vh] overflow-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
          {resumes.length === 0 && (
            <div className="text-center text-white/70 py-8">No resumes yet. Import one from the Resumes page.</div>
          )}
          {resumes.map((r) => {
            const active = selectedId === r.id;
            const template = r.template || 'Modern';
            return (
              <button
                key={r.id}
                onClick={() => onSelect(r.id)}
                className={`relative rounded-lg border transition group overflow-hidden text-left ${active ? 'border-[#1dff00] ring-2 ring-[#1dff00]/40' : 'border-white/10 hover:border-[#1dff00]/40'}`}
              >
                <img src={`/templates/jpg/${template}.jpg`} alt={template} className="w-full h-36 object-cover opacity-90" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium truncate flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#1dff00]" /> {r.name}
                      </div>
                      <div className="text-xs text-white/70">Updated {new Date(r.updated_at).toLocaleString()}</div>
                    </div>
                    {active && <CheckCircle2 className="w-5 h-5 text-[#1dff00]" />}
                  </div>
                </div>
              </button>
            );
          })}
          {/* Cover Letter Section */}
          <div className="sm:col-span-2 mt-2">
            <div className="rounded-lg border border-white/10 p-4 bg-white/5">
              <div className="flex items-center justify-between">
                <div className="text-white font-medium">Attach Cover Letter (Cover Page)</div>
                <button
                  onClick={() => onToggleCoverLetter && onToggleCoverLetter(!attachCoverLetter)}
                  className={`px-3 py-1 rounded-md text-sm border transition ${attachCoverLetter ? 'border-[#1dff00] text-black bg-[#1dff00]' : 'border-white/20 text-white/80 hover:border-[#1dff00]/40'}`}
                >
                  {attachCoverLetter ? 'Attached' : 'Attach'}
                </button>
              </div>
              {attachCoverLetter && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {['Standard','Modern','Elegant'].map(tmpl => (
                    <button
                      key={tmpl}
                      onClick={() => onSelectCoverTemplate && onSelectCoverTemplate(tmpl)}
                      className={`px-2 py-1 rounded border text-xs transition ${selectedCoverTemplate === tmpl ? 'border-[#1dff00] text-[#1dff00] bg-[#1dff0033]' : 'border-white/20 text-white/80 hover:border-[#1dff00]/40'}`}
                    >
                      {tmpl}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-white/10 flex items-center justify-end gap-3">
          <button onClick={onCancel} className="px-3 py-2 rounded-md text-white/80 hover:text-white">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-md bg-[#1dff00] text-black hover:bg-[#1dff00]/90">Attach & Apply</button>
        </div>
      </div>
    </div>
  );
}