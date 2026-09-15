import type { SupabaseClient } from "@supabase/supabase-js";

import { loadStructuredCandidateEvidence } from "@/lib/outreach/candidateEvidence";
import type { CandidateEvidenceItem } from "@/lib/outreach/types";

export interface TargetOutreachJob {
  id: string;
  jobId: string | null;
  title: string;
  company: string;
  location?: string;
  logo?: string;
  matchScore?: number;
  applyUrl?: string;
  source: "searched" | "applied" | "instant";
  description?: string;
  createdAt?: string;
}

export type OutreachTone = "casual" | "bold" | "punchy";

export interface RecruiterContactInfo {
  fullName: string;
  title: string;
  email: string;
  source: string;
  confidence: "high" | "medium" | "low";
  tier: 1 | 2 | 3 | 4;
  tierLabel: string;
  linkedinUrl?: string;
  status: "found" | "no_email" | "failed";
}

export interface CraftedOutreachPitch {
  subject: string;
  body: string;
  tone: OutreachTone;
  previewHook: string;
  customized?: boolean;
  needsRegeneration?: boolean;
  evidenceItems?: CandidateEvidenceItem[];
}

export interface DeliveryResult {
  status: "idle" | "drafted" | "sent" | "skipped" | "failed";
  draftId?: string;
  messageId?: string;
  error?: string;
  deliveredAt?: string;
}

export interface OutreachJobState {
  job: TargetOutreachJob;
  selected: boolean;
  contact?: RecruiterContactInfo;
  contactLoading?: boolean;
  contactError?: string;
  pitch?: CraftedOutreachPitch;
  pitchLoading?: boolean;
  pitchError?: string;
  delivery?: DeliveryResult;
  deliveryLoading?: boolean;
}

const TONE_INSTRUCTIONS: Record<OutreachTone, string> = {
  casual:
    "Tone: Startup Casual & Genuine. Conversational, human, authentic, no corporate fluff, friendly CTA.",
  bold:
    "Tone: Executive Bold & High-Agency. Direct value proposition, impressive metric highlights, authoritative yet respectful.",
  punchy:
    "Tone: Short & Punchy. Under 80 words, 3 quick bullet points, zero fluff, immediate curiosity hook.",
};

/**
 * Detects whether a job entry from the database is an invalid placeholder or article listing.
 */
export function isInvalidOutreachJob(company?: string, title?: string): boolean {
  const normCompany = (company || "").toLowerCase().trim();
  const normTitle = (title || "").toLowerCase().trim();
  if (!normCompany || normCompany.length < 2) return true;

  const invalidCompanyNames = new Set([
    "remote",
    "hybrid",
    "on-site",
    "onsite",
    "anywhere",
    "worldwide",
    "global",
    "united states",
    "unknown",
    "n/a",
    "na",
    "none",
    "confidential",
    "various",
    "multiple",
    "various companies",
    "multiple companies",
  ]);
  if (invalidCompanyNames.has(normCompany)) return true;

  // Catch scraper counts, listicles, or aggregator text in company name
  if (/^\d+\+?\s*(?:hand-curated|curated|positions|jobs|openings|leads|companies)/i.test(normCompany)) return true;
  if (/(?:curated|hand-curated)\s+(?:positions|jobs|openings)/i.test(normCompany)) return true;
  if (/\b(?:all\s+verified\s+remote\s+jobs|verified\s+jobs)\b/i.test(normCompany)) return true;

  if (/^\d+\s+(?:virtual|best|top|remote|cool|fast-growing)\s+companies/i.test(normTitle)) return true;
  if (/(?:companies|employers)\s+hiring\s+in/i.test(normTitle)) return true;
  if (/^how\s+to\b|^guide\s+to\b|^top\s+\d+/i.test(normTitle)) return true;
  if (/(?:all\s+verified\s+remote\s+jobs|hand-curated\s+positions)/i.test(normTitle)) return true;

  return false;
}

/**
 * Loads candidate evidence from resumes or profile data.
 * Fails closed without fabricating false text.
 */
export async function loadCandidateEvidence(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const result = await loadStructuredCandidateEvidence(supabase, userId);
  if (result.status === "needs_candidate_evidence" || !result.rawText) {
    return "";
  }
  return result.rawText;
}

/**
 * Automatically fetches candidate's top uncontacted jobs from searched and tracked jobs.
 * Enforces exact job identity: multiple opportunities at the same company remain distinct.
 * Never fabricates match percentages (leaves undefined if unrated).
 */
export async function fetchTopUncontactedJobs(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 5,
): Promise<TargetOutreachJob[]> {
  try {
    // 1. Fetch tracked applications to identify already-contacted jobs
    const { data: applications } = await supabase
      .from("applications")
      .select("id, job_id, company, job_title, status, draft_status, match_score")
      .eq("user_id", userId);

    const contactedJobIdSet = new Set<string>();

    (applications || []).forEach((app) => {
      if (app.status === "Applied" || app.status === "Interviewing" || app.draft_status === "draft") {
        if (app.job_id) contactedJobIdSet.add(app.job_id);
      }
    });

    // 2. Query searched jobs from 'jobs' table
    const { data: jobs, error } = await supabase
      .from("jobs")
      .select(
        "id, title, company, location, apply_url, company_logo, lead_quality_score, description, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      console.warn("Error fetching searched jobs for outreach preset", error);
    }

    const availableJobs: TargetOutreachJob[] = [];
    const seenJobKeys = new Set<string>();

    for (const job of jobs || []) {
      const jobKey = job.id || (job.apply_url ? job.apply_url.toLowerCase().trim() : `${(job.company || "").toLowerCase()}-${(job.title || "").toLowerCase()}`);
      if (!jobKey || seenJobKeys.has(jobKey)) continue;
      if (contactedJobIdSet.has(job.id)) continue;
      if (isInvalidOutreachJob(job.company, job.title)) continue;

      seenJobKeys.add(jobKey);

      // Only assign matchScore if an authentic evaluation exists; do not fabricate 88%
      const authenticScore = typeof job.lead_quality_score === "number" && job.lead_quality_score > 0
        ? Math.round(job.lead_quality_score)
        : undefined;

      availableJobs.push({
        id: job.id,
        jobId: job.id,
        title: job.title || "Target Position",
        company: job.company || "Target Company",
        location: job.location || "Remote / Hybrid",
        logo: job.company_logo || undefined,
        matchScore: authenticScore,
        applyUrl: job.apply_url || undefined,
        source: "searched",
        description: job.description || undefined,
        createdAt: job.created_at,
      });

      if (availableJobs.length >= limit) break;
    }

    // 3. If fewer than limit, also include saved/wishlist applications that haven't been contacted yet
    if (availableJobs.length < limit && applications && applications.length > 0) {
      for (const app of applications) {
        const appKey = app.id || (app.job_id ? app.job_id : `${(app.company || "").toLowerCase()}-${(app.job_title || "").toLowerCase()}`);
        if (!appKey || seenJobKeys.has(appKey)) continue;
        if (app.status !== "Wishlist" && app.status !== "Saved") continue;

        seenJobKeys.add(appKey);

        const authenticAppScore = typeof (app as any).match_score === "number" && (app as any).match_score > 0
          ? Math.round((app as any).match_score)
          : undefined;

        availableJobs.push({
          id: app.id,
          jobId: app.job_id || null,
          title: app.job_title || "Target Position",
          company: app.company,
          location: "Remote",
          matchScore: authenticAppScore,
          source: "applied",
        });

        if (availableJobs.length >= limit) break;
      }
    }

    return availableJobs;
  } catch (err) {
    console.error("fetchTopUncontactedJobs failed", err);
    return [];
  }
}

/**
 * 4-Tier Recruiter Scout with safety fallbacks (never crashes the batch).
 */
export async function scoutRecruiterForJob(
  supabase: SupabaseClient,
  job: TargetOutreachJob,
): Promise<RecruiterContactInfo> {
  try {
    const { data: scout, error } = await supabase.functions.invoke("scout-company", {
      body: {
        companyName: job.company,
        jobId: job.jobId || undefined,
        jobTitle: job.title,
        jobDescription: job.description || undefined,
        applyUrl: job.applyUrl || undefined,
        limit: 5,
      },
    });

    if (error || !scout) {
      console.warn(`Scout company returned error for ${job.company}:`, error);
      return createTier4FallbackContact(job);
    }

    const contacts = Array.isArray(scout.recruiterContacts) ? scout.recruiterContacts : [];

    // Tier 1: Verified Recruiter / Sourcer
    const tier1 = contacts.find(
      (c: any) =>
        c.safeToContact &&
        c.workEmail &&
        ["source_verified", "provider_verified"].includes(c.emailStatus) &&
        (c.roleKind === "recruiter" || /recruiter|talent|sourcer/i.test(c.title || "")),
    );

    if (tier1) {
      return {
        fullName: tier1.fullName || "Talent Lead",
        title: tier1.title || "Talent Acquisition Specialist",
        email: tier1.workEmail,
        source: tier1.emailSourceUrl || tier1.linkedinUrl || "Verified Company Directory",
        confidence: Number(tier1.emailConfidence || 0) >= 0.8 ? "high" : "medium",
        tier: 1,
        tierLabel: "Verified Talent Partner",
        linkedinUrl: tier1.linkedinUrl,
        status: "found",
      };
    }

    // Tier 2: Hiring Manager / Department Director / Team Lead
    const tier2 = contacts.find(
      (c: any) =>
        c.safeToContact &&
        c.workEmail &&
        ["source_verified", "provider_verified", "domain_valid"].includes(c.emailStatus) &&
        (c.roleKind === "hiring_manager" ||
          c.roleKind === "director" ||
          /head|manager|lead|director|vp/i.test(c.title || "")),
    );

    if (tier2) {
      return {
        fullName: tier2.fullName || "Hiring Manager",
        title: tier2.title || "Hiring Team Lead",
        email: tier2.workEmail,
        source: tier2.emailSourceUrl || tier2.linkedinUrl || "Company Leadership Directory",
        confidence: "medium",
        tier: 2,
        tierLabel: "Hiring Manager / Team Lead",
        linkedinUrl: tier2.linkedinUrl,
        status: "found",
      };
    }

    // Tier 3: Verified Recruitment Inbox (e.g. careers@company.com)
    if (scout.contactEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(scout.contactEmail)) {
      return {
        fullName: `${job.company} Talent Team`,
        title: "Recruiting Operations",
        email: scout.contactEmail,
        source: "Official Company Careers Portal",
        confidence: scout.confidence === "high" ? "high" : "medium",
        tier: 3,
        tierLabel: "Verified Recruitment Inbox",
        status: "found",
      };
    }

    // Tier 4: Graceful fallback
    return createTier4FallbackContact(job);
  } catch (error) {
    console.warn(`Scout exception for ${job.company}:`, error);
    return createTier4FallbackContact(job);
  }
}

function createTier4FallbackContact(job: TargetOutreachJob): RecruiterContactInfo {
  const safeCompany = encodeURIComponent(job.company);
  const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${safeCompany}%20recruiter`;
  return {
    fullName: `${job.company} Hiring Team`,
    title: "Recruitment Team",
    email: "",
    source: "LinkedIn Search Fallback",
    confidence: "low",
    tier: 4,
    tierLabel: "LinkedIn Connect Ready (No Public Email)",
    linkedinUrl: searchUrl,
    status: "no_email",
  };
}

/**
 * Crafts personalized outreach pitch for a job & contact.
 */
export async function craftOutreachPitch(
  supabase: SupabaseClient,
  job: TargetOutreachJob,
  contact: RecruiterContactInfo,
  resumeEvidence: string,
  tone: OutreachTone = "casual",
): Promise<CraftedOutreachPitch> {
  const toneInstruction = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.casual;
  const recipientGreeting =
    contact.fullName && contact.fullName !== `${job.company} Hiring Team`
      ? `Address the message to ${contact.fullName}.`
      : `Address the message to the ${job.company} Hiring Team.`;

  try {
    const { data: outreach, error } = await supabase.functions.invoke("generate-outreach", {
      body: {
        companyName: job.company,
        role: job.title,
        resumeText: resumeEvidence,
        jobDescription: job.description || undefined,
        instructions: `${toneInstruction}\n${recipientGreeting}\nKeep it concise and punchy. Make the subject line specific to the role and candidate's strengths.`,
      },
    });

    if (error || !outreach || !outreach.body) {
      console.warn("generate-outreach edge error, falling back to local generator", error);
      return generateLocalFallbackPitch(job, contact, tone);
    }

    const subject = outreach.subject || `Application interest: ${job.title} - ${job.company}`;
    const body = outreach.body;
    const previewHook = extractPreviewHook(body);

    return {
      subject,
      body,
      tone,
      previewHook,
      customized: false,
    };
  } catch (err) {
    console.warn("Exception crafting outreach pitch, using local template", err);
    return generateLocalFallbackPitch(job, contact, tone);
  }
}

function extractPreviewHook(body: string): string {
  const lines = body.split("\n").filter((l) => l.trim().length > 0);
  const hookLine = lines.find(
    (l) =>
      !/^hi\b/i.test(l) &&
      !/^dear\b/i.test(l) &&
      !/^hello\b/i.test(l) &&
      l.length > 20,
  );
  if (!hookLine) return body.slice(0, 100) + "...";
  return hookLine.length > 110 ? hookLine.slice(0, 105) + "..." : hookLine;
}

export function generateLocalFallbackPitch(
  job: TargetOutreachJob,
  contact: RecruiterContactInfo,
  tone: OutreachTone,
): CraftedOutreachPitch {
  const recipientName =
    contact.fullName && contact.fullName !== `${job.company} Hiring Team`
      ? contact.fullName.split(" ")[0]
      : `${job.company} Team`;

  let subject = `Excited about the ${job.title} role at ${job.company}`;
  let body = "";

  if (tone === "punchy") {
    subject = `${job.title} @ ${job.company}`;
    body = `Hi ${recipientName},\n\nI noticed ${job.company}'s opening for ${job.title}. Given my relevant experience and strong interest in your team, I would welcome the opportunity to connect.\n\nWould you be open to a brief conversation this week?\n\nBest,\nJobRaker Candidate`;
  } else if (tone === "bold") {
    subject = `Driving Impact for ${job.title} - ${job.company}`;
    body = `Hi ${recipientName},\n\nI saw the ${job.title} position at ${job.company}. My background aligns directly with the core requirements of this role, and I would love to connect to discuss team priorities.\n\nBest regards,\nJobRaker Candidate`;
  } else {
    subject = `Quick note regarding ${job.title} at ${job.company}`;
    body = `Hi ${recipientName},\n\nI came across the ${job.title} role at ${job.company} and wanted to reach out directly. I would love to learn more about the team's upcoming priorities and share relevant background.\n\nBest,\nJobRaker Candidate`;
  }

  return {
    subject,
    body,
    tone,
    previewHook: extractPreviewHook(body),
    customized: false,
    needsRegeneration: true,
  };
}

/**
 * Dispatches Gmail delivery (Draft or Direct Send) and syncs applications tracker.
 */
export async function deliverOutreachEmail(
  supabase: SupabaseClient,
  userId: string,
  job: TargetOutreachJob,
  contact: RecruiterContactInfo,
  pitch: CraftedOutreachPitch,
  mode: "draft" | "send" = "draft",
): Promise<DeliveryResult> {
  if (!contact.email) {
    return {
      status: "skipped",
      error: "No email address available. Copied LinkedIn outreach link instead.",
    };
  }

  try {
    const { data: draftResult, error: draftError } = await supabase.functions.invoke("cold-mail", {
      body: {
        action: "create_gmail_draft",
        jobId: job.jobId || undefined,
        companyName: job.company,
        jobTitle: job.title,
        recipientName: contact.fullName,
        recipientTitle: contact.title,
        recipientSource: contact.source,
        recipientConfidence: contact.confidence,
        to: contact.email,
        subject: pitch.subject,
        body: pitch.body,
      },
    });

    if (draftError || !draftResult || draftResult.success === false || !draftResult.draftId) {
      const errMsg =
        draftResult?.error || draftError?.message || "Failed to create draft in Gmail workspace.";
      return {
        status: "failed",
        error: errMsg,
      };
    }

    const draftId = draftResult.draftId;
    let result = draftResult;
    if (mode === "send") {
      const { data: sendResult, error: sendError } = await supabase.functions.invoke(
        "cold-mail",
        {
          body: {
            action: "send_gmail_draft",
            draftId,
          },
        },
      );
      if (sendError || !sendResult || sendResult.success === false || !sendResult.messageId) {
        return {
          status: "failed",
          draftId,
          error:
            sendResult?.error || sendError?.message ||
            "The Gmail draft was created but delivery could not be confirmed.",
        };
      }
      result = sendResult;
    }

    const nowIso = new Date().toISOString();

    // Sync into applications tracker
    try {
      if (job.source === "applied" && job.id) {
        await supabase
          .from("applications")
          .update({
            status: mode === "send" ? "Applied" : "Wishlist",
            draft_status: mode === "send" ? "sent" : "draft",
            notes: `Outreach ${mode === "send" ? "sent" : "drafted"} to ${contact.fullName} (${contact.email}) via 1-Click Preset.`,
            updated_at: nowIso,
          })
          .eq("id", job.id)
          .eq("user_id", userId);
      } else {
        // Upsert into applications table
        await supabase.from("applications").upsert(
          {
            user_id: userId,
            job_id: job.jobId || null,
            job_title: job.title,
            company: job.company,
            location: job.location || "Remote",
            status: mode === "send" ? "Applied" : "Wishlist",
            draft_status: mode === "send" ? "sent" : "draft",
            applied_date: mode === "send" ? nowIso : null,
            notes: `Outreach ${mode === "send" ? "sent" : "drafted"} to ${contact.fullName} (${contact.email}) via 1-Click Preset.`,
            created_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: "user_id, company, job_title" as any },
        );
      }
    } catch (syncErr) {
      console.warn("Application tracker sync error (non-fatal)", syncErr);
    }

    return {
      status: mode === "send" ? "sent" : "drafted",
      draftId,
      messageId: result.messageId,
      deliveredAt: nowIso,
    };
  } catch (err: any) {
    console.error("deliverOutreachEmail exception", err);
    return {
      status: "failed",
      error: err?.message || "Unexpected delivery error.",
    };
  }
}
