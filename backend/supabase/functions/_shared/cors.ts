// _shared/cors.ts — shared CORS headers for Edge Functions (browser + credentials).

const ALLOWED_ORIGINS = [
  "https://app.jobraker.io",
  "https://admin.jobraker.io",
  "https://jobraker.io",
  "https://www.jobraker.io",
  "https://jobraker-tau.vercel.app",
  "https://jobraker.vercel.app",
  "https://jobraker.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

function stripTrailingSlash(s: string) {
  return s.replace(/\/+$/, "") || s;
}

/** Compare origins loosely (trailing slash, spacing) so preflight ACAO matches the browser. */
function normalizeOriginForCompare(origin: string) {
  return stripTrailingSlash(origin.trim()).toLowerCase();
}

const ALLOWED_NORMALIZED = new Set(
  ALLOWED_ORIGINS.map((o) => normalizeOriginForCompare(o)),
);

const BASE_ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-skyvern-api-key, x-api-key, accept, accept-language, content-language, prefer, range, x-supabase-api-version";

function mergeAllowHeaders(
  base: string,
  accessControlRequestHeaders: string | null,
): string {
  const set = new Set<string>();
  for (const part of base.split(",")) {
    const t = part.trim().toLowerCase();
    if (t) set.add(t);
  }
  if (accessControlRequestHeaders) {
    for (const part of accessControlRequestHeaders.split(",")) {
      const t = part.trim().toLowerCase();
      if (t) set.add(t);
    }
  }
  return [...set].join(", ");
}

/**
 * @param origin - value of `Origin` request header
 * @param req - optional: used to merge `Access-Control-Request-Headers` from preflight (fixes strict browsers)
 */
export function getCorsHeaders(origin?: string | null, req?: Request): Record<string, string> {
  const raw = typeof origin === "string" ? origin.trim() : "";
  const matched =
    raw && ALLOWED_NORMALIZED.has(normalizeOriginForCompare(raw))
      ? stripTrailingSlash(raw)
      : ALLOWED_ORIGINS[0];

  const requested = req?.headers.get("access-control-request-headers");
  const allowHeaders = mergeAllowHeaders(BASE_ALLOW_HEADERS, requested);

  return {
    "Access-Control-Allow-Origin": matched,
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export const corsHeaders = getCorsHeaders();
