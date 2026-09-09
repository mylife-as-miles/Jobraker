export type PolishSuggestion = {
  id: string;
  type: "enhancement" | "correction" | "professional";
  label: string;
  content: string;
  isRecommended?: boolean;
};

export type PolishContentResponse = {
  suggestions: PolishSuggestion[];
};

export function ensureSentence(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function cleanInputForPolish(text: string): string {
  let cleaned = text
    .trim()
    .replace(/^(?:i am an?|i was an?)\s+/i, "")
    .replace(/^(?:responsible for|in charge of|tasked with)\s+/i, "")
    .replace(/^(?:experienced in|proven experience in|track record in)\s+/i, "")
    .replace(/\b(?:responsible for|in charge of)\b/gi, "overseeing")
    .replace(/\b(?:helped to|helped with|assisted with|assisted in)\b/gi, "collaborated to")
    .replace(/\b(?:worked on|participated in)\b/gi, "engineered")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned;
}

export function polishTextHeuristically(
  content: string,
  style: "metrics" | "leadership" | "ats",
): string {
  const base = cleanInputForPolish(content);
  const sanitized = base.replace(/[.!?]+$/, "");

  if (style === "metrics") {
    if (sanitized.length < 50) {
      return `Results-driven professional with demonstrated track record in ${sanitized.toLowerCase()}, optimizing workflows and driving measurable efficiency gains (+30%).`;
    }
    return `Spearheaded initiatives focused on ${sanitized.toLowerCase()}, improving operational speed and delivering measurable business outcomes across key milestones.`;
  }

  if (style === "leadership") {
    if (sanitized.length < 50) {
      return `Strategic leader with extensive background in ${sanitized.toLowerCase()}, recognized for cross-functional alignment, executive stakeholder management, and scalable delivery.`;
    }
    return `Orchestrated strategic roadmaps and cross-functional teams around ${sanitized.toLowerCase()}, fostering high-performance execution and long-term organizational value.`;
  }

  // ATS Optimization: keywords, standardized industry phrasing
  if (sanitized.length < 50) {
    return `Accomplished specialist with proven expertise in ${sanitized.toLowerCase()}, adept at applying industry best practices, modern frameworks, and quality standards.`;
  }
  return `Engineered robust solutions and standardized best practices for ${sanitized.toLowerCase()}, accelerating release velocity and ensuring strict quality compliance.`;
}

export function extractSuggestionContent(record: unknown): string {
  if (typeof record === "string" && record.trim()) {
    return record.trim();
  }
  if (record && typeof record === "object") {
    const obj = record as Record<string, unknown>;
    const candidate =
      obj.content ||
      obj.text ||
      obj.rewritten ||
      obj.summary ||
      obj.rewritten_content ||
      obj.body ||
      obj.description ||
      obj.output ||
      obj.suggestion;
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "";
}

export function extractSuggestionsArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.suggestions)) return obj.suggestions;
    if (Array.isArray(obj.items)) return obj.items;
    if (Array.isArray(obj.results)) return obj.results;
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.options)) return obj.options;
    // Single item object
    const single = extractSuggestionContent(obj);
    if (single) {
      return [obj];
    }
  }
  if (typeof parsed === "string" && parsed.trim()) {
    return [{ content: parsed.trim() }];
  }
  return [];
}

export function normalizeSuggestion(
  value: unknown,
  index: number,
  fallbackContent: string,
): PolishSuggestion {
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const type =
    record.type === "professional" || record.type === "correction"
      ? record.type
      : "enhancement";

  let content = extractSuggestionContent(value);

  // Guarantee that the output is non-empty and differs from the original input
  if (!content || content.trim().toLowerCase() === fallbackContent.trim().toLowerCase()) {
    content = polishTextHeuristically(
      fallbackContent,
      index === 0 ? "metrics" : index === 1 ? "leadership" : "ats",
    );
  }

  return {
    id:
      typeof record.id === "string" && record.id.trim()
        ? record.id.trim()
        : String(index + 1),
    type,
    label:
      typeof record.label === "string" && record.label.trim()
        ? record.label.trim()
        : index === 0
          ? "High Impact & Metrics"
          : index === 1
            ? "Executive Leadership"
            : "Targeted ATS Optimization",
    content,
    isRecommended:
      typeof record.isRecommended === "boolean"
        ? record.isRecommended
        : index === 0,
  };
}

export function buildFallbackPolishResponse(content: string): PolishContentResponse {
  return {
    suggestions: [
      {
        id: "1",
        type: "enhancement",
        label: "High Impact & Metrics",
        content: polishTextHeuristically(content, "metrics"),
        isRecommended: true,
      },
      {
        id: "2",
        type: "professional",
        label: "Executive Leadership",
        content: polishTextHeuristically(content, "leadership"),
      },
      {
        id: "3",
        type: "correction",
        label: "Targeted ATS Optimization",
        content: polishTextHeuristically(content, "ats"),
      },
    ],
  };
}

export function normalizePolishResponse(
  parsed: unknown,
  fallbackContent: string,
): PolishContentResponse {
  const suggestions = extractSuggestionsArray(parsed);
  const normalized = suggestions
    .slice(0, 3)
    .map((item, index) => normalizeSuggestion(item, index, fallbackContent))
    .filter((item) => item.content.trim().length > 0);

  if (normalized.length === 0) {
    return buildFallbackPolishResponse(fallbackContent);
  }

  // Ensure at least one suggestion is marked recommended
  if (!normalized.some((s) => s.isRecommended)) {
    normalized[0].isRecommended = true;
  }

  return { suggestions: normalized };
}
