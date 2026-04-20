/**
 * micro1 referral params (from official share link). Applied to jobs.micro1.ai URLs.
 */
const MICRO1_REFERRAL_PARAMS: Record<string, string> = {
  referralCode: "f329ea9d-7c58-4e84-8990-02d4a98dc765",
  utm_source: "referral",
  utm_medium: "share",
  utm_campaign: "job_referral",
};

export function applyMicro1ReferralToUrl(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return raw;
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return raw;
  }
  if (u.hostname.toLowerCase() !== "jobs.micro1.ai") {
    return trimmed;
  }
  for (const [key, value] of Object.entries(MICRO1_REFERRAL_PARAMS)) {
    if (!u.searchParams.has(key)) u.searchParams.set(key, value);
  }
  return u.toString();
}
