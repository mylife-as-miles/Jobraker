/**
 * Utility to identify job boards that are highly reliable for automated applications.
 * These are sites like Lever, Greenhouse, and Ashby where the automation script
 * has a >99% success rate due to consistent DOM structures and lack of complex captchas.
 */

import { isTrustedAutoApplySource } from "@/lib/autoApplySources";

const TRUSTED_DOMAINS = [
  "lever.co",
  "greenhouse.io",
  "ashbyhq.com",
  "workable.com",
  "breezy.hr",
];

export function isTrustedSource(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  try {
    const parsedUrl = new URL(trimmed);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return false;
    }
    const hostname = parsedUrl.hostname.toLowerCase();

    return TRUSTED_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

export { isTrustedAutoApplySource };
