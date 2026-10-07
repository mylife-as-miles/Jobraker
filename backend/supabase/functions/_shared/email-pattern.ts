// Company email formats: learn a domain's pattern (first.last@, flast@, ...)
// from addresses the company publishes itself, and build candidate addresses
// for a named person. Pure functions, no I/O, so they run under Deno and in
// the Vitest suite alike.

export type EmailPattern =
  | "first.last"
  | "firstlast"
  | "first"
  | "flast"
  | "f.last"
  | "first_last"
  | "first-last"
  | "firstl"
  | "last.first"
  | "last";

// Most common corporate formats first; used when a domain has no evidence.
export const DEFAULT_PATTERN_ORDER: EmailPattern[] = [
  "first.last",
  "first",
  "flast",
  "firstlast",
];

const ALL_PATTERNS: EmailPattern[] = [
  "first.last",
  "firstlast",
  "first",
  "flast",
  "f.last",
  "first_last",
  "first-last",
  "firstl",
  "last.first",
  "last",
];

// Shared inboxes say nothing about how people's addresses are formed.
const ROLE_LOCAL_PARTS = new Set([
  "info", "hello", "contact", "press", "media", "news", "jobs", "job", "careers",
  "career", "recruiting", "recruitment", "talent", "hiring", "hr", "people",
  "support", "help", "sales", "admin", "office", "team", "privacy", "legal",
  "security", "billing", "accounts", "marketing", "partners", "partnerships",
  "investors", "ir", "noreply", "no-reply", "webmaster", "feedback", "events",
]);

export interface NameParts {
  first: string;
  last: string;
}

const HONORIFICS = /^(?:mr|mrs|ms|miss|dr|prof|sir|madam)\.?$/i;
const SUFFIXES = /^(?:jr|sr|ii|iii|iv|phd|mba|md|cpa|pmp|shrm-cp|shrm-scp|phr|sphr)\.?$/i;

/** First and last name, lowercased ASCII. Null when the name is unusable. */
export function nameParts(fullName: string): NameParts | null {
  const tokens = fullName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .split(/[\s,]+/)
    .map((token) => token.replace(/[^A-Za-z'-]/g, ""))
    .filter((token) => token && !HONORIFICS.test(token) && !SUFFIXES.test(token));
  if (tokens.length < 2) return null;
  const clean = (token: string) => token.toLowerCase().replace(/['-]/g, "");
  const first = clean(tokens[0]);
  const last = clean(tokens[tokens.length - 1]);
  if (first.length < 2 || last.length < 2) return null;
  return { first, last };
}

export function applyPattern(pattern: EmailPattern, name: NameParts, domain: string): string {
  const { first, last } = name;
  const local = {
    "first.last": `${first}.${last}`,
    firstlast: `${first}${last}`,
    first,
    flast: `${first[0]}${last}`,
    "f.last": `${first[0]}.${last}`,
    first_last: `${first}_${last}`,
    "first-last": `${first}-${last}`,
    firstl: `${first}${last[0]}`,
    "last.first": `${last}.${first}`,
    last,
  }[pattern];
  return `${local}@${domain.toLowerCase()}`;
}

export interface PatternSample {
  email: string;
  fullName?: string;
}

export interface InferredPattern {
  pattern: EmailPattern;
  /** 0..1, how strongly the evidence points at this pattern. */
  confidence: number;
  samples: number;
}

/**
 * Votes on the domain's format. A published address next to the person's
 * name is decisive (weight 3); an address alone only counts when its shape is
 * unambiguous (e.g. "jane.doe" can only be first.last or last.first).
 */
export function inferEmailPattern(samples: PatternSample[], domain: string): InferredPattern | null {
  const target = domain.toLowerCase();
  const votes = new Map<EmailPattern, number>();
  let counted = 0;
  const seen = new Set<string>();
  for (const sample of samples) {
    const email = sample.email.trim().toLowerCase();
    const [local, emailDomain] = email.split("@");
    if (!local || !emailDomain || seen.has(email)) continue;
    if (emailDomain !== target && !emailDomain.endsWith(`.${target}`)) continue;
    if (ROLE_LOCAL_PARTS.has(local)) continue;
    seen.add(email);

    const name = sample.fullName ? nameParts(sample.fullName) : null;
    if (name) {
      const match = ALL_PATTERNS.find((pattern) => applyPattern(pattern, name, emailDomain) === email);
      if (match) {
        votes.set(match, (votes.get(match) || 0) + 3);
        counted += 1;
      }
      continue;
    }
    const shape = /^[a-z]{2,}\.[a-z]{2,}$/.test(local)
      ? "first.last"
      : /^[a-z]\.[a-z]{2,}$/.test(local)
        ? "f.last"
        : /^[a-z]{2,}_[a-z]{2,}$/.test(local)
          ? "first_last"
          : /^[a-z]{2,}-[a-z]{2,}$/.test(local)
            ? "first-last"
            : null;
    if (shape) {
      votes.set(shape, (votes.get(shape) || 0) + 1);
      counted += 1;
    }
  }
  if (!votes.size) return null;
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  const [pattern, top] = ranked[0];
  const total = ranked.reduce((sum, [, weight]) => sum + weight, 0);
  // Agreement across samples, damped while evidence is thin.
  const confidence = Math.min(0.95, (top / total) * Math.min(1, 0.5 + top / 6));
  return { pattern, confidence: Number(confidence.toFixed(2)), samples: counted };
}

/** Addresses to try for a person, best guess first, without duplicates. */
export function candidateEmails(
  fullName: string,
  domain: string,
  known?: EmailPattern | null,
  max = 4,
): string[] {
  const name = nameParts(fullName);
  if (!name || !domain) return [];
  const order = known
    ? [known, ...DEFAULT_PATTERN_ORDER.filter((pattern) => pattern !== known)]
    : DEFAULT_PATTERN_ORDER;
  return [...new Set(order.map((pattern) => applyPattern(pattern, name, domain)))].slice(0, max);
}
