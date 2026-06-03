import type { RankingReason, RankingReasonCategory, RankingReasonImpact } from "./types";

export const clampScore = (value: number): number =>
  Math.max(0, Math.min(100, Math.round(value)));

export const compactText = (value?: string | null): string =>
  (value ?? "").trim();

export const normalizeText = (value?: string | null): string =>
  compactText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+#.\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const tokenize = (value?: string | null): string[] =>
  normalizeText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !/^\d+$/.test(token));

export const unique = <T>(values: T[]): T[] => Array.from(new Set(values));

export const safeDateMs = (value?: string | null): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export const daysSince = (value?: string | null): number | null => {
  const parsed = safeDateMs(value);
  if (parsed == null) return null;
  return Math.floor((Date.now() - parsed) / (24 * 60 * 60 * 1000));
};

export const isExpired = (value?: string | null): boolean => {
  const parsed = safeDateMs(value);
  return parsed != null && parsed < Date.now();
};

export const hasValidHttpUrl = (value?: string | null): boolean => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

export const getUrlHost = (value?: string | null): string | null => {
  if (!value) return null;
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
};

export const normalizeUrlKey = (value?: string | null): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.hostname.replace(/^www\./, "").toLowerCase()}${path}`.toLowerCase();
  } catch {
    return normalizeText(value) || null;
  }
};

export const reason = (
  id: string,
  category: RankingReasonCategory,
  impact: RankingReasonImpact,
  title: string,
  detail: string,
  options: Pick<RankingReason, "evidence" | "scoreDelta" | "source" | "weight"> = {},
): RankingReason => ({
  id,
  category,
  impact,
  title,
  detail,
  ...options,
});

export const textIncludesAny = (value: string, patterns: RegExp[]): boolean =>
  patterns.some((pattern) => pattern.test(value));

export const sentenceFragments = (text?: string | null): string[] =>
  compactText(text)
    .split(/\r?\n|[.!?]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 18);

export const jaccardSimilarity = (left: string[], right: string[]): number => {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (!leftSet.size || !rightSet.size) return 0;
  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) intersection += 1;
  }
  return intersection / (leftSet.size + rightSet.size - intersection);
};
