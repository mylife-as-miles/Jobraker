const STORAGE_KEY = "jobraker_pending_referral_code";

export function capturePendingReferralCodeFromSearch(search: string): void {
  try {
    const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
    const ref = params.get("ref")?.trim();
    if (ref && ref.length <= 64) {
      localStorage.setItem(STORAGE_KEY, ref);
    }
  } catch {
    /* ignore */
  }
}

export function peekPendingReferralCode(): string | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)?.trim();
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function clearPendingReferralCode(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function buildReferralUrl(origin: string, code: string): string {
  const o = origin.replace(/\/$/, "");
  return `${o}/signup?ref=${encodeURIComponent(code)}`;
}
