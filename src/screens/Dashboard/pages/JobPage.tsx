import { Briefcase, Building2, DollarSign, Share, Star, Users, CheckCircle2, FileText, UploadCloud, Pencil, Play, MapPin, Clock, MoreVertical, Filter, X, Loader2 } from "lucide-react";
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
  // Drawers
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  // Bookmark drawer/state removed
  // Quick presets (lightweight helpers)
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('job_quick_presets');
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch { return new Set(); }
  });
  // Saved/bookmark feature removed (always false)
  const savedOnly = false;
  // Salary and time filters
  const [minSalary, setMinSalary] = useState<string>("");
  const [maxSalary, setMaxSalary] = useState<string>("");
  const [postedSince, setPostedSince] = useState<string>(""); // days: 3,7,14,30
  const { success, error: toastError, info } = useToast();
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  // Resume data (moved up so dependent hooks below can safely reference)
  const { resumes: resumeOptions, getSignedUrl } = useResumes();
  // Auto-apply state & advanced animation overlay
  const [autoApplying, setAutoApplying] = useState(false);
  const [autoApplyStatuses, setAutoApplyStatuses] = useState<Record<string, { status: 'pending' | 'applying' | 'success' | 'error'; error?: string }>>({});
  const [autoApplyQueue, setAutoApplyQueue] = useState<Job[]>([]);
  const [autoApplyVisible, setAutoApplyVisible] = useState(false);
  const [autoApplyCancelRequested, setAutoApplyCancelRequested] = useState(false);
  const [pendingAutoApplyStart, setPendingAutoApplyStart] = useState(false);
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

  // Placeholder: fetch user profile preferences (skills, titles, preferred location) for first load
  const [initializedFromProfile, setInitializedFromProfile] = useState(false);
  useEffect(() => {
    if (initializedFromProfile) return;
    try {
      // Attempt to hydrate from stored profile preferences (mock keys)
      const raw = localStorage.getItem('jr.profile.prefs');
      if (raw) {
        const prefs = JSON.parse(raw);
        if (prefs?.defaultRole && !searchQuery) setSearchQuery(prefs.defaultRole);
        if (prefs?.defaultLocation && !selectedLocation) setSelectedLocation(prefs.defaultLocation);
      }
    } catch {}
    setInitializedFromProfile(true);
  }, [initializedFromProfile, searchQuery, selectedLocation]);

  // Trigger initial search automatically when profile hydration done & no jobs yet
  useEffect(() => {
    if (initializedFromProfile && jobs.length === 0 && !loading) {
      performSearch();
    }
  }, [initializedFromProfile, jobs.length, loading, performSearch]);

  // Manual refresh from job sources (e.g., re-run scraping or DB query) ignoring current filter state except core query/location/type
  const refreshFromSources = useCallback(() => {
    performSearch();
  }, [performSearch]);

  // Bookmarks removed (loadBookmarks stub deleted)

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

  // Bookmarks hydration removed

  // Toggle and fetch details for a saved job from job_listings
  // toggleSavedDetails removed

  // Convert a job_listings row to local Job shape for applying from Saved drawer
  // listingRowToJob helper removed with bookmark feature

  // toggleBookmark & removeBookmarkByUrl helpers removed

  // Cover letter library selection (available before quickApply uses it)
  type LibEntry = { id: string; name: string; updatedAt: string; data: any };
  const [coverLibrary, setCoverLibrary] = useState<LibEntry[]>([]);
  const [selectedCoverId, setSelectedCoverId] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('jr.coverLetters.library.v1');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setCoverLibrary(arr);
      }
      const defId = localStorage.getItem('jr.coverLetters.defaultId');
      if (defId) setSelectedCoverId(defId);
    } catch {}
  }, []);

  const quickApply = useCallback(async (job: Job): Promise<boolean> => {
    // prevent parallel
    if (applyingJobId) return false;
    setApplyingJobId(job.id);
    let successFlag = false;
    try {
      const { data: userData } = await (supabase as any).auth.getUser();
      const uid = (userData as any)?.user?.id;
      if (!uid) {
        toastError('Login required', 'Sign in to apply');
        setApplyingJobId(null);
        return false;
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
        let letterLabel: string | null = null;
        try {
          if (selectedCoverId) {
            const entry = (coverLibrary || []).find((e) => e.id === selectedCoverId);
            if (entry?.name) letterLabel = `saved:${entry.name}`;
          } else {
            letterLabel = 'draft';
          }
        } catch {}
        payload.additional_information = [
          payload.additional_information,
          `Attach Cover Letter: yes (template: ${tmpl}${letterLabel ? `, letter: ${letterLabel}` : ''})`
        ].filter(Boolean).join(' | ');
        // Prefer selected saved letter; fallback to current draft
        const materializeLetter = (parsed: any) => {
          const paras: string[] = Array.isArray(parsed?.paragraphs) ? parsed.paragraphs.filter((p: any) => typeof p === 'string' && p.trim()) : [];
          const body: string = (paras.length ? paras.join("\n\n") : (parsed?.content || '')).trim();
          const sal: string = (parsed?.salutation || '').trim();
          const close: string = (parsed?.closing || '').trim();
          const sig: string = (parsed?.signatureName || parsed?.senderName || '').trim();
          const headerParts: string[] = [];
          if (parsed?.senderName) headerParts.push(parsed.senderName);
          if (parsed?.senderPhone) headerParts.push(parsed.senderPhone);
          if (parsed?.senderEmail) headerParts.push(parsed.senderEmail);
          if (parsed?.senderAddress) headerParts.push(parsed.senderAddress);
          const dateLine = parsed?.date ? new Date(parsed.date).toLocaleDateString() : '';
          const recipientLine = [parsed?.recipient, parsed?.recipientTitle].filter(Boolean).join(', ').trim();
          const companyLine = (parsed?.company || '').trim();
          const recipientAddr = (parsed?.recipientAddress || '').trim();
          const subjectLine = (parsed?.subject || '').trim();
          const lines: string[] = [];
          if (headerParts.length) { lines.push(...headerParts, ''); }
          if (dateLine) { lines.push(dateLine, ''); }
          if (recipientLine || companyLine || recipientAddr) {
            if (recipientLine) lines.push(recipientLine);
            if (companyLine) lines.push(companyLine);
            if (recipientAddr) lines.push(recipientAddr);
            lines.push('');
          }
          if (subjectLine) { lines.push(`Subject: ${subjectLine}`, ''); }
          if (sal) { lines.push(sal, ''); }
          if (body) { lines.push(body, ''); }
          if (close) { lines.push(close); }
          if (sig) { lines.push(sig); }
          return lines.join("\n").trim();
        };
        try {
          let parsed: any = null;
          if (selectedCoverId) {
            const libRaw = localStorage.getItem('jr.coverLetters.library.v1');
            if (libRaw) {
              const arr = JSON.parse(libRaw);
              const entry = Array.isArray(arr) ? arr.find((e: any) => e?.id === selectedCoverId) : null;
              if (entry && entry.data) parsed = entry.data;
            }
          }
          if (!parsed) {
            const raw = localStorage.getItem('jr.coverLetter.draft.v2');
            if (raw) parsed = JSON.parse(raw);
          }
          if (parsed) {
            const full = materializeLetter(parsed);
            if (full) payload.cover_letter = full;
          }
        } catch {}
        if (selectedCoverTemplateRef.current) payload.cover_letter_template = selectedCoverTemplateRef.current;
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
          selectedCoverAttachRef.current ? `Cover Letter: ${(selectedCoverTemplateRef.current || 'Standard')}${(selectedCoverId ? (()=>{const e=(coverLibrary||[]).find(x=>x.id===selectedCoverId);return e?` (saved: ${e.name})`:''})() : ' (draft)')}` : null,
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
  successFlag = true;

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
        successFlag = true;
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
    return successFlag;
  }, [supabase, success, toastError, info, applyingJobId, selectedCoverId]);

  // Start auto-apply flow (opens resume picker first)
  const startAutoApplyFlow = useCallback(() => {
    if (autoApplying) return;
    const targets = jobs.filter(j => !j.isApplied);
    if (!targets.length) { info('No pending jobs', 'All listed jobs already applied'); return; }
    setPendingAutoApplyStart(true);
    setAutoApplyQueue(targets);
    // Preselect resume like single apply
    const pick = (resumeOptions || []).slice().sort((a, b) => {
      const favA = (a as any).is_favorite ? 1 : 0;
      const favB = (b as any).is_favorite ? 1 : 0;
      if (favA !== favB) return favB - favA;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    })[0];
    setSelectedResumeId(pick?.id ?? null);
    setResumePickerOpen(true);
  }, [autoApplying, jobs, info, resumeOptions]);

  // Run the auto-apply queue sequentially with animated status updates
  const runAutoApplyQueue = useCallback(async () => {
    if (!autoApplyQueue.length) return;
    setAutoApplyCancelRequested(false);
    // initialize statuses
    const init: Record<string, {status:'pending'|'applying'|'success'|'error'; error?: string}> = {};
    for (const j of autoApplyQueue) init[j.id] = { status: 'pending' };
    setAutoApplyStatuses(init);
    setAutoApplyVisible(true);
    setAutoApplying(true);
    for (let i = 0; i < autoApplyQueue.length; i++) {
      if (autoApplyCancelRequested) break;
      const job = autoApplyQueue[i];
      setAutoApplyStatuses(s => ({ ...s, [job.id]: { status: 'applying' } }));
      const ok = await quickApply(job);
      setAutoApplyStatuses(s => ({ ...s, [job.id]: { status: ok ? 'success' : 'error' } }));
      // small stagger for visual rhythm
      await new Promise(r => setTimeout(r, 450));
    }
    setAutoApplying(false);
    // auto hide after delay unless there are errors
    setTimeout(() => {
      setAutoApplyVisible(false);
      setAutoApplyStatuses({});
      setAutoApplyQueue([]);
    }, Object.values(autoApplyStatuses).some(v => v.status === 'error') ? 6000 : 2500);
  }, [autoApplyQueue, quickApply, autoApplyCancelRequested, autoApplyStatuses]);

  const AutoApplyControls = () => (
    <div className="flex items-center gap-3">
      <Button
        variant='outline'
        onClick={startAutoApplyFlow}
        className={`border-[#1dff00]/40 text-[#1dff00] hover:bg-[#1dff00]/10 hover:border-[#1dff00] transition-all duration-300 relative overflow-hidden group ${autoApplying ? 'pointer-events-none opacity-70' : ''}`}
        title='Choose a resume and auto apply to all pending jobs'
      >
        <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-[#1dff0066] via-transparent to-[#1dff0066] animate-[pulse_3s_linear_infinite]" />
        <Play className="w-4 h-4 mr-2" /> Auto Apply All
      </Button>
      {autoApplying && (
        <div className="flex items-center gap-2 text-xs text-white/70">
          <Loader2 className="w-4 h-4 animate-spin" /> Applying...
        </div>
      )}
    </div>
  );

  // ==== Resume Picker (Modern UI) ====
  const [resumePickerOpen, setResumePickerOpen] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const selectedResumeSignedUrl = useRef<string | null>(null);
  // Cover letter (cover page) attach options
  const [attachCoverLetter, setAttachCoverLetter] = useState(false);
  const [selectedCoverTemplate, setSelectedCoverTemplate] = useState<string | null>('Standard');
  const selectedCoverAttachRef = useRef<boolean>(false);
  const selectedCoverTemplateRef = useRef<string | null>(null);

  // Single job open picker disabled (auto apply only)

  const cancelResumePicker = useCallback(() => {
    setResumePickerOpen(false);
    setSelectedResumeId(null);
    selectedResumeSignedUrl.current = null;
  }, []);

  const confirmResumePicker = useCallback(async () => {
    try {
      selectedResumeSignedUrl.current = null;
      if (selectedResumeId) {
        const chosen = (resumeOptions || []).find(r => r.id === selectedResumeId);
        if (chosen?.file_path) {
          const url = await getSignedUrl(chosen.file_path);
          if (url) selectedResumeSignedUrl.current = url; else info?.('Using latest resume', 'Could not sign selected; falling back');
        }
      }
      selectedCoverAttachRef.current = !!attachCoverLetter;
      selectedCoverTemplateRef.current = selectedCoverTemplate;
      setResumePickerOpen(false);
      if (pendingAutoApplyStart) {
        setPendingAutoApplyStart(false);
        runAutoApplyQueue();
      }
    } finally {
      setTimeout(() => { selectedResumeSignedUrl.current = null; }, 0);
      setTimeout(() => { selectedCoverAttachRef.current = false; selectedCoverTemplateRef.current = null; }, 0);
    }
  }, [attachCoverLetter, selectedCoverTemplate, getSignedUrl, info, pendingAutoApplyStart, resumeOptions, runAutoApplyQueue, selectedResumeId]);

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

  // Persist quick presets
  useEffect(() => {
    try { localStorage.setItem('job_quick_presets', JSON.stringify(Array.from(selectedPresets))); } catch {}
  }, [selectedPresets]);
  // savedOnly persistence removed

  // Toggle a preset and update corresponding filters conservatively
  const togglePreset = (key: 'remote' | 'gt100k' | 'last7') => {
    const next = new Set(selectedPresets);
    const isOn = next.has(key);
    if (isOn) {
      next.delete(key);
      // Revert only if unchanged since applying
      if (key === 'remote' && selectedType === 'Remote') setSelectedType('All');
      if (key === 'gt100k' && minSalary === '100000') setMinSalary('');
      if (key === 'last7' && postedSince === '7') setPostedSince('');
    } else {
      next.add(key);
      if (key === 'remote') setSelectedType('Remote');
      if (key === 'gt100k') setMinSalary('100000');
      if (key === 'last7') setPostedSince('7');
    }
    setSelectedPresets(next);
  };

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
  // saved removed
      if (q) setSearchQuery(q);
      if (loc) setSelectedLocation(loc);
      if (type) setSelectedType(type);
      if (req?.length) setSelectedReq(new Set(req.flatMap(s => s.split(',').map(x => x.trim()).filter(Boolean))));
      if (ben?.length) setSelectedBen(new Set(ben.flatMap(s => s.split(',').map(x => x.trim()).filter(Boolean))));
      if (min) setMinSalary(min);
      if (max) setMaxSalary(max);
      if (posted) setPostedSince(posted);
  // ignore saved flag
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
  // saved flag omitted from URL
      const next = u.toString();
      if (next !== window.location.href) window.history.replaceState({}, '', next);
    } catch {}
  }, [debouncedSearchQuery, debouncedSelectedLocation, selectedType, selectedReq, selectedBen, minSalary, maxSalary, postedSince, savedOnly]);

  // Derived chip counts
  const activeFacetCount = useMemo(() => selectedReq.size + selectedBen.size, [selectedReq, selectedBen]);
  // Non-facet filters state helpers
  const hasType = selectedType !== 'All';
  const hasMin = !!minSalary;
  const hasMax = !!maxSalary;
  const hasPosted = !!postedSince;
  // bookmarks fully removed

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

  // Exclude already applied jobs from the visible list
  const filteredJobs = jobs.filter(job => !job.isApplied && (selectedType === 'All' || job.type === selectedType));

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
              {/* Mobile: open drawer */}
              <Button
                variant="outline"
                onClick={() => setMobileFiltersOpen(true)}
                className="sm:hidden border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:border-[#1dff00]/50 transition-all duration-300"
              >
                <Filter className="w-4 h-4 mr-2" />
                {activeFacetCount > 0 ? `Filters (${activeFacetCount})` : 'Filters'}
              </Button>
              {/* Desktop: scroll to facet panel */}
              <Button 
                variant="outline" 
                onClick={() => {
                  if (facetPanelRef.current) {
                    facetPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    setFacetPulse(true);
                    setTimeout(() => setFacetPulse(false), 1200);
                  }
                }}
                className="hidden sm:inline-flex border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:border-[#1dff00]/50 hover:scale-105 transition-all duration-300"
              >
                <Filter className="w-4 h-4 mr-2" />
                {activeFacetCount > 0 ? `Filters (${activeFacetCount})` : 'Filters'}
              </Button>
              {/* Auto Apply & Search Controls */}
              <div className="flex items-center gap-3">
                <AutoApplyControls />
                <Button
                  variant="ghost"
                  onClick={refreshFromSources}
                  className="text-[#1dff00] hover:bg-[#1dff00]/10"
                  title="Run a new job search from sources"
                >
                  Search Jobs
                </Button>
              </div>
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
          {/* Quick Presets */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-[#ffffff80] mr-1">Quick presets:</span>
            <button
              type="button"
              onClick={() => togglePreset('remote')}
              className={`px-2 py-1 rounded border text-xs transition ${selectedPresets.has('remote') ? 'border-[#1dff00]/60 text-[#1dff00] bg-[#1dff0033]' : 'border-[#ffffff2a] text-[#ffffffb3] bg-[#ffffff10] hover:border-[#1dff00]/40 hover:bg-[#1dff00]/10'}`}
            >
              Remote
            </button>
            <button
              type="button"
              onClick={() => togglePreset('gt100k')}
              className={`px-2 py-1 rounded border text-xs transition ${selectedPresets.has('gt100k') ? 'border-[#1dff00]/60 text-[#1dff00] bg-[#1dff0033]' : 'border-[#ffffff2a] text-[#ffffffb3] bg-[#ffffff10] hover:border-[#1dff00]/40 hover:bg-[#1dff00]/10'}`}
            >
              {`>$100k`}
            </button>
            <button
              type="button"
              onClick={() => togglePreset('last7')}
              className={`px-2 py-1 rounded border text-xs transition ${selectedPresets.has('last7') ? 'border-[#1dff00]/60 text-[#1dff00] bg-[#1dff0033]' : 'border-[#ffffff2a] text-[#ffffffb3] bg-[#ffffff10] hover:border-[#1dff00]/40 hover:bg-[#1dff00]/10'}`}
            >
              Last 7 days
            </button>
            {/* Saved only preset removed */}
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

  {/* Active Filters (non-facet) */}
  {(hasType || hasMin || hasMax || hasPosted) && (
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-wide text-[#ffffff80] mr-1">Active:</span>
            {hasType && (
              <button onClick={() => setSelectedType('All')} className="px-2 py-1 rounded border border-white/20 bg-white/5 text-xs text-white/80 hover:border-[#1dff00]/40 group">
                Type: <span className="ml-1 text-white">{selectedType}</span>
                <span className="ml-2 text-white/60 group-hover:text-white">×</span>
              </button>
            )}
            {hasMin && (
              <button onClick={() => setMinSalary('')} className="px-2 py-1 rounded border border-white/20 bg-white/5 text-xs text-white/80 hover:border-[#1dff00]/40 group">
                Min: <span className="ml-1 text-white">${minSalary}</span>
                <span className="ml-2 text-white/60 group-hover:text-white">×</span>
              </button>
            )}
            {hasMax && (
              <button onClick={() => setMaxSalary('')} className="px-2 py-1 rounded border border-white/20 bg-white/5 text-xs text-white/80 hover:border-[#1dff00]/40 group">
                Max: <span className="ml-1 text-white">${maxSalary}</span>
                <span className="ml-2 text-white/60 group-hover:text-white">×</span>
              </button>
            )}
            {hasPosted && (
              <button onClick={() => setPostedSince('')} className="px-2 py-1 rounded border border-white/20 bg-white/5 text-xs text-white/80 hover:border-[#1dff00]/40 group">
                Posted: <span className="ml-1 text-white">Last {postedSince} days</span>
                <span className="ml-2 text-white/60 group-hover:text-white">×</span>
              </button>
            )}
          </div>
        )}

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
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <Button variant="outline" className="border-[#ffffff33] text-white hover:bg-[#ffffff1a]" onClick={() => { setSearchQuery(''); setSelectedLocation(''); }}>
                    Reset query
                  </Button>
                  <Button className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90" onClick={clearAllFilters}>Clear all filters</Button>
                  {/* Saved jobs button removed */}
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
                        {/* Applied badge removed (applied jobs hidden) */}
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
                          
                          {/* Per-job apply removed - auto apply only */}
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
          coverLibrary={coverLibrary as any}
          selectedCoverId={selectedCoverId}
          onSelectCoverId={(id) => setSelectedCoverId(id)}
        />

        {/* Auto Apply Overlay */}
        {autoApplyVisible && (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4 pointer-events-none">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="relative w-full max-w-3xl pointer-events-auto rounded-2xl border border-[#1dff00]/30 bg-gradient-to-br from-[#0d0d0d] via-[#060606] to-[#030303] shadow-[0_0_0_1px_rgba(29,255,0,0.15)] overflow-hidden"
            >
              <div className="px-6 py-4 flex items-center justify-between border-b border-[#1dff00]/20">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-[#1dff00]/15 flex items-center justify-center shadow-inner shadow-[#1dff00]/40">
                    <Play className="w-4 h-4 text-[#1dff00]" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold leading-tight">Auto Applying {autoApplyQueue.length} Jobs</h3>
                    <p className="text-xs text-white/50">Sit tight – we’ll run through each posting with your chosen resume.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {autoApplying && (
                    <button onClick={() => setAutoApplyCancelRequested(true)} className="text-xs px-3 py-1.5 rounded-md border border-white/15 text-white/70 hover:text-white hover:border-[#ff5252]/50 hover:bg-[#ff5252]/10 transition">Cancel Remaining</button>
                  )}
                  <button onClick={() => { if (!autoApplying) { setAutoApplyVisible(false); } }} className="text-white/60 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {/* Progress Bar */}
              {(() => {
                const total = autoApplyQueue.length || 1;
                const done = Object.values(autoApplyStatuses).filter(s => s.status === 'success' || s.status === 'error').length;
                const pct = Math.min(100, Math.round((done / total) * 100));
                return (
                  <div className="px-6 pt-4">
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#1dff00] via-[#00ffa3] to-[#1dff00] animate-[progress_6s_linear_infinite]" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-wide text-white/50">
                      <span>{pct}% Complete</span>
                      <span>{done} / {total} processed</span>
                    </div>
                  </div>
                );
              })()}
              {/* Job Status List */}
              <div className="max-h-[50vh] overflow-auto p-4 sm:p-6 grid grid-cols-1 gap-3">
                {autoApplyQueue.map((job, idx) => {
                  const st = autoApplyStatuses[job.id]?.status || 'pending';
                  return (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.06 }}
                      className={`relative rounded-xl border p-4 flex items-start gap-4 bg-gradient-to-br from-white/[0.03] to-transparent backdrop-blur-sm overflow-hidden ${st === 'success' ? 'border-emerald-500/40' : st === 'error' ? 'border-red-500/40' : st === 'applying' ? 'border-[#1dff00]/60' : 'border-white/10'}`}
                    >
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-xs font-semibold ${st === 'success' ? 'bg-emerald-500/15 text-emerald-300' : st === 'error' ? 'bg-red-500/15 text-red-300' : 'bg-[#1dff00]/10 text-[#1dff00]' }`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-medium truncate">{job.title}</span>
                          <span className="text-white/40 text-xs truncate">@ {job.company}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-white/50">
                          <span>{job.location}</span>
                          <span className="hidden sm:inline">•</span>
                          <span className="truncate">{job.type}</span>
                        </div>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                          <div className={`h-full transition-all duration-500 ${st === 'success' ? 'bg-emerald-400' : st === 'error' ? 'bg-red-400' : st === 'applying' ? 'bg-[#1dff00] animate-pulse' : 'bg-white/20 w-2/12'}`} style={{ width: st === 'success' ? '100%' : st === 'error' ? '100%' : st === 'applying' ? '65%' : '15%' }} />
                        </div>
                      </div>
                      <div className="w-8 flex items-center justify-center">
                        {st === 'pending' && <div className="h-3 w-3 rounded-full bg-white/30" />}
                        {st === 'applying' && <Loader2 className="w-4 h-4 animate-spin text-[#1dff00]" />}
                        {st === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                        {st === 'error' && <X className="w-5 h-5 text-red-400" />}
                      </div>
                      {st === 'applying' && (
                        <motion.div
                          className="absolute inset-0 pointer-events-none"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 0.6 }}
                          exit={{ opacity: 0 }}
                          style={{ background: 'radial-gradient(circle at 20% 20%, rgba(29,255,0,0.12), transparent 60%)' }}
                        />
                      )}
                    </motion.div>
                  );
                })}
              </div>
              {!autoApplying && (
                <div className="px-6 pb-5 flex items-center justify-end gap-3">
                  <button onClick={() => { setAutoApplyVisible(false); }} className="px-4 py-2 rounded-md bg-[#1dff00] text-black text-sm font-medium hover:bg-[#1dff00]/90">Close</button>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* Mobile Filters Drawer */}
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileFiltersOpen(false)} />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              className="absolute right-0 top-0 h-full w-full sm:w-[480px] bg-gradient-to-br from-[#0a0a0a] via-[#0b0b0b] to-[#050505] border-l border-white/10 shadow-2xl flex flex-col"
              role="dialog"
              aria-label="Mobile filters"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="text-white font-semibold">Filters</div>
                <button className="text-white/70 hover:text-white" onClick={() => setMobileFiltersOpen(false)} aria-label="Close filters">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 space-y-4 overflow-auto">
                {/* Work Type */}
                <div>
                  <div className="text-xs uppercase tracking-wide text-[#ffffff80] mb-2">Work type</div>
                  <div className="grid grid-cols-4 gap-2">
                    {["All", "Remote", "Hybrid", "On-site"].map((type) => (
                      <button
                        key={type}
                        onClick={() => setSelectedType(type)}
                        className={`px-2 py-1 rounded border text-xs transition ${
                          selectedType === type ? 'border-[#1dff00] text-black bg-[#1dff00]' : 'border-white/20 text-white/80 hover:border-[#1dff00]/40'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Quick presets */}
                <div>
                  <div className="text-xs uppercase tracking-wide text-[#ffffff80] mb-2">Quick presets</div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => togglePreset('remote')} className={`px-2 py-1 rounded border text-xs transition ${selectedPresets.has('remote') ? 'border-[#1dff00]/60 text-[#1dff00] bg-[#1dff0033]' : 'border-[#ffffff2a] text-[#ffffffb3] bg-[#ffffff10] hover:border-[#1dff00]/40 hover:bg-[#1dff00]/10'}`}>Remote</button>
                    <button type="button" onClick={() => togglePreset('gt100k')} className={`px-2 py-1 rounded border text-xs transition ${selectedPresets.has('gt100k') ? 'border-[#1dff00]/60 text-[#1dff00] bg-[#1dff0033]' : 'border-[#ffffff2a] text-[#ffffffb3] bg-[#ffffff10] hover:border-[#1dff00]/40 hover:bg-[#1dff00]/10'}`}>{`>$100k`}</button>
                    <button type="button" onClick={() => togglePreset('last7')} className={`px-2 py-1 rounded border text-xs transition ${selectedPresets.has('last7') ? 'border-[#1dff00]/60 text-[#1dff00] bg-[#1dff0033]' : 'border-[#ffffff2a] text-[#ffffffb3] bg-[#ffffff10] hover:border-[#1dff00]/40 hover:bg-[#1dff00]/10'}`}>Last 7 days</button>
                    {/* Saved only preset removed */}
                  </div>
                </div>
                {/* Salary & posted */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input placeholder="Min salary (e.g. 120000)" inputMode="numeric" value={minSalary} onChange={(e) => setMinSalary(e.target.value.replace(/[^0-9]/g, ''))} className="bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00]" />
                  <Input placeholder="Max salary (e.g. 200000)" inputMode="numeric" value={maxSalary} onChange={(e) => setMaxSalary(e.target.value.replace(/[^0-9]/g, ''))} className="bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00]" />
                  <div className="sm:col-span-2">
                    <SafeSelect fallbackValue="any" value={postedSince} onValueChange={(v) => setPostedSince(v === 'any' ? '' : v)}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Posted since" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any time</SelectItem>
                        <SelectItem value="3">Last 3 days</SelectItem>
                        <SelectItem value="7">Last 7 days</SelectItem>
                        <SelectItem value="14">Last 14 days</SelectItem>
                        <SelectItem value="30">Last 30 days</SelectItem>
                      </SelectContent>
                    </SafeSelect>
                  </div>
                </div>
                {/* Facets */}
                <div>
                  <div className="text-xs uppercase tracking-wide text-[#ffffff80] mb-2">Requirements</div>
                  <div className="flex flex-wrap gap-2">
                    {(facets.requirements || []).map((f) => {
                      const active = selectedReq.has(f.value);
                      return (
                        <button key={`mreq-${f.value}`} onClick={() => toggleReq(f.value)} className={`px-2 py-1 rounded border text-xs transition ${active ? 'border-[#1dff00]/60 text-[#1dff00] bg-[#1dff0033]' : 'border-[#ffffff2a] text-[#ffffffb3] bg-[#ffffff10] hover:border-[#1dff00]/40 hover:bg-[#1dff00]/10'}`}>{f.value}<span className="ml-1 text-[10px] opacity-70">{f.count}</span></button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-[#ffffff80] mb-2">Benefits</div>
                  <div className="flex flex-wrap gap-2">
                    {(facets.benefits || []).map((f) => {
                      const active = selectedBen.has(f.value);
                      return (
                        <button key={`mben-${f.value}`} onClick={() => toggleBen(f.value)} className={`px-2 py-1 rounded border text-xs transition ${active ? 'border-[#1dff00]/60 text-[#1dff00] bg-[#1dff0033]' : 'border-[#ffffff2a] text-[#ffffffb3] bg-[#ffffff10] hover:border-[#1dff00]/40 hover:bg-[#1dff00]/10'}`}>{f.value}<span className="ml-1 text-[10px] opacity-70">{f.count}</span></button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-white/10 flex items-center justify-between">
                <Button variant="ghost" onClick={clearAllFilters} className="text-[#1dff00] hover:bg-[#1dff00]/10">Clear all</Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => { resetSalaryTime(); }} className="border-[#ffffff33] text-white hover:bg-[#ffffff1a]">Reset salary/time</Button>
                  <Button onClick={() => { fetchFacets(); applyFacetFilters(Array.from(selectedReq), Array.from(selectedBen)); setMobileFiltersOpen(false); }} className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90">Apply</Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Saved Jobs Drawer removed */}
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
  coverLibrary = [],
  selectedCoverId = null,
  onSelectCoverId,
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
  coverLibrary?: Array<{ id: string; name: string; updatedAt: string; data: any }>;
  selectedCoverId?: string | null;
  onSelectCoverId?: (id: string | null) => void;
}) {
  if (!open) return null;
  let hasDraft = false;
  try { hasDraft = !!localStorage.getItem('jr.coverLetter.draft.v2'); } catch {}
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
            <div className="rounded-xl border border-[#1dff00]/20 bg-gradient-to-br from-white/[0.02] to-transparent p-4 shadow-[0_0_0_1px_rgba(29,255,0,0.05)]">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#1dff00]/10 text-[#1dff00]">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-white font-semibold leading-tight">Attach Cover Letter</div>
                    <div className="text-xs text-white/60">Optional cover page to elevate your application</div>
                  </div>
                  {hasDraft && (
                    <span className="ml-2 shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                      Draft found
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="/dashboard/cover-letter"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2.5 py-1.5 text-xs text-white/80 hover:border-[#1dff00]/40 hover:text-white transition"
                    title="Open the Cover Letter editor in a new tab"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </a>
                  <button
                    role="switch"
                    aria-checked={attachCoverLetter}
                    onClick={() => onToggleCoverLetter && onToggleCoverLetter(!attachCoverLetter)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#1dff00]/40 ${attachCoverLetter ? 'bg-[#1dff00]' : 'bg-white/20'}`}
                    aria-label="Toggle attach cover letter"
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-black transition ${attachCoverLetter ? 'translate-x-5' : 'translate-x-1'}`}
                    />
                  </button>
                </div>
              </div>

              {attachCoverLetter && (
                <div className="mt-4 grid gap-3">
                  {/* Templates */}
                  <div className="flex flex-wrap items-center gap-2">
                    {['Standard','Modern','Elegant'].map((tmpl) => {
                      const active = selectedCoverTemplate === tmpl;
                      return (
                        <button
                          key={tmpl}
                          onClick={() => onSelectCoverTemplate && onSelectCoverTemplate(tmpl)}
                          className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${active ? 'border-[#1dff00] bg-[#1dff00]/10 text-[#1dff00]' : 'border-white/15 text-white/80 hover:border-[#1dff00]/40 hover:text-white'}`}
                          title={`Use ${tmpl} template`}
                        >
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                          {tmpl}
                        </button>
                      );
                    })}
                  </div>

                  {/* Saved letters and preview */}
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs font-medium text-white/70">Choose from saved letters</div>
                      {!selectedCoverId && (
                        <span className="text-[10px] text-white/50">Using current draft</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${!selectedCoverId ? 'border-[#1dff00] bg-[#1dff00]/10 text-[#1dff00]' : 'border-white/15 text-white/80 hover:border-[#1dff00]/40 hover:text-white'}`}
                        onClick={() => onSelectCoverId && onSelectCoverId(null)}
                        title="Use current draft"
                      >
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                        Current Draft
                      </button>
                      {coverLibrary.map((e) => {
                        const active = selectedCoverId === e.id;
                        return (
                          <button
                            key={e.id}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${active ? 'border-[#1dff00] bg-[#1dff00]/10 text-[#1dff00]' : 'border-white/15 text-white/80 hover:border-[#1dff00]/40 hover:text-white'}`}
                            onClick={() => onSelectCoverId && onSelectCoverId(e.id)}
                            title={`Updated ${new Date(e.updatedAt).toLocaleString()}`}
                          >
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                            {e.name}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 max-h-48 overflow-auto rounded-lg border border-white/10 bg-white/[0.06] p-3 text-xs text-white/80 whitespace-pre-wrap">
                      {(() => {
                        try {
                          let parsed: any = null;
                          if (selectedCoverId) {
                            const entry = coverLibrary.find((x) => x.id === selectedCoverId);
                            if (entry) parsed = (entry as any).data;
                          } else {
                            const raw = localStorage.getItem('jr.coverLetter.draft.v2');
                            if (raw) parsed = JSON.parse(raw);
                          }
                          if (!parsed) return <span className="opacity-60">No draft found</span>;
                          const paras: string[] = Array.isArray(parsed?.paragraphs) ? parsed.paragraphs.filter((p: any) => typeof p === 'string' && p.trim()) : [];
                          const body: string = (paras.length ? paras.join("\n\n") : (parsed?.content || '')).trim();
                          const sal: string = (parsed?.salutation || '').trim();
                          const close: string = (parsed?.closing || '').trim();
                          const sig: string = (parsed?.signatureName || parsed?.senderName || '').trim();
                          const headerParts: string[] = [];
                          if (parsed?.senderName) headerParts.push(parsed.senderName);
                          if (parsed?.senderPhone) headerParts.push(parsed.senderPhone);
                          if (parsed?.senderEmail) headerParts.push(parsed.senderEmail);
                          if (parsed?.senderAddress) headerParts.push(parsed.senderAddress);
                          const dateLine = parsed?.date ? new Date(parsed.date).toLocaleDateString() : '';
                          const recipientLine = [parsed?.recipient, parsed?.recipientTitle].filter(Boolean).join(', ').trim();
                          const companyLine = (parsed?.company || '').trim();
                          const recipientAddr = (parsed?.recipientAddress || '').trim();
                          const subjectLine = (parsed?.subject || '').trim();
                          const lines: string[] = [];
                          if (headerParts.length) { lines.push(...headerParts, ''); }
                          if (dateLine) { lines.push(dateLine, ''); }
                          if (recipientLine || companyLine || recipientAddr) {
                            if (recipientLine) lines.push(recipientLine);
                            if (companyLine) lines.push(companyLine);
                            if (recipientAddr) lines.push(recipientAddr);
                            lines.push('');
                          }
                          if (subjectLine) { lines.push(`Subject: ${subjectLine}`, ''); }
                          if (sal) { lines.push(sal, ''); }
                          if (body) { lines.push(body, ''); }
                          if (close) { lines.push(close); }
                          if (sig) { lines.push(sig); }
                          return lines.join("\n").trim();
                        } catch {
                          return <span className="opacity-60">Unable to preview letter</span>;
                        }
                      })()}
                    </div>
                  </div>
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