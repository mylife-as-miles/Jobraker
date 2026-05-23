import { supabase } from "../../lib/supabaseClient";
import { clampScore, reason } from "./textUtils";
import type { MissingSignal, ProfileEvidenceMatch, RankingReason } from "./types";

export type SemanticMatchResult = {
  semanticFitScore: number;
  matchedEvidence: ProfileEvidenceMatch[];
  missingEvidence: MissingSignal[];
  reasons: RankingReason[];
};

/**
 * Computes semantic matching using pgvector distance searches.
 * Falls back to heuristic matching if vector chunks are missing or the RPC is unavailable.
 */
export async function computeSemanticMatch(
  jobId: string,
  userId: string,
  options?: {
    jobTitle?: string;
    jobDescription?: string;
    candidateSkills?: string[];
    useVectorSearch?: boolean;
  }
): Promise<SemanticMatchResult> {
  const shouldUseVectorSearch = options?.useVectorSearch !== false && Boolean(jobId && userId);

  if (!shouldUseVectorSearch) {
    return runFallbackMatch(options);
  }

  try {
    // Query database RPC for matches
    const { data: dbMatches, error } = await supabase.rpc("match_job_to_profile", {
      p_job_id: jobId,
      p_user_id: userId,
      p_threshold: 0.65,
      p_limit: 4,
    });

    if (error) {
      console.warn("match_job_to_profile RPC failed, falling back:", error.message);
      return runFallbackMatch(options);
    }

    if (!dbMatches || dbMatches.length === 0) {
      // Vector chunks might not exist for this job/user yet
      return runFallbackMatch(options);
    }

    const matchedEvidence: ProfileEvidenceMatch[] = [];
    const reasons: RankingReason[] = [];
    let similaritySum = 0;

    // Compile matches
    dbMatches.forEach((match: any, index: number) => {
      similaritySum += match.similarity;
      const confidence = Math.round(match.similarity * 100);

      matchedEvidence.push({
        id: `semantic-evidence-${index}`,
        requirement: match.job_chunk_text,
        evidenceText: match.evidence_chunk_text,
        evidenceSource: "inferred",
        confidence,
      });

      if (index === 0) {
        reasons.push(
          reason(
            "semantic-strong-match",
            "semantic",
            match.similarity >= 0.8 ? "positive" : "neutral",
            "Semantic overlap found",
            `Your experience with "${match.evidence_chunk_text.slice(0, 40)}..." closely matches the job requirement "${match.job_chunk_text.slice(0, 40)}..." (${confidence}% confidence).`
          )
        );
      }
    });

    const averageSimilarity = similaritySum / dbMatches.length;
    // Map similarity (e.g. 0.6 - 1.0) to standard score (e.g. 40 - 100)
    const semanticFitScore = clampScore((averageSimilarity - 0.5) * 200);

    return {
      semanticFitScore,
      matchedEvidence,
      missingEvidence: [],
      reasons,
    };
  } catch (err: any) {
    console.error("Error in computeSemanticMatch:", err);
    return runFallbackMatch(options);
  }
}

/**
 * Fallback keyword-overlap match when vector embeddings are missing or flag is off.
 */
function runFallbackMatch(options?: {
  jobTitle?: string;
  jobDescription?: string;
  candidateSkills?: string[];
}): SemanticMatchResult {
  const skills = options?.candidateSkills || [];
  const desc = (options?.jobDescription || "").toLowerCase();

  const found = skills.filter((skill) => desc.includes(skill.toLowerCase()));
  const score = skills.length > 0 ? clampScore((found.length / skills.length) * 100) : 50;

  return {
    semanticFitScore: score,
    matchedEvidence: found.map((skill, index) => ({
      id: `fallback-ev-${index}`,
      skill,
      requirement: skill,
      evidenceText: `Heuristic match: skill '${skill}' mentioned in job posting.`,
      evidenceSource: "profile_skill",
      confidence: 70,
    })),
    missingEvidence: [],
    reasons: [
      reason(
        "semantic-fallback-active",
        "semantic",
        "neutral",
        "Heuristic semantic mapping",
        `Matching via text keyword-scanning. Covered ${found.length}/${skills.length || 1} profile skill mentions.`
      ),
    ],
  };
}
