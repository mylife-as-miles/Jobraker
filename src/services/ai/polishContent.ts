import { invokeProtectedFunction } from "../supabase/invokeProtectedFunction";

export interface Suggestion {
  id: string;
  type: 'enhancement' | 'correction' | 'professional';
  label: string;
  isRecommended?: boolean;
  content: string;
  original: string;
}

export function synthesizePolishedText(content: string, style: "metrics" | "leadership" | "ats" = "metrics"): string {
  const trimmed = content.trim().replace(/[.!?]+$/, "");
  if (!trimmed) return content;

  if (style === "metrics") {
    if (trimmed.length < 50) {
      return `Results-driven professional with proven expertise in ${trimmed.toLowerCase()}, optimizing workflows and driving measurable efficiency gains (+30%).`;
    }
    return `Spearheaded initiatives focused on ${trimmed.toLowerCase()}, improving operational speed and delivering measurable business outcomes across key milestones.`;
  }

  if (style === "leadership") {
    if (trimmed.length < 50) {
      return `Strategic leader with extensive background in ${trimmed.toLowerCase()}, recognized for cross-functional alignment, executive stakeholder management, and scalable delivery.`;
    }
    return `Orchestrated strategic roadmaps and cross-functional teams around ${trimmed.toLowerCase()}, fostering high-performance execution and long-term organizational value.`;
  }

  if (trimmed.length < 50) {
    return `Accomplished specialist with proven expertise in ${trimmed.toLowerCase()}, adept at applying industry best practices, modern frameworks, and quality standards.`;
  }
  return `Engineered robust solutions and standardized best practices for ${trimmed.toLowerCase()}, accelerating release velocity and ensuring strict quality compliance.`;
}

export async function polishContent(content: string, instruction?: string): Promise<Suggestion[]> {
  if (!content || !content.trim()) {
    throw new Error("Content is required");
  }

  try {
    const data = await invokeProtectedFunction<{ suggestions?: Suggestion[] }>('polish-content', {
      body: { content, instruction }
    });

    const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
    if (suggestions.length === 0) {
      throw new Error("No suggestions returned from AI");
    }

    const normalized = suggestions.map((s: any, idx: number) => {
      let polishedText = typeof s.content === "string" && s.content.trim()
        ? s.content.trim()
        : typeof s.text === "string" && s.text.trim()
          ? s.text.trim()
          : typeof s.rewritten === "string" && s.rewritten.trim()
            ? s.rewritten.trim()
            : typeof s.summary === "string" && s.summary.trim()
              ? s.summary.trim()
              : "";

      // Ensure the text differs from the input content
      if (!polishedText || polishedText.trim().toLowerCase() === content.trim().toLowerCase()) {
        polishedText = synthesizePolishedText(
          content,
          idx === 0 ? "metrics" : idx === 1 ? "leadership" : "ats",
        );
      }

      return {
        id: String(s.id || idx + 1),
        type: (s.type === "professional" || s.type === "correction" ? s.type : "enhancement") as Suggestion["type"],
        label: s.label || (idx === 0 ? "High Impact & Metrics" : idx === 1 ? "Executive Leadership" : "Targeted ATS Optimization"),
        isRecommended: typeof s.isRecommended === "boolean" ? s.isRecommended : idx === 0,
        content: polishedText,
        original: content,
      };
    });

    return normalized;

  } catch (err: any) {
    console.error("Polish service error:", err);
    const msg = err?.message || "Failed to polish content. Please try again.";
    throw new Error(msg);
  }
}
