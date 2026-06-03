import { supabase } from "../../lib/supabaseClient";
import { sentenceFragments, unique } from "./textUtils";
import type { CandidateProfileInput, ProfileEvidenceMatch } from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ProfileEvidenceBuildResult = {
  success: boolean;
  entitiesCreated: number;
  edgesCreated: number;
  evidenceItemsCreated: number;
  skillsCalculated: number;
  error?: string;
};

/**
 * Rebuilds the structured profile evidence graph in Postgres for a user.
 * Reads profiles, profile_experiences, profile_skills, and parsed_resumes,
 * and compiles them into profile_entities, profile_edges, profile_evidence_items, and candidate_skill_signals.
 */
export async function rebuildProfileEvidenceForUser(userId: string): Promise<ProfileEvidenceBuildResult> {
  if (!UUID_PATTERN.test(userId || "")) {
    return {
      success: false,
      entitiesCreated: 0,
      edgesCreated: 0,
      evidenceItemsCreated: 0,
      skillsCalculated: 0,
      error: "A valid user id is required to rebuild profile evidence.",
    };
  }

  try {
    // 1. Fetch raw candidate data
    const [profileRes, skillsRes, experiencesRes, resumesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("profile_skills").select("*").eq("user_id", userId),
      supabase.from("profile_experiences").select("*").eq("user_id", userId),
      supabase.from("parsed_resumes").select("*").eq("user_id", userId).order("extracted_at", { ascending: false }),
    ]);

    if (profileRes.error) throw new Error(`Profiles fetch error: ${profileRes.error.message}`);
    if (skillsRes.error) throw new Error(`Skills fetch error: ${skillsRes.error.message}`);
    if (experiencesRes.error) throw new Error(`Experiences fetch error: ${experiencesRes.error.message}`);
    if (resumesRes.error) throw new Error(`Resumes fetch error: ${resumesRes.error.message}`);

    const profile = profileRes.data;
    const skills = skillsRes.data || [];
    const experiences = experiencesRes.data || [];
    const parsedResumes = resumesRes.data || [];

    // 2. Clear existing graph data for this user
    await Promise.all([
      supabase.from("profile_edges").delete().eq("user_id", userId),
      supabase.from("profile_evidence_items").delete().eq("user_id", userId),
      supabase.from("candidate_skill_signals").delete().eq("user_id", userId),
      supabase.from("candidate_role_preferences").delete().eq("user_id", userId),
    ]);
    // Delete entities last due to foreign keys
    await supabase.from("profile_entities").delete().eq("user_id", userId);

    let entitiesCount = 0;
    let edgesCount = 0;
    let evidenceCount = 0;

    // 3. Create Candidate Entity
    const candidateName = profile
      ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Candidate"
      : "Candidate";
    
    const { data: candEntity, error: candError } = await supabase
      .from("profile_entities")
      .insert({
        user_id: userId,
        entity_type: "candidate",
        name: candidateName,
        description: profile?.job_title || "Candidate Profile",
        metadata: {
          experience_years: profile?.experience_years || 0,
          location: profile?.location || "",
          goals: profile?.goals || [],
        },
      })
      .select("id")
      .single();

    if (candError || !candEntity) {
      throw new Error(`Failed to create candidate entity: ${candError?.message}`);
    }
    const candId = candEntity.id;
    entitiesCount++;

    // 4. Create Skill Entities and Edges
    const skillEntityMap = new Map<string, string>();
    for (const skill of skills) {
      const { data: skillEntity, error: skillError } = await supabase
        .from("profile_entities")
        .insert({
          user_id: userId,
          entity_type: "skill",
          name: skill.name,
          metadata: {
            level: skill.level,
            category: skill.category,
          },
        })
        .select("id")
        .single();

      if (skillError || !skillEntity) {
        console.warn(`Skipped skill entity creation for ${skill.name}: ${skillError?.message}`);
        continue;
      }
      entitiesCount++;
      skillEntityMap.set(skill.name.toLowerCase(), skillEntity.id);

      // Link Candidate -> HAS_SKILL -> Skill
      const levelWeights = { Expert: 1.0, Advanced: 0.8, Intermediate: 0.6, Beginner: 0.4 };
      const weight = levelWeights[skill.level as keyof typeof levelWeights] || 0.5;

      const { error: edgeError } = await supabase.from("profile_edges").insert({
        user_id: userId,
        source_entity_id: candId,
        target_entity_id: skillEntity.id,
        edge_type: "HAS_SKILL",
        weight,
        metadata: { level: skill.level },
      });

      if (!edgeError) edgesCount++;
    }

    // 5. Create Experience Entities, Edges, and Evidence Items
    const experienceDurations = new Map<string, { years: number; isRecent: boolean; isCurrent: boolean }>();
    
    for (const exp of experiences) {
      const expTitle = `${exp.title} at ${exp.company}`;
      const { data: expEntity, error: expError } = await supabase
        .from("profile_entities")
        .insert({
          user_id: userId,
          entity_type: "experience",
          name: expTitle,
          description: exp.description || "",
          metadata: {
            title: exp.title,
            company: exp.company,
            start_date: exp.start_date,
            end_date: exp.end_date,
            is_current: exp.is_current,
          },
        })
        .select("id")
        .single();

      if (expError || !expEntity) {
        console.warn(`Skipped experience entity creation for ${expTitle}: ${expError?.message}`);
        continue;
      }
      entitiesCount++;

      // Link Candidate -> CONTAINS -> Experience
      const { error: edgeError } = await supabase.from("profile_edges").insert({
        user_id: userId,
        source_entity_id: candId,
        target_entity_id: expEntity.id,
        edge_type: "CONTAINS",
        weight: 1.0,
      });
      if (!edgeError) edgesCount++;

      // Compute experience duration
      const startMs = Date.parse(exp.start_date);
      const endMs = exp.end_date ? Date.parse(exp.end_date) : Date.now();
      const years = Number.isNaN(startMs) ? 0 : Math.max(0.1, (endMs - startMs) / (1000 * 60 * 60 * 24 * 365.25));
      
      const isCurrent = !!exp.is_current;
      const ageMonths = exp.end_date ? (Date.now() - Date.parse(exp.end_date)) / (1000 * 60 * 60 * 24 * 30) : 0;
      const isRecent = isCurrent || ageMonths <= 12;

      // Scan description for skills
      const matchedSkillIds: string[] = [];
      const matchedSkillNames: string[] = [];
      const expDesc = exp.description || "";
      
      for (const skill of skills) {
        const regex = new RegExp(`\\b${skill.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
        if (regex.test(exp.title) || regex.test(expDesc)) {
          const skillEntityId = skillEntityMap.get(skill.name.toLowerCase());
          if (skillEntityId) {
            matchedSkillIds.push(skillEntityId);
            matchedSkillNames.push(skill.name);
            
            // Link Experience -> EVIDENCES -> Skill
            const { error: edgeErr } = await supabase.from("profile_edges").insert({
              user_id: userId,
              source_entity_id: expEntity.id,
              target_entity_id: skillEntityId,
              edge_type: "EVIDENCES",
              weight: 1.0,
            });
            if (!edgeErr) edgesCount++;

            // Accumulate duration stats per skill
            const existing = experienceDurations.get(skill.name.toLowerCase()) || { years: 0, isRecent: false, isCurrent: false };
            experienceDurations.set(skill.name.toLowerCase(), {
              years: existing.years + years,
              isRecent: existing.isRecent || isRecent,
              isCurrent: existing.isCurrent || isCurrent,
            });
          }
        }
      }

      // Add whole experience as evidence item
      const { error: evError } = await supabase.from("profile_evidence_items").insert({
        user_id: userId,
        entity_type: "experience",
        entity_id: expEntity.id,
        evidence_type: "work_experience",
        text: `${exp.title} at ${exp.company}: ${expDesc}`,
        skills_mentioned: matchedSkillNames,
        confidence: 0.9,
        source_table: "profile_experiences",
        source_id: exp.id,
      });
      if (!evError) evidenceCount++;

      // Add individual bullet sentences as evidence items
      const fragments = sentenceFragments(expDesc);
      for (const fragment of fragments) {
        const fragmentSkills = matchedSkillNames.filter((skillName) => {
          const regex = new RegExp(`\\b${skillName.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
          return regex.test(fragment);
        });

        if (fragmentSkills.length > 0) {
          const { error: fragEvError } = await supabase.from("profile_evidence_items").insert({
            user_id: userId,
            entity_type: "experience",
            entity_id: expEntity.id,
            evidence_type: "resume_bullet",
            text: fragment,
            skills_mentioned: fragmentSkills,
            confidence: 0.8,
            source_table: "profile_experiences",
            source_id: exp.id,
          });
          if (!fragEvError) evidenceCount++;
        }
      }
    }

    // 6. Process Parsed Resumes
    for (const res of parsedResumes) {
      const rawText = res.raw_text || "";
      const fragments = sentenceFragments(rawText).slice(0, 100); // Limit to avoid DB spam

      for (const fragment of fragments) {
        const matchedSkills = skills
          .map((s) => s.name)
          .filter((name) => {
            const regex = new RegExp(`\\b${name.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
            return regex.test(fragment);
          });

        if (matchedSkills.length > 0) {
          const { error: resumeEvError } = await supabase.from("profile_evidence_items").insert({
            user_id: userId,
            entity_type: "resume",
            evidence_type: "resume_bullet",
            text: fragment,
            skills_mentioned: matchedSkills,
            confidence: 0.6,
            source_table: "parsed_resumes",
            source_id: res.id,
          });
          if (!resumeEvError) evidenceCount++;
        }
      }
    }

    // 7. Calculate and insert skill strength signals
    let skillsCalculated = 0;
    for (const skill of skills) {
      const stats = experienceDurations.get(skill.name.toLowerCase()) || { years: 0, isRecent: false, isCurrent: false };
      
      // Calculate evidence strength: Base level + Experience boosts
      const baseStrength = { Expert: 85, Advanced: 70, Intermediate: 50, Beginner: 30 }[skill.level as string] || 40;
      let strength = baseStrength;

      const frequency = experiences.filter((exp) => {
        const regex = new RegExp(`\\b${skill.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
        return regex.test(exp.title) || regex.test(exp.description || "");
      }).length;

      if (frequency > 0) strength += 10;
      if (frequency > 1) strength += 10;
      if (stats.isCurrent) strength += 10;
      else if (stats.isRecent) strength += 5;

      const evidenceStrength = Math.min(100, Math.max(10, strength));
      const recencyMonths = stats.isCurrent ? 0 : stats.isRecent ? 6 : 24; // Simple estimate

      const { error: signalError } = await supabase.from("candidate_skill_signals").insert({
        user_id: userId,
        skill_name: skill.name,
        evidence_strength: evidenceStrength,
        experience_years: Number(stats.years.toFixed(1)),
        recency_months: stats.isCurrent ? 0 : recencyMonths,
        frequency_count: frequency,
        outcome_confidence: 60, // Default baseline
        sources_breakdown: {
          level: skill.level,
          has_experience: frequency > 0,
          experience_years: stats.years,
        },
      });

      if (!signalError) skillsCalculated++;
    }

    // 8. Create role preferences if profile goals/title exists
    if (profile?.job_title) {
      await supabase.from("candidate_role_preferences").insert({
        user_id: userId,
        target_title: profile.job_title,
        preferred_locations: profile.location ? [profile.location] : [],
        preferred_remote_types: ["remote"], // Safe fallback
      });
    }

    return {
      success: true,
      entitiesCreated: entitiesCount,
      edgesCreated: edgesCount,
      evidenceItemsCreated: evidenceCount,
      skillsCalculated,
    };
  } catch (error: any) {
    console.error("Error in rebuildProfileEvidenceForUser:", error);
    return {
      success: false,
      entitiesCreated: 0,
      edgesCreated: 0,
      evidenceItemsCreated: 0,
      skillsCalculated: 0,
      error: error.message,
    };
  }
}

/**
 * Calculates local skill strength and evidence rating for candidate fit scoring.
 * Used during scoring when Postgres graph signals are active.
 */
export async function getProfileEvidenceScore(userId: string): Promise<number> {
  if (!UUID_PATTERN.test(userId || "")) return 40;

  const { data: signals, error } = await supabase
    .from("candidate_skill_signals")
    .select("evidence_strength")
    .eq("user_id", userId);

  if (error || !signals || signals.length === 0) return 40; // Default fallback score
  const total = signals.reduce((sum, item) => sum + item.evidence_strength, 0);
  return Math.round(total / signals.length);
}
