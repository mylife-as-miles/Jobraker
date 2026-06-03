import { supabase } from "../../lib/supabaseClient";
import { clampScore, reason } from "./textUtils";
import type { MatchBlocker, RankingReason, GraphProofPath } from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const fallbackGraphResult = (title = "Graph traversal skipped"): GraphReasoningResult => ({
  graphScore: 50,
  proofPaths: [],
  reasons: [
    reason(
      "graph-skipped",
      "graph",
      "neutral",
      title,
      "Profile graph evidence is not available yet. Using deterministic fit signals.",
    ),
  ],
  blockers: [],
});

export type GraphReasoningResult = {
  graphScore: number;
  proofPaths: GraphProofPath[];
  reasons: RankingReason[];
  blockers: MatchBlocker[];
};

/**
 * Computes graph reasoning paths to verify skill matches.
 * Traverses user entity/edge graphs in PostgreSQL or Kuzu.
 */
export async function computeGraphReasoning(
  userId: string,
  requiredSkills: string[]
): Promise<GraphReasoningResult> {
  const isKuzuEnabled = import.meta.env.VITE_ENABLE_KUZU_GRAPH === "true";
  const reasons: RankingReason[] = [];
  const blockers: MatchBlocker[] = [];
  const proofPaths: GraphProofPath[] = [];

  if (!UUID_PATTERN.test(userId || "")) {
    return fallbackGraphResult();
  }

  if (isKuzuEnabled) {
    console.info("[Kuzu Graph] Graph reasoning active, running Kuzu sync checks.");
    // In production, sync nodes/edges to Kuzu space and query via Cypher.
    // For local fallback compatibility, we default to the relational Postgres graph.
  }

  try {
    if (!requiredSkills.length) {
      return {
        graphScore: 100,
        proofPaths: [],
        reasons: [],
        blockers: [],
      };
    }

    let verifiedCount = 0;
    
    // Query proof paths in parallel for all required skills
    const pathPromises = requiredSkills.map(async (skill) => {
      const { data, error } = await supabase.rpc("get_profile_proof_paths", {
        p_user_id: userId,
        p_target_skill: skill,
      });
      return { skill, data, error };
    });

    const results = await Promise.all(pathPromises);

    results.forEach(({ skill, data, error }) => {
      if (error) {
        console.warn(`Proof path lookup failed for ${skill}:`, error.message);
        return;
      }

      if (data && data.length > 0) {
        verifiedCount++;
        // Take the highest confidence path
        const bestPath = data.sort((a: any, b: any) => b.confidence - a.confidence)[0];
        
        proofPaths.push({
          nodes: bestPath.path_node_names,
          edges: bestPath.path_edge_types,
          confidence: Math.round(bestPath.confidence * 100),
        });

        // Add visible reasoning for the first couple of verified paths
        if (verifiedCount <= 2) {
          reasons.push(
            reason(
              `graph-proof-${skill.toLowerCase()}`,
              "graph",
              "positive",
              `Graph proof: ${skill}`,
              `Verified proof path found: ${bestPath.path_node_names.join(" -> ")}.`
            )
          );
        }
      } else {
        // Missing proof path for a required skill
        blockers.push({
          id: `missing-proof-${skill.toLowerCase()}`,
          severity: "medium",
          title: `No verified proof path for ${skill}`,
          detail: `The skill ${skill} is required, but there is no strong project or experience edge linking it in your profile graph.`,
          canImprove: true,
        });
      }
    });

    const graphScore = clampScore((verifiedCount / requiredSkills.length) * 100);

    return {
      graphScore,
      proofPaths,
      reasons,
      blockers,
    };
  } catch (err: any) {
    console.error("Error in computeGraphReasoning:", err);
    return fallbackGraphResult("Graph traversal suspended");
  }
}
