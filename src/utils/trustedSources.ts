/**
 * Utility to identify job boards that are highly reliable for automated applications.
 * These are sites like Lever, Greenhouse, and Ashby where the automation script
 * has a >99% success rate due to consistent DOM structures and lack of complex captchas.
 */

const TRUSTED_DOMAINS = [
  "lever.co",
  "greenhouse.io",
  "ashbyhq.com",
  "workable.com",
  "breezy.hr",
];

export function isTrustedSource(url: string | null | undefined): boolean {
  if (!url) return false;
  
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    
    return TRUSTED_DOMAINS.some(domain => hostname.includes(domain));
  } catch (error) {
    // If URL parsing fails, fallback to simple string checking just in case
    const lowerUrl = url.toLowerCase();
    return TRUSTED_DOMAINS.some(domain => lowerUrl.includes(domain));
  }
}
