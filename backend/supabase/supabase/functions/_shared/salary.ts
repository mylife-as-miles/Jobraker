// Shared salary parsing utilities for Edge Functions
// Centralize here to avoid duplicate function identifier declarations when bundling.

export function parseSalaryRangeToMinMax(input?: string): { min: number | null; max: number | null } {
  if (!input) return { min: null, max: null };
  // Normalize: remove commas/spaces, handle k suffix (e.g., 120k-150k)
  const cleaned = input
    .replace(/[,]/g, '')
    .replace(/(\d)k(?!\w)/gi, (_, d) => String(parseInt(d, 10) * 1000))
    .replace(/\s+/g, '');
  // Match patterns like 120000-150000, 120000 to 150000, $120000–$150000
  const m = cleaned.match(/\$?(\d{2,7})(?:[-–to]+\$?(\d{2,7}))?/i);
  if (!m) return { min: null, max: null };
  const min = parseInt(m[1], 10);
  const max = m[2] ? parseInt(m[2], 10) : null;
  return { min: Number.isFinite(min) ? min : null, max: max && Number.isFinite(max) ? max : null };
}

// Convenience helper to infer salary period and currency from arbitrary text
export function inferSalaryMeta(text?: string): { period?: string; currency?: string } {
  if (!text) return {};
  const t = text.toLowerCase();
  const periodRe = /(per\s+)?(hour|hr|day|week|wk|month|mo|year|yr|annum)/i;
  const currencyRe = /([$€£]|usd|eur|gbp)/i;
  const p = t.match(periodRe)?.[2] || '';
  const cRaw = text.match(currencyRe)?.[1] || '';
  const normPeriod = (v: string) => ({ hr: 'hour', wk: 'week', mo: 'month', yr: 'year' } as any)[v] || v;
  const normCurrency = (v: string) => ({ '$': 'USD', usd: 'USD', '€': 'EUR', eur: 'EUR', '£': 'GBP', gbp: 'GBP' } as any)[v.toLowerCase()] || undefined;
  const period = normPeriod(p);
  const currency = normCurrency(cRaw);
  return { ...(period ? { period } : {}), ...(currency ? { currency } : {}) };
}
