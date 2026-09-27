// Parses short salary summaries such as "€110K - €185K" or "$90,000 – $120,000".
const SYMBOLS: Record<string, string> = { "$": "USD", "€": "EUR", "£": "GBP", "₹": "INR", "¥": "JPY", "₦": "NGN" };

const toNumber = (raw: string): number | null => {
  const m = raw.replace(/,/g, "").match(/([\d.]+)\s*([kKmM])?/);
  if (!m) return null;
  const base = Number(m[1]);
  if (!Number.isFinite(base)) return null;
  const mult = m[2] ? (m[2].toLowerCase() === "k" ? 1_000 : 1_000_000) : 1;
  return Math.round(base * mult);
};

export function parseSalarySummary(summary: unknown): { min: number | null; max: number | null; currency: string | null } {
  const text = String(summary ?? "").trim();
  if (!text) return { min: null, max: null, currency: null };
  const symbol = Object.keys(SYMBOLS).find((s) => text.includes(s));
  const code = text.match(/\b(USD|EUR|GBP|CAD|AUD|INR|NGN|JPY|CHF|SEK|PLN)\b/)?.[1] ?? null;
  const parts = text.split(/\s*[-–—]\s*|\bto\b/).map((p) => toNumber(p)).filter((n): n is number => n !== null);
  return {
    min: parts[0] ?? null,
    max: parts[1] ?? parts[0] ?? null,
    currency: code ?? (symbol ? SYMBOLS[symbol] : null),
  };
}
