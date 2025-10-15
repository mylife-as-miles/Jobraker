export interface ResumeAnalysisRequest {
  resumeText: string;
  profileSummary: string;
  apiKey: string;
  model?: string | null;
  baseURL?: string | null;
}

export interface ResumeAnalysisRecommendation {
  focus: string;
  action: string;
  impact?: string | null;
}

export interface ResumeAnalysisResult {
  overallScore: number;
  alignmentScore: number;
  atsScore: number;
  readabilityScore: number;
  jobFitLikelihood: number;
  grade: string;
  summary: string;
  strengths: string[];
  gaps: string[];
  recommendations: ResumeAnalysisRecommendation[];
  atsRiskNarrative?: string | null;
  metadata?: {
    resumeExcerpt?: string;
  } | null;
}

const DEFAULT_MODEL = "gpt-4o-mini";
const JSON_FAILSAFE: ResumeAnalysisResult = {
  overallScore: 0,
  alignmentScore: 0,
  atsScore: 0,
  readabilityScore: 0,
  jobFitLikelihood: 0,
  grade: "N/A",
  summary: "Analysis unavailable.",
  strengths: [],
  gaps: [],
  recommendations: [],
  atsRiskNarrative: null,
  metadata: null,
};

function buildPromptBody(resumeText: string, profileSummary: string) {
  return `You are JobRaker's Resume Intelligence model. Examine the provided resume content in detail and evaluate it against the candidate profile snapshot. Identify strengths, gaps, and risks that could impact Applicant Tracking Systems (ATS) scoring or recruiter perception.

Required output JSON schema:
{
  "overall_score": number (0-100, holistic resume quality),
  "alignment_score": number (0-100, alignment to target profile/goals),
  "ats_score": number (0-100, ATS friendliness),
  "readability_score": number (0-100, human readability/clarity),
  "job_fit_likelihood": number (0-100 probability of securing interviews for aligned roles),
  "grade": string (A+, A, B+, B, C, D, F),
  "summary": string (3-4 sentence executive summary),
  "strengths": string[] (max 6),
  "gaps": string[] (max 6, prioritize critical weaknesses),
  "recommendations": [{ "focus": string, "action": string, "impact": string }],
  "ats_risk_narrative": string | null,
  "metadata": { "resume_excerpt": string } | null
}

Rules:
- Use concise business language.
- Tailor every insight to the resume provided; avoid generic career advice.
- Reference profile data when explaining alignment or risk.
- Highlight quantified wins to keep if they already exist; otherwise note missing metrics.
- Grade must correlate with overall_score.
- Keep recommendations actionable and sorted by impact.

<profile>
${profileSummary}
</profile>

<resume>
${resumeText}
</resume>`;
}

function toResult(raw: any): ResumeAnalysisResult {
  if (!raw || typeof raw !== "object") return JSON_FAILSAFE;
  const num = (val: any) => {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return Math.max(0, Math.min(100, Math.round(parsed)));
    return 0;
  };
  const arr = (val: any) => Array.isArray(val) ? val.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()) : [];
  const recs = Array.isArray(raw.recommendations)
    ? raw.recommendations
        .map((item: any) => ({
          focus: String(item?.focus || item?.area || ""),
          action: String(item?.action || item?.recommendation || ""),
          impact: item?.impact ? String(item.impact) : null,
        }))
        .filter((item: ResumeAnalysisRecommendation) => item.focus.trim() || item.action.trim())
    : [];

  const grade = typeof raw.grade === "string" ? raw.grade.trim() : "N/A";

  return {
    overallScore: num(raw.overall_score ?? raw.score ?? raw.overallScore),
    alignmentScore: num(raw.alignment_score ?? raw.match_score ?? raw.alignmentScore),
    atsScore: num(raw.ats_score ?? raw.atsScore),
    readabilityScore: num(raw.readability_score ?? raw.readabilityScore),
    jobFitLikelihood: num(raw.job_fit_likelihood ?? raw.interview_odds ?? raw.jobFitLikelihood),
    grade: grade || "N/A",
    summary: typeof raw.summary === "string" ? raw.summary.trim() : JSON_FAILSAFE.summary,
    strengths: arr(raw.strengths),
    gaps: arr(raw.gaps ?? raw.weaknesses),
    recommendations: recs,
    atsRiskNarrative: typeof raw.ats_risk_narrative === "string" ? raw.ats_risk_narrative.trim() : null,
    metadata: raw.metadata && typeof raw.metadata === "object" ? {
      resumeExcerpt: typeof raw.metadata.resume_excerpt === "string" ? raw.metadata.resume_excerpt : undefined,
    } : null,
  };
}

export async function analyzeResumeWithOpenAI({ resumeText, profileSummary, apiKey, model, baseURL }: ResumeAnalysisRequest): Promise<ResumeAnalysisResult> {
  const endpoint = (baseURL || "https://api.openai.com/v1") + "/chat/completions";
  const payload = {
    model: model || DEFAULT_MODEL,
    temperature: 0.35,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You are JobRaker's resume intelligence engine. Always reply with structured JSON matching the requested schema."
      },
      {
        role: "user",
        content: buildPromptBody(resumeText, profileSummary)
      }
    ],
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const errJson = await res.json();
      detail = errJson?.error?.message || JSON.stringify(errJson);
    } catch {
      detail = await res.text();
    }
    throw new Error(`OpenAI request failed: ${detail}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Invalid response from OpenAI");
  }

  try {
    const parsed = JSON.parse(content);
    return toResult(parsed);
  } catch (err: any) {
    throw new Error(`Failed to parse analysis JSON: ${err?.message || err}`);
  }
}
