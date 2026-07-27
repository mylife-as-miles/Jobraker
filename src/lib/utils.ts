import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns a proxied URL for an external image to bypass CORS/Same-Origin restrictions.
 * Logic:
 * 1. Skips if null/undefined.
 * 2. Skips data URLs, local paths, and existing google favicons.
 * 3. Enforces HTTPS for double-slash URLs.
 * 4. Proxies everything else through Supabase Edge Function 'proxy-image'.
 */
export const getProxiedLogoUrl = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;
  
  let targetUrl = url.trim();
  if (targetUrl.startsWith("//")) {
    targetUrl = `https:${targetUrl}`;
  }

  // If it's already a data URL, placeholder, or local path, don't proxy
  // 2. Skip already proxied URLs
  if (targetUrl.includes('/functions/v1/proxy-image')) return targetUrl;

  if (
    targetUrl.startsWith("data:") ||
    targetUrl.startsWith("/")
  ) {
    return targetUrl;
  }

  // Construct proxy URL using the Supabase project endpoint
  const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL ||
    "https://yquhsllwrwfvrwolqywh.supabase.co";
  
  return `${supabaseUrl}/functions/v1/proxy-image?url=${encodeURIComponent(targetUrl)}`;
};

/**
 * Sanitizes technical database/system error strings into clean, user-friendly task updates.
 */
export function formatTaskMessage(message?: string | null): string {
  if (!message?.trim()) return "";

  // Clean up database duplicate key / fingerprint constraint errors
  if (/23505|jobs_user_fingerprint_idx|duplicate key value violates unique constraint/i.test(message)) {
    const retryMatch = message.match(/Retrying in \d+ minute\(s\)/i);
    const retryText = retryMatch ? ` ${retryMatch[0]}.` : "";
    return `Duplicate job entry merged into queue.${retryText}`;
  }

  // Strip raw PostgreSQL error codes/hashes if present
  if (message.includes("[Code: ") || message.includes("Key (user_id, fingerprint)")) {
    return message
      .replace(/\(Key \(user_id, fingerprint\)=[^)]+\)/gi, "")
      .replace(/\[Code: \d+\]/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  return message;
}
