import type { SupabaseClient } from "@supabase/supabase-js";

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
 * Loads candidate evidence from resumes or profile data.
 */
export async function loadCandidateEvidence(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  try {
    const { data: favoriteResume } = await supabase
      .from("resumes")
      .select("id")
      .eq("user_id", userId)
      .eq("is_favorite", true)
      .maybeSingle();

    let resumeId = favoriteResume?.id;
    if (!resumeId) {
      const { data: latestResume } = await supabase
        .from("resumes")
        .select("id")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      resumeId = latestResume?.id;
    }

    if (resumeId) {
      const { data: parsed } = await supabase
        .from("parsed_resumes")
        .select("raw_text")
        .eq("resume_id", resumeId)
        .order("extracted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (parsed?.raw_text && parsed.raw_text.trim().length > 20) {
        return parsed.raw_text.trim();
      }
    }

    // Fallback to profile
    const [profileRes, expRes, skillsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("profile_experiences")
        .select("title, company, description")
        .eq("user_id", userId)
        .limit(3),
      supabase.from("profile_skills").select("name").eq("user_id", userId).limit(8),
    ]);

    const profile = profileRes.data || {};
    const experiences = Array.isArray(expRes.data) ? expRes.data : [];
    const skills = Array.isArray(skillsRes.data) ? skillsRes.data : [];

    const lines = [
      `Name: ${profile.first_name || ""} ${profile.last_name || ""}`.trim(),
      profile.job_title ? `Title: ${profile.job_title}` : "",
      experiences.length > 0
        ? "Key Experience:\n" +
          experiences
            .map((e) => `- ${e.title} at ${e.company}: ${e.description || ""}`)
            .join("\n")
        : "",
      skills.length > 0 ? `Skills: ${skills.map((s) => s.name).join(", ")}` : "",
    ].filter(Boolean);

    return lines.join("\n") || "Experienced professional seeking new challenge.";
  } catch (error) {
    console.warn("Failed to load candidate evidence, using standard fallback", error);
    return "Experienced professional seeking new challenge.";
  }
}

/**
 * Automatically fetches candidate's top uncontacted jobs from searched and tracked jobs.
 */
export async function fetchTopUncontactedJobs(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 5,
): Promise<TargetOutreachJob[]> {
  try {
    // 1. Fetch tracked applications to identify already-contacted companies/jobs
    const { data: applications } = await supabase
      .from("applications")
      .select("id, job_id, company, job_title, status, draft_status")
      .eq("user_id", userId);

    const contactedCompanySet = new Set<string>();
    const contactedJobIdSet = new Set<string>();

    (applications || []).forEach((app) => {
      if (app.status === "Applied" || app.status === "Interviewing" || app.draft_status === "draft") {
        if (app.company) contactedCompanySet.add(app.company.toLowerCase().trim());
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
    const seenCompanies = new Set<string>();

    for (const job of jobs || []) {
      const companyNorm = (job.company || "").toLowerCase().trim();
      if (!companyNorm || seenCompanies.has(companyNorm)) continue;
      if (contactedCompanySet.has(companyNorm) || contactedJobIdSet.has(job.id)) continue;

      seenCompanies.add(companyNorm);
      availableJobs.push({
        id: job.id,
        jobId: job.id,
        title: job.title || "Target Position",
        company: job.company || "Target Company",
        location: job.location || "Remote / Hybrid",
        logo: job.company_logo || undefined,
        matchScore: job.lead_quality_score ? Math.min(99, Math.max(65, job.lead_quality_score)) : 88,
        applyUrl: job.apply_url || undefined,
        source: "searched",
        description: job.description || undefined,
        createdAt: job.created_at,
      });

      if (availableJobs.length >= limit) break;
    }

    // 3. If fewer than limit, also include saved/pending applications that haven't been contacted yet
    if (availableJobs.length < limit && applications && applications.length > 0) {
      for (const app of applications) {
        const companyNorm = (app.company || "").toLowerCase().trim();
        if (!companyNorm || seenCompanies.has(companyNorm)) continue;
        if (app.status !== "Wishlist" && app.status !== "Saved") continue;

        seenCompanies.add(companyNorm);
        availableJobs.push({
          id: app.id,
          jobId: app.job_id || null,
          title: app.job_title || "Target Position",
          company: app.company,
          location: "Remote",
          matchScore: 85,
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

function generateLocalFallbackPitch(
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
    body = `Hi ${recipientName},\n\nI noticed ${job.company}'s opening for ${job.title}. With a strong background executing high-impact technical initiatives, I'm confident I can make an immediate contribution to your team.\n\nWould you be open to a brief 10-minute chat this week?\n\nBest,\nJobRaker Candidate`;
  } else if (tone === "bold") {
    subject = `Driving Impact for ${job.title} - ${job.company}`;
    body = `Hi ${recipientName},\n\nI've been following ${job.company}'s trajectory and noticed the ${job.title} position. My experience aligns directly with solving the complex scaling and delivery challenges your team faces.\n\nI would love to connect and share high-leverage ideas on how I can help hit your quarterly goals.\n\nBest regards,\nJobRaker Candidate`;
  } else {
    subject = `Quick note regarding ${job.title} at ${job.company}`;
    body = `Hi ${recipientName},\n\nHope your week is going well! I came across the ${job.title} role at ${job.company} and was genuinely excited by what you're building.\n\nGiven my background in high-velocity execution and collaborative problem-solving, I'd love to learn more about the team's upcoming priorities.\n\nHappy to share more context if you're open to connecting!\n\nBest,\nJobRaker Candidate`;
  }

  return {
    subject,
    body,
    tone,
    previewHook: extractPreviewHook(body),
    customized: false,
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
