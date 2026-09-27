import type { RemoteScope } from "./types.ts";

// Small country dictionary for location parsing. ISO 3166-1 alpha-2.
// Extend as the index grows; unknown text stays in location_text.
const COUNTRY_PATTERNS: Array<[string, RegExp]> = [
  ["US", /\b(united states|usa|u\.s\.|us only|\bus\b|new york|san francisco|seattle|austin|chicago|boston|denver|los angeles)\b/i],
  ["CA", /\b(canada|toronto|vancouver|montreal)\b/i],
  ["GB", /\b(united kingdom|\buk\b|england|london|scotland)\b/i],
  ["IE", /\b(ireland|dublin)\b/i],
  ["DE", /\b(germany|berlin|munich)\b/i],
  ["FR", /\b(france|paris)\b/i],
  ["NL", /\b(netherlands|amsterdam)\b/i],
  ["ES", /\b(spain|madrid|barcelona)\b/i],
  ["PT", /\b(portugal|lisbon)\b/i],
  ["PL", /\b(poland|warsaw)\b/i],
  ["IN", /\b(india|bangalore|bengaluru|noida|delhi|mumbai|hyderabad|pune)\b/i],
  ["SG", /\b(singapore)\b/i],
  ["AU", /\b(australia|sydney|melbourne)\b/i],
  ["BR", /\b(brazil|são paulo|sao paulo)\b/i],
  ["MX", /\b(mexico)\b/i],
  ["AR", /\b(argentina|buenos aires)\b/i],
  ["NG", /\b(nigeria|lagos|abuja)\b/i],
  ["KE", /\b(kenya|nairobi)\b/i],
  ["ZA", /\b(south africa|cape town|johannesburg)\b/i],
  ["JP", /\b(japan|tokyo)\b/i],
];

const WORLDWIDE = /\b(anywhere|worldwide|global(ly)?|remote[- ]first|work from anywhere|all locations)\b/i;
const REMOTE = /\bremote\b/i;
const HYBRID = /\bhybrid\b/i;
const REGION_EMEA = /\b(emea|europe|eu\b)/i;
const REGION_AMERICAS = /\b(americas|latam|north america)\b/i;

// Job titles like "Engineer (100% Remote, Worldwide)" state the scope more
// reliably than an ATS location list of hiring entities.
export const mentionsWorldwide = (text: string | null | undefined): boolean =>
  Boolean(text) && WORLDWIDE.test(String(text));

export function detectCountries(text: string | null | undefined): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const [code, re] of COUNTRY_PATTERNS) if (re.test(text)) found.add(code);
  return [...found];
}

// Classifies where a job can be done from, given the ATS location text and
// any structured hints the ATS provides.
export function classifyLocation(
  text: string | null | undefined,
  hints: { remote?: boolean | null; hybrid?: boolean | null; countries?: string[] } = {},
): { remoteScope: RemoteScope; countries: string[] } {
  const countries = [...new Set([...(hints.countries ?? []).map((c) => c.toUpperCase()), ...detectCountries(text)])];
  const t = text ?? "";

  if (hints.hybrid || HYBRID.test(t)) return { remoteScope: "hybrid", countries };
  const isRemote = Boolean(hints.remote) || REMOTE.test(t) || WORLDWIDE.test(t);
  if (isRemote) {
    if (countries.length === 0 && !REGION_EMEA.test(t) && !REGION_AMERICAS.test(t) && (WORLDWIDE.test(t) || /^\s*remote\s*$/i.test(t))) {
      return { remoteScope: "worldwide", countries };
    }
    return { remoteScope: "restricted", countries };
  }
  if (countries.length > 0 || t.trim()) return { remoteScope: "onsite", countries };
  return { remoteScope: "unknown", countries };
}
