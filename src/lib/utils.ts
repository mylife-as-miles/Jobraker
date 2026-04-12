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

  // If it's already a data URL, placeholder, google favicon, or local path, don't proxy
  if (
    targetUrl.startsWith("data:") ||
    targetUrl.startsWith("/") ||
    targetUrl.startsWith("https://www.google.com/s2/favicons")
  ) {
    return targetUrl;
  }

  // Construct proxy URL using the Supabase project endpoint
  const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL ||
    "https://yquhsllwrwfvrwolqywh.supabase.co";
  
  return `${supabaseUrl}/functions/v1/proxy-image?url=${encodeURIComponent(targetUrl)}`;
};
