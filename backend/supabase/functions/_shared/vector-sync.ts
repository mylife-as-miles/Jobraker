import { embedBatch } from "./embeddings.ts";

export function splitTextIntoChunks(text: string, maxChars = 800, overlap = 150): string[] {
  const cleaned = (text || "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxChars) return [cleaned];
  
  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    let end = start + maxChars;
    if (end < cleaned.length) {
      const nextDot = cleaned.indexOf(". ", end - overlap);
      if (nextDot !== -1 && nextDot < end + overlap) {
        end = nextDot + 1;
      } else {
        const nextSpace = cleaned.indexOf(" ", end - overlap);
        if (nextSpace !== -1 && nextSpace < end + overlap) {
          end = nextSpace;
        }
      }
    }
    chunks.push(cleaned.slice(start, end).trim());
    start = end - overlap;
    if (start >= cleaned.length || end >= cleaned.length) break;
  }
  return chunks.filter(Boolean);
}

function cleanChunkText(text: string): string {
  return (text || "").trim().slice(0, 8000);
}

export async function syncUserVectorChunks(serviceClient: any, userId: string): Promise<{
  success: boolean;
  syncedEvidence: number;
  syncedMemory: number;
  syncedApplications: number;
  syncedJobs: number;
  error?: string;
}> {
  let syncedEvidence = 0;
  let syncedMemory = 0;
  let syncedApplications = 0;
  let syncedJobs = 0;

  try {
    // 1. Sync Profile Evidence -> profile_evidence_chunks
    const [profileEvidenceItemsRes, existingEvidenceChunksRes] = await Promise.all([
      serviceClient.from("profile_evidence_items").select("id, text, evidence_type, skills_mentioned").eq("user_id", userId),
      serviceClient.from("profile_evidence_chunks").select("evidence_id").eq("user_id", userId),
    ]);

    if (profileEvidenceItemsRes.error) throw new Error(profileEvidenceItemsRes.error.message);
    if (existingEvidenceChunksRes.error) throw new Error(existingEvidenceChunksRes.error.message);

    const evidenceItems = profileEvidenceItemsRes.data || [];
    const existingEvChunkIds = new Set((existingEvidenceChunksRes.data || []).map((c: any) => c.evidence_id).filter(Boolean));

    const missingEvItems = evidenceItems.filter((item: any) => !existingEvChunkIds.has(item.id));
    if (missingEvItems.length > 0) {
      const textsToEmbed = missingEvItems.map((item: any) => cleanChunkText(item.text));
      const embeddings = await embedBatch(textsToEmbed);
      
      const insertRows = missingEvItems.map((item: any, idx: number) => ({
        user_id: userId,
        evidence_id: item.id,
        section: item.evidence_type || "general",
        chunk_text: item.text,
        embedding: embeddings[idx],
        metadata: { skills: item.skills_mentioned || [] },
      }));

      const { error: insertErr } = await serviceClient.from("profile_evidence_chunks").insert(insertRows);
      if (insertErr) throw insertErr;
      syncedEvidence += insertRows.length;
    }

    // Delete orphaned chunks
    const evItemIds = new Set(evidenceItems.map((item: any) => item.id));
    const orphans = (existingEvidenceChunksRes.data || []).filter((c: any) => c.evidence_id && !evItemIds.has(c.evidence_id));
    if (orphans.length > 0) {
      await serviceClient.from("profile_evidence_chunks").delete().in("evidence_id", orphans.map((c: any) => c.evidence_id));
    }

    // 2. Sync Candidate Memory + Answer Bank -> candidate_memory_chunks
    const [profileRes, answerBankRes, existingMemoryChunksRes] = await Promise.all([
      serviceClient.from("profiles").select("proof_points, story_bank, preferred_narratives, red_flags, target_archetypes").eq("id", userId).single(),
      serviceClient.from("answer_bank").select("id, theme, slug, question, tags, body").eq("user_id", userId),
      serviceClient.from("candidate_memory_chunks").select("id, metadata").eq("user_id", userId),
    ]);

    if (profileRes.error) throw profileRes.error;
    if (answerBankRes.error) throw answerBankRes.error;
    if (existingMemoryChunksRes.error) throw existingMemoryChunksRes.error;

    const profile = profileRes.data || {};
    const answerBank = answerBankRes.data || [];
    const existingMemChunks = existingMemoryChunksRes.data || [];

    const memoryItems: Array<{ text: string; metadata: any }> = [];

    const proofPoints = Array.isArray(profile.proof_points) ? profile.proof_points : [];
    proofPoints.forEach((pt: any, idx: number) => {
      const text = `Proof Point: ${pt.title || "Untitled"}. Detail: ${pt.evidence || ""}. Metric: ${pt.metric || ""}.`;
      memoryItems.push({ text, metadata: { type: "proof_point", index: idx } });
    });

    const storyBank = Array.isArray(profile.story_bank) ? profile.story_bank : [];
    storyBank.forEach((story: any, idx: number) => {
      const text = `Interview Story: ${story.title || "Untitled"}. Situation: ${story.situation || ""}. Task: ${story.task || ""}. Action: ${story.action || ""}. Outcome: ${story.outcome || ""}. Relevance: ${story.relevance || ""}.`;
      memoryItems.push({ text, metadata: { type: "story", index: idx } });
    });

    const preferredNarratives = Array.isArray(profile.preferred_narratives) ? profile.preferred_narratives : [];
    preferredNarratives.forEach((narrative: string, idx: number) => {
      memoryItems.push({ text: `Preferred positioning and career narrative: ${narrative}`, metadata: { type: "preferred_narrative", index: idx } });
    });

    const redFlags = Array.isArray(profile.red_flags) ? profile.red_flags : [];
    redFlags.forEach((flag: string, idx: number) => {
      memoryItems.push({ text: `Job search red flag / dealbreaker: ${flag}`, metadata: { type: "red_flag", index: idx } });
    });

    const targetArchetypes = Array.isArray(profile.target_archetypes) ? profile.target_archetypes : [];
    targetArchetypes.forEach((archetype: string, idx: number) => {
      memoryItems.push({ text: `Target role archetype: ${archetype}`, metadata: { type: "target_archetype", index: idx } });
    });

    answerBank.forEach((ans: any) => {
      const text = `Answer Bank - Theme: ${ans.theme}. Slug: ${ans.slug}. Question: ${ans.question}. Tags: ${(ans.tags || []).join(", ")}. Answer: ${ans.body}`;
      memoryItems.push({ text, metadata: { type: "answer_bank", answer_bank_id: ans.id } });
    });

    const chunksToInsert: typeof memoryItems = [];
    const chunkIdsToDelete: string[] = [];
    const matchedChunkIds = new Set<string>();
    
    memoryItems.forEach((item) => {
      const isAnswerBank = item.metadata.type === "answer_bank";
      const existing = existingMemChunks.find((c: any) => {
        if (isAnswerBank) {
          return c.metadata?.type === "answer_bank" && c.metadata?.answer_bank_id === item.metadata.answer_bank_id;
        } else {
          return c.metadata?.type === item.metadata.type && c.metadata?.index === item.metadata.index;
        }
      });

      if (existing) matchedChunkIds.add(existing.id);
      else chunksToInsert.push(item);
    });

    existingMemChunks.forEach((c: any) => {
      if (!matchedChunkIds.has(c.id)) chunkIdsToDelete.push(c.id);
    });

    if (chunkIdsToDelete.length > 0) {
      await serviceClient.from("candidate_memory_chunks").delete().in("id", chunkIdsToDelete);
    }

    if (chunksToInsert.length > 0) {
      const textsToEmbed = chunksToInsert.map((item) => cleanChunkText(item.text));
      const embeddings = await embedBatch(textsToEmbed);

      const insertRows = chunksToInsert.map((item, idx) => ({
        user_id: userId,
        chunk_text: item.text,
        embedding: embeddings[idx],
        metadata: item.metadata,
      }));

      const { error: insertErr } = await serviceClient.from("candidate_memory_chunks").insert(insertRows);
      if (insertErr) throw insertErr;
      syncedMemory += insertRows.length;
    }

    // 3. Sync Application Notes -> application_note_chunks
    const [applicationsRes, existingAppChunksRes] = await Promise.all([
      serviceClient.from("applications").select("id, job_title, company, status, canonical_stage, notes, next_step, applied_date").eq("user_id", userId),
      serviceClient.from("application_note_chunks").select("application_id").eq("user_id", userId),
    ]);

    if (applicationsRes.error) throw applicationsRes.error;
    if (existingAppChunksRes.error) throw existingAppChunksRes.error;

    const applications = applicationsRes.data || [];
    const existingAppChunkIds = new Set((existingAppChunksRes.data || []).map((c: any) => c.application_id).filter(Boolean));

    const missingApps = applications.filter((app: any) => !existingAppChunkIds.has(app.id) && (app.notes || "").trim().length > 0);
    if (missingApps.length > 0) {
      const textsToEmbed = missingApps.map((app: any) => {
        return cleanChunkText(`Application details - Company: ${app.company}. Job Title: ${app.job_title}. Status: ${app.status} (${app.canonical_stage}). Notes: ${app.notes || ""}. Next Step: ${app.next_step || ""}. Applied Date: ${app.applied_date || ""}.`);
      });
      const embeddings = await embedBatch(textsToEmbed);

      const insertRows = missingApps.map((app: any, idx: number) => ({
        user_id: userId,
        application_id: app.id,
        chunk_text: `Application details - Company: ${app.company}. Job Title: ${app.job_title}. Status: ${app.status} (${app.canonical_stage}). Notes: ${app.notes || ""}. Next Step: ${app.next_step || ""}. Applied Date: ${app.applied_date || ""}.`,
        embedding: embeddings[idx],
        metadata: { status: app.status },
      }));

      const { error: insertErr } = await serviceClient.from("application_note_chunks").insert(insertRows);
      if (insertErr) throw insertErr;
      syncedApplications += insertRows.length;
    }

    // Delete orphaned application chunks
    const appIds = new Set(applications.map((app: any) => app.id));
    const orphansApp = (existingAppChunksRes.data || []).filter((c: any) => c.application_id && !appIds.has(c.application_id));
    if (orphansApp.length > 0) {
      await serviceClient.from("application_note_chunks").delete().in("application_id", orphansApp.map((c: any) => c.application_id));
    }

    // 4. Sync Jobs -> job_chunks
    const [jobsRes, existingJobChunksRes] = await Promise.all([
      serviceClient.from("jobs").select("id, title, company, location, description, canonical_status, lead_quality_score, lead_quality_reason").eq("user_id", userId),
      serviceClient.from("job_chunks").select("job_id").in("job_id", (await serviceClient.from("jobs").select("id").eq("user_id", userId)).data?.map((j: any) => j.id) || []),
    ]);

    if (jobsRes.error) throw jobsRes.error;
    if (existingJobChunksRes.error) throw existingJobChunksRes.error;

    const jobs = jobsRes.data || [];
    const existingJobChunkIds = new Set((existingJobChunksRes.data || []).map((c: any) => c.job_id).filter(Boolean));

    const missingJobs = jobs.filter((job: any) => !existingJobChunkIds.has(job.id));
    
    if (missingJobs.length > 0) {
      const { data: evaluations } = await serviceClient
        .from("job_evaluations")
        .select("job_id, archetype, canonical_decision, confidence_score, exact_fit_evidence, blockers, compensation, personalization_plan, missing_requirements, tailoring_suggestions")
        .in("job_id", missingJobs.map((j: any) => j.id));

      const evalMap = new Map<string, any>();
      (evaluations || []).forEach((e: any) => evalMap.set(e.job_id, e));

      const jobInsertRows: any[] = [];
      const jobTextsToEmbed: string[] = [];

      missingJobs.forEach((job: any) => {
        const overviewText = `Job Overview: ${job.title} at ${job.company} in ${job.location || "Remote"}. Status: ${job.canonical_status}. Quality Rating: ${job.lead_quality_score || 0}/100. Quality Reason: ${job.lead_quality_reason || ""}`;
        jobTextsToEmbed.push(overviewText);
        jobInsertRows.push({
          job_id: job.id,
          section: "overview",
          chunk_text: overviewText,
          metadata: { company: job.company },
        });

        const descChunks = splitTextIntoChunks(job.description || "", 800, 150);
        descChunks.forEach((chunk, idx) => {
          const text = `Job Description for ${job.title} at ${job.company} [Part ${idx + 1}]: ${chunk}`;
          jobTextsToEmbed.push(text);
          jobInsertRows.push({
            job_id: job.id,
            section: `description_part_${idx + 1}`,
            chunk_text: text,
            metadata: { company: job.company },
          });
        });

        const jobEval = evalMap.get(job.id);
        if (jobEval) {
          const evalText = `Job Fit Evaluation for ${job.title} at ${job.company}. Fit Score: ${jobEval.confidence_score}/100. Archetype: ${jobEval.archetype || ""}. Canonical Decision: ${jobEval.canonical_decision}. Exact Fit Evidence: ${(jobEval.exact_fit_evidence || []).join(", ")}. Blockers: ${(jobEval.blockers || []).join(", ")}. Compensation Summary: ${jobEval.compensation?.summary || ""}. Personalization Narrative: ${jobEval.personalization_plan?.narrative || ""}. Missing Requirements: ${(jobEval.missing_requirements || []).join(", ")}. Tailoring Suggestions: ${(jobEval.tailoring_suggestions || []).join(", ")}`;
          jobTextsToEmbed.push(evalText);
          jobInsertRows.push({
            job_id: job.id,
            section: "evaluation_fit",
            chunk_text: evalText,
            metadata: { company: job.company },
          });
        }
      });

      if (jobTextsToEmbed.length > 0) {
        const embeddings = await embedBatch(jobTextsToEmbed);
        jobInsertRows.forEach((row, idx) => {
          row.embedding = embeddings[idx];
        });

        const { error: insertErr } = await serviceClient.from("job_chunks").insert(jobInsertRows);
        if (insertErr) throw insertErr;
        syncedJobs += missingJobs.length;
      }
    }

    return {
      success: true,
      syncedEvidence,
      syncedMemory,
      syncedApplications,
      syncedJobs,
    };
  } catch (err: any) {
    console.error(`[Vector Sync] Sync failed for user ${userId}:`, err);
    return {
      success: false,
      syncedEvidence,
      syncedMemory,
      syncedApplications,
      syncedJobs,
      error: err.message,
    };
  }
}
