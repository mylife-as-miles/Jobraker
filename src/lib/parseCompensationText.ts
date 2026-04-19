/**
 * Best-effort parse of free-text comp (application.salary or job listings) into
 * approximate annual amounts for pipeline rollups. Not legal/tax advice; USD-oriented estimates.
 */

export type ParsedCompensation = {
  /** Lower bound annual estimate (USD nominal). */
  minAnnual: number;
  /** Upper bound annual estimate (USD nominal). */
  maxAnnual: number;
  midpointAnnual: number;
  /** 1 = clear range or explicit annual, 0.5 = single figure, 0.25 = weak heuristic */
  parseConfidence: number;
};

const MONTHLY_RE = /(?:\/mo|\/month\b|per\s*month|monthly|\bpm\b)/i;
const YEARLY_RE = /(?:\/yr|\/year\b|per\s*year|yearly|annual|p\.a\.|p\/a)/i;
const HOURLY_RE = /\b(?:\/hr|per\s*hour|hourly|\bph\b)\b/i;

function toAnnualBase(values: number[], monthly: boolean): number[] {
  const mult = monthly ? 12 : 1;
  return values.map((v) => v * mult);
}

/** Pull numeric tokens; handles 120k, $150,000, 95-110k style fragments. */
function extractNumbers(s: string): number[] {
  const out: number[] = [];
  const re = /\$?\s*([\d,]+(?:\.\d+)?)\s*(k|K)?/g;
  let m: RegExpExecArray | null;
  const str = s.replace(/\u2013|\u2014/g, "-");
  while ((m = re.exec(str)) !== null) {
    let n = parseFloat(m[1].replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    if (m[2]) n *= 1000;
    out.push(n);
  }
  return out;
}

/**
 * Parse salary / comp string into annualized min/max/mid in nominal USD.
 * Non-USD symbols are still interpreted numerically (rough).
 */
export function parseAnnualCompensationText(raw: string | null | undefined): ParsedCompensation | null {
  if (raw == null || !String(raw).trim()) return null;
  const s = String(raw).trim();
  if (HOURLY_RE.test(s)) {
    return null;
  }

  const monthly = MONTHLY_RE.test(s) && !YEARLY_RE.test(s);
  const nums = extractNumbers(s);
  if (nums.length === 0) return null;

  const annual = toAnnualBase(nums, monthly);
  let minA = Math.min(...annual);
  let maxA = Math.max(...annual);
  if (minA === maxA && nums.length >= 2) {
    minA = Math.min(...annual);
    maxA = Math.max(...annual);
  }
  if (!Number.isFinite(minA) || minA <= 0) return null;
  if (maxA < minA) [minA, maxA] = [maxA, minA];

  let confidence: ParsedCompensation["parseConfidence"] = 0.5;
  if (annual.length >= 2 && maxA > minA * 1.02) confidence = 1;
  else if (annual.length === 1 && (YEARLY_RE.test(s) || MONTHLY_RE.test(s))) confidence = 0.75;
  else if (annual.length === 1) confidence = 0.5;

  const midpointAnnual = (minA + maxA) / 2;
  return { minAnnual: minA, maxAnnual: maxA, midpointAnnual, parseConfidence: confidence };
}
