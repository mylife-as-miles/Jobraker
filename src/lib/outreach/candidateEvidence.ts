import type { SupabaseClient } from "@supabase/supabase-js";
import type { CandidateEvidenceItem, CandidateEvidenceType } from "./types";

export interface CandidateEvidenceResult {
  status: "ready" | "needs_candidate_evidence";
  evidence: CandidateEvidenceItem[];
  rawText?: string;
  error?: string;
}

/**
 * Loads and decomposes trusted candidate evidence from verified resumes or profile records.
 * FAILS CLOSED: If no verifiable evidence exists, returns status: 'needs_candidate_evidence'
 * and an empty list. Never invents generic placeholders like "Experienced professional seeking new challenge".
 */
export async function loadStructuredCandidateEvidence(
  supabase: SupabaseClient,
  userId: string,
): Promise<CandidateEvidenceResult> {
  if (!userId) {
    return { status: "needs_candidate_evidence", evidence: [], error: "No user provided" };
  }

  try {
    // 1. Check favorite resume or latest updated resume
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
        .select("raw_text, parsed_data")
        .eq("resume_id", resumeId)
        .order("extracted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (parsed?.raw_text && parsed.raw_text.trim().length > 30) {
        const raw = parsed.raw_text.trim();
        const extracted = extractEvidenceItemsFromText(raw, "resume");
        if (extracted.length > 0) {
          return {
            status: "ready",
            evidence: extracted,
            rawText: raw,
          };
        }
      }
    }

    // 2. Query profile experiences and profile skills
    const [profileRes, expRes, skillsRes] = await Promise.all([
      supabase.from("profiles").select("job_title, bio, first_name, last_name").eq("id", userId).maybeSingle(),
      supabase
        .from("profile_experiences")
        .select("title, company, description, start_date, end_date")
        .eq("user_id", userId)
        .limit(5),
      supabase.from("profile_skills").select("name").eq("user_id", userId).limit(15),
    ]);

    const experiences = Array.isArray(expRes.data) ? expRes.data : [];
    const skills = Array.isArray(skillsRes.data) ? skillsRes.data : [];
    const profile = (profileRes.data || {}) as {
      job_title?: string;
      bio?: string;
      first_name?: string;
      last_name?: string;
    };

    const items: CandidateEvidenceItem[] = [];

    experiences.forEach((exp, idx) => {
      if (exp.title && exp.company) {
        items.push({
          id: `profile-exp-${idx + 1}`,
          type: "experience",
          text: `${exp.title} at ${exp.company}${exp.description ? `: ${exp.description}` : ""}`.trim(),
          source: "profile",
          confidence: 0.9,
        });
      }
    });

    if (skills.length > 0) {
      const skillNames = skills.map((s) => s.name).filter(Boolean);
      if (skillNames.length > 0) {
        items.push({
          id: `profile-skills-1`,
          type: "skill",
          text: `Core competencies: ${skillNames.join(", ")}`,
          source: "profile",
          confidence: 0.95,
        });
      }
    }

    if (profile.job_title) {
      items.push({
        id: `profile-title-1`,
        type: "experience",
        text: `Target role / specialization: ${profile.job_title}`,
        source: "profile",
        confidence: 0.85,
      });
    }

    if (items.length === 0) {
      return {
        status: "needs_candidate_evidence",
        evidence: [],
        error: "No resume or detailed profile experiences found. Please upload a resume or add experience.",
      };
    }

    const summaryText = items.map((it) => `- ${it.text}`).join("\n");
    return {
      status: "ready",
      evidence: items,
      rawText: summaryText,
    };
  } catch (error) {
    console.warn("Failed to load candidate evidence", error);
    return {
      status: "needs_candidate_evidence",
      evidence: [],
      error: "Error loading candidate evidence",
    };
  }
}

/**
 * Decomposes text into discrete, cited CandidateEvidenceItems
 */
export function extractEvidenceItemsFromText(
  text: string,
  source: "resume" | "profile",
): CandidateEvidenceItem[] {
  const items: CandidateEvidenceItem[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 15);

  let counter = 1;

  for (const line of lines) {
    // Bullet points with achievements or metrics
    const hasMetric = /\b(?:\d+%\s*|\$\d+|\d+\+?\s*(?:years|users|clients|engineers|projects|reduction|increase|latency|scaling|services))\b/i.test(line);
    const hasActionVerb = /^(?:led|built|architected|developed|designed|implemented|spearheaded|managed|improved|reduced|optimized|shipped|orchestrated)\b/i.test(
      line.replace(/^[-•*]\s*/, ""),
    );

    let type: CandidateEvidenceType = "experience";
    if (/lead|managed|spearheaded|director|head of/i.test(line)) {
      type = "achievement";
    } else if (/skills?:|languages?:|technologies?:|proficient in/i.test(line)) {
      type = "skill";
    } else if (/project:|built a|developed a/i.test(line)) {
      type = "project";
    }

    const cleanText = line.replace(/^[-•*]\s*/, "");
    if (cleanText.length > 20 && (hasMetric || hasActionVerb || type === "skill" || line.length > 40)) {
      items.push({
        id: `ev-${counter++}`,
        type,
        text: cleanText,
        source,
        confidence: hasMetric ? 0.95 : 0.85,
      });
    }

    if (items.length >= 8) break;
  }

  // If no specific bullets found, take top paragraphs
  if (items.length === 0 && lines.length > 0) {
    items.push({
      id: "ev-1",
      type: "experience",
      text: lines.slice(0, 3).join(" "),
      source,
      confidence: 0.8,
    });
  }

  return items;
}

/**
 * Grounding validator: ensures message doesn't claim wild fabricated achievements
 * that have zero reference in candidate evidence.
 */
export function validateMessageGrounding(
  messageBody: string,
  evidenceList: CandidateEvidenceItem[],
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  if (!evidenceList || evidenceList.length === 0) {
    violations.push("Message cannot be verified: zero candidate evidence supplied.");
    return { valid: false, violations };
  }

  // Look for fabricated metrics like "500%", "$10M" if not anywhere in evidence
  const metricMatches = messageBody.match(/(?:(?:\$|\b)\d+(?:\.\d+)?[kmbKMB]?|\b\d+%\s*|\b\d+\+?\s*(?:million|billion|users))\b/gi) || [];
  const allEvidenceText = evidenceList.map((e) => e.text).join(" ").toLowerCase();

  for (const metric of metricMatches) {
    const clean = metric.toLowerCase().trim();
    if (!allEvidenceText.includes(clean)) {
      // Metric not in evidence
      violations.push(`Unverified metric in generated message: "${metric}" not found in candidate evidence.`);
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
