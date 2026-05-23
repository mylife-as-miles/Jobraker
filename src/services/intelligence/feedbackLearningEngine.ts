import { clampScore, normalizeText, reason } from "./textUtils";
import type { JobIntelligenceJobInput, RankingReason } from "./types";

export type FeedbackLearningResult = {
  score: number;
  reasons: RankingReason[];
};

/**
 * Learns from past candidate feedback events (e.g., job_saved, job_ignored, interview_received)
 * and adjusts the opportunity score.
 */
export function scoreFeedbackLearning(
  job: JobIntelligenceJobInput,
  events: any[] = []
): FeedbackLearningResult {
  let score = 50; // Neutral baseline
  const reasons: RankingReason[] = [];

  if (!events || events.length === 0) {
    return { score, reasons };
  }

  const jobTitle = normalizeText(job.title || "");
  const jobCompany = normalizeText(job.company || "");
  const jobDescription = normalizeText(job.description || "");

  // Analyze positive and negative signals from events
  const positiveTitles: string[] = [];
  const negativeTitles: string[] = [];
  const positiveCompanies = new Set<string>();
  const interviewedCompanies = new Set<string>();

  events.forEach((event) => {
    const title = normalizeText(event.metadata?.job_title || event.notes || "");
    const company = normalizeText(event.metadata?.company || "");

    switch (event.event_type) {
      case "job_saved":
      case "job_applied":
      case "good_fit":
      case "relevant":
        if (title) positiveTitles.push(title);
        if (company) positiveCompanies.add(company);
        break;

      case "job_interviewed":
      case "job_offer_received":
        if (title) positiveTitles.push(title);
        if (company) {
          positiveCompanies.add(company);
          interviewedCompanies.add(company);
        }
        break;

      case "job_ignored":
      case "not_relevant":
      case "low_quality":
        if (title) negativeTitles.push(title);
        break;
    }
  });

  // Calculate boosts / penalties
  let titleBoost = 0;
  let companyBoost = 0;
  let titlePenalty = 0;

  // 1. Title matching
  const matchingPosTitle = positiveTitles.find((posTitle) => {
    // Check if the current job title shares significant words with a successfully applied/saved title
    const posWords = posTitle.split(/\s+/).filter((w) => w.length > 3);
    return posWords.some((word) => jobTitle.includes(word));
  });

  if (matchingPosTitle) {
    titleBoost += 15;
  }

  const matchingNegTitle = negativeTitles.find((negTitle) => {
    const negWords = negTitle.split(/\s+/).filter((w) => w.length > 3);
    return negWords.some((word) => jobTitle.includes(word));
  });

  if (matchingNegTitle) {
    titlePenalty -= 20;
  }

  // 2. Company matching
  if (jobCompany && positiveCompanies.has(jobCompany)) {
    companyBoost += 10;
    if (interviewedCompanies.has(jobCompany)) {
      companyBoost += 15; // Extra boost if candidate has interviewed here
    }
  }

  // 3. Stack preferences (e.g. React/Supabase boosts based on interview events)
  let stackBoost = 0;
  const isReactSupabase = jobDescription.includes("react") || jobDescription.includes("supabase");
  const hasReactSupabaseInterview = events.some(
    (e) =>
      (e.event_type === "job_interviewed" || e.event_type === "job_offer_received") &&
      normalizeText(e.metadata?.description || "").includes("react")
  );

  if (isReactSupabase && hasReactSupabaseInterview) {
    stackBoost += 15;
  }

  // Aggregate final score
  score += titleBoost + companyBoost + titlePenalty + stackBoost;
  const finalScore = clampScore(score);

  // Compile explanation reasons
  if (titleBoost > 0) {
    reasons.push(
      reason(
        "feedback-title-match",
        "feedback",
        "positive",
        "Matches preferred roles",
        "Prior applications or saved roles indicate you prefer this type of job focus.",
        { scoreDelta: titleBoost }
      )
    );
  }

  if (titlePenalty < 0) {
    reasons.push(
      reason(
        "feedback-title-penalty",
        "feedback",
        "negative",
        "History of ignored roles",
        "You have previously ignored or marked similar titles as not relevant.",
        { scoreDelta: titlePenalty }
      )
    );
  }

  if (companyBoost > 0) {
    reasons.push(
      reason(
        "feedback-company-match",
        "feedback",
        "positive",
        "High-conversion company fit",
        interviewedCompanies.has(jobCompany)
          ? "You previously reached the interview stage with this employer."
          : "You have engaged with this company in past search events.",
        { scoreDelta: companyBoost }
      )
    );
  }

  if (stackBoost > 0) {
    reasons.push(
      reason(
        "feedback-stack-conversion",
        "feedback",
        "positive",
        "Converting tech stack",
        "Roles containing React/Supabase have generated interview outcomes for you.",
        { scoreDelta: stackBoost }
      )
    );
  }

  return {
    score: finalScore,
    reasons,
  };
}
