import type { ResumeData } from "@/store/artboard";

export function buildSummaryEnhancementSource(resumeData: ResumeData): string {
  const existingSummary = (resumeData.summary?.content || "").trim();
  if (existingSummary) return existingSummary;

  const headline = (resumeData.basics.headline || "").trim();
  const candidateName = (resumeData.basics.name || "").trim();
  const topPositions = (resumeData.sections?.experience?.items || [])
    .slice(0, 2)
    .map((item) => item.position || item.title || "")
    .filter(Boolean);
  const topSkills = (resumeData.sections?.skills?.items || [])
    .slice(0, 5)
    .map((item) => item.name || "")
    .filter(Boolean);

  return [
    headline ? `Role: ${headline}` : "",
    topPositions.length > 0 ? `Experience as ${topPositions.join(" and ")}` : "",
    topSkills.length > 0 ? `Core skills: ${topSkills.join(", ")}` : "",
    candidateName ? `Candidate: ${candidateName}` : "",
  ]
    .filter(Boolean)
    .join(". ");
}
