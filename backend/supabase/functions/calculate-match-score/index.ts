import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  SubscriptionAccessError,
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";
import {
  enforceFeatureRateLimit,
  recordFeatureUsage,
} from "../_shared/feature-limits.ts";

interface JobData {
  title: string;
  description?: string;
  location?: string;
  remote_type?: string;
  raw_data?: any;
}

interface MatchContext {
  searchQuery: string;
  selectedLocation: string;
  profile?: {
    job_title?: string;
    location?: string;
    goals?: string[];
  } | null;
}

type MatchScoreBreakdown = {
  label: string;
  componentScore: number;
  contribution: number;
  weight: number;
  detail: string;
  matches?: string[];
};

const tokenize = (input?: string | null): string[] => {
  if (!input) return [];
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
};

const uniqueTokens = (tokens: string[]): string[] => Array.from(new Set(tokens));

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const buildTokenSet = (...segments: Array<string | undefined | null>): Set<string> => {
  const tokens = segments.flatMap((segment) => uniqueTokens(tokenize(segment)));
  return new Set(tokens);
};

const measureOverlap = (needles: Set<string>, haystack: Set<string>) => {
  if (!needles.size) return { score: 0, matches: [] as string[] };
  const matches: string[] = [];
  needles.forEach((token) => {
    if (haystack.has(token)) matches.push(token);
  });
  const score = clamp((matches.length / needles.size) * 100);
  return { score, matches };
};

const toPlainText = (html: string): string => {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, ' ');
};

const evaluateLocationFit = (job: JobData, context: MatchContext): { score: number; detail: string } => {
  const preferredLocationRaw = context.selectedLocation?.trim();
  const profileLocationRaw = context.profile?.location?.trim();
  const preference = preferredLocationRaw || profileLocationRaw || "";
  const preferenceTokens = buildTokenSet(preference);
  const jobLocationPieces: string[] = [];

  if (job.location) jobLocationPieces.push(job.location);
  if (job.remote_type) jobLocationPieces.push(job.remote_type);
  const rawData = job.raw_data as Record<string, any> | undefined;
  if (rawData?.location) jobLocationPieces.push(String(rawData.location));
  if (rawData?.scraped_data?.location) jobLocationPieces.push(String(rawData.scraped_data.location));
  
  const jobLocationString = jobLocationPieces.join(" ").toLowerCase();
  const wantsRemote = preference.toLowerCase().includes("remote");
  const jobIsRemote = /remote|anywhere/i.test(jobLocationString) || /remote/i.test(job.remote_type || "");

  if (!preferenceTokens.size) {
    if (jobIsRemote) return { score: 85, detail: "Remote-friendly role suits broad location preferences." };
    if (!jobLocationString) return { score: 60, detail: "Location unspecified; monitor posting for details." };
    return { score: 65, detail: "No location preference set; defaulting to neutral fit." };
  }

  if (jobIsRemote && wantsRemote) {
    return { score: 95, detail: "Remote flexibility aligns with your preference." };
  }

  const matchedTokens: string[] = [];
  preferenceTokens.forEach((token) => {
    if (token && jobLocationString.includes(token)) matchedTokens.push(token);
  });

  if (matchedTokens.length) {
    return { score: 100, detail: `Job location highlights ${matchedTokens.join(", ")}, matching your preference.` };
  }

  if (jobIsRemote) return { score: 80, detail: "Role is remote-friendly, partially offsetting location mismatch." };
  if (!jobLocationString) return { score: 45, detail: "Job location not specified; unable to confirm alignment." };

  return { score: 30, detail: "Location does not mention your preferred region." };
};

const computeJobMatchInsights = (job: JobData, context: MatchContext) => {
  const breakdown: MatchScoreBreakdown[] = [];
  const totalWeights = { role: 0.35, keywords: 0.3, goals: 0.2, location: 0.15 } as const;

  const profileTitleTokens = buildTokenSet(context.profile?.job_title, context.profile?.goals?.join(" ") || "");
  const searchTokens = buildTokenSet(context.searchQuery);
  const roleTargetTokens = new Set<string>([...profileTitleTokens, ...searchTokens]);
  const jobTitleTokens = buildTokenSet(job.title);
  
  const roleOverlap = measureOverlap(roleTargetTokens, jobTitleTokens);
  const roleScore = roleTargetTokens.size ? roleOverlap.score : clamp(jobTitleTokens.size ? 55 : 40);
  breakdown.push({
    label: "Role focus",
    componentScore: roleScore,
    contribution: roleScore * totalWeights.role,
    weight: totalWeights.role,
    detail: roleTargetTokens.size
      ? roleOverlap.matches.length
        ? `Matches ${roleOverlap.matches.length}/${roleTargetTokens.size} target role keywords.`
        : "Job title only loosely overlaps with your role focus."
      : "No role keywords provided; using neutral baseline.",
    matches: roleOverlap.matches,
  });

  const jobDescriptionText = [
    job.description,
    (job.raw_data as any)?.scraped_data?.description,
    toPlainText(job.description || ""),
  ].filter(Boolean).join(" ");

  const jobTagTokens = buildTokenSet(
    Array.isArray((job.raw_data as any)?.scraped_data?.tags) ? ((job.raw_data as any)?.scraped_data?.tags as string[]).join(" ") : undefined,
    Array.isArray((job.raw_data as any)?.scraped_data?.skills) ? ((job.raw_data as any)?.scraped_data?.skills as string[]).join(" ") : undefined,
  );
  
  const jobTextTokens = new Set<string>([...buildTokenSet(jobDescriptionText), ...jobTagTokens, ...jobTitleTokens]);
  const keywordOverlap = measureOverlap(searchTokens, jobTextTokens);
  const keywordScore = searchTokens.size ? keywordOverlap.score : clamp(jobTextTokens.size ? 60 : 40);
  
  breakdown.push({
    label: "Keyword match",
    componentScore: keywordScore,
    contribution: keywordScore * totalWeights.keywords,
    weight: totalWeights.keywords,
    detail: searchTokens.size
      ? keywordOverlap.matches.length
        ? `Job content covers ${keywordOverlap.matches.join(", ")}.`
        : "Posting lacks your search keywords."
      : "No search keywords supplied; treated as neutral.",
    matches: keywordOverlap.matches,
  });

  const goalTokens = buildTokenSet(context.profile?.goals?.join(" ") || "");
  const goalOverlap = measureOverlap(goalTokens, jobTextTokens);
  const goalScore = goalTokens.size ? goalOverlap.score : clamp(jobTextTokens.size ? 55 : 40);
  
  breakdown.push({
    label: "Profile goals",
    componentScore: goalScore,
    contribution: goalScore * totalWeights.goals,
    weight: totalWeights.goals,
    detail: goalTokens.size
      ? goalOverlap.matches.length
        ? `Mentions your goals: ${goalOverlap.matches.join(", ")}.`
        : "Job description does not reference your stated goals."
      : "Add goals to your profile for deeper matching.",
    matches: goalOverlap.matches,
  });

  const locationFit = evaluateLocationFit(job, context);
  breakdown.push({
    label: "Location alignment",
    componentScore: locationFit.score,
    contribution: locationFit.score * totalWeights.location,
    weight: totalWeights.location,
    detail: locationFit.detail,
  });

  const totalScore = clamp(Math.round(breakdown.reduce((acc, item) => acc + item.contribution, 0)));
  const positiveHighlights = breakdown.filter((item) => item.componentScore >= 70).map((item) => item.label.toLowerCase());
  const opportunityAreas = breakdown.filter((item) => item.componentScore < 50).map((item) => item.label.toLowerCase());

  let summary = "";
  if (positiveHighlights.length) summary = `Strong alignment on ${positiveHighlights.join(", ")}.`;
  if (opportunityAreas.length) summary = summary ? `${summary} Needs attention on ${opportunityAreas.join(", ")}.` : `Needs attention on ${opportunityAreas.join(", ")}.`;
  if (!summary) summary = "Limited signals detected — consider refining your search or profile.";

  return { score: totalScore, breakdown, summary };
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user, serviceClient, subscriptionTier } = await requireSubscriptionTier(req, "Basics", "AI match score");
    await enforceFeatureRateLimit({
      userId: user.id,
      featureKey: "calculate_match_score",
      serviceClient,
      subscriptionTier,
    });
    const { jobs, context } = await req.json();

    if (!Array.isArray(jobs) || !context) {
      return new Response(JSON.stringify({ error: "Missing required fields: jobs array and context object required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECURITY FIX: Prevent Memory Exhaustion (DoS)
    if (jobs.length > 50) {
      return new Response(JSON.stringify({ error: "Payload too large. Maximum 50 jobs allowed per request." }), { 
        status: 413, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // SECURITY FIX: Prevent Match Score Poisoning via Keyword Stuffing
    if (context.searchQuery) context.searchQuery = context.searchQuery.substring(0, 500);
    if (context.selectedLocation) context.selectedLocation = context.selectedLocation.substring(0, 500);
    if (context.profile) {
      if (context.profile.job_title) context.profile.job_title = context.profile.job_title.substring(0, 500);
      if (context.profile.location) context.profile.location = context.profile.location.substring(0, 500);
      if (Array.isArray(context.profile.goals)) {
        context.profile.goals = context.profile.goals.filter(Boolean).map((g: string) => String(g).substring(0, 200)).slice(0, 20);
      }
    }

    // Process all jobs in memory (fast)
    const results = jobs.map((job: JobData) => {
      try {
        const insights = computeJobMatchInsights(job, context);
        return { id: (job as any)?.id, ...insights };
      } catch (err) {
        console.error(`Failed to process match score for job`, err);
        return { id: (job as any)?.id, score: 0, breakdown: [], summary: "Error calculating score" };
      }
    });

    await recordFeatureUsage({
      userId: user.id,
      featureKey: "calculate_match_score",
      serviceClient,
      subscriptionTier,
      metadata: {
        jobs_count: jobs.length,
      },
    });

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    console.error("Match Score Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
