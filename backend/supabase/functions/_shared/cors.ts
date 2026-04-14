// _shared/cors.ts
const ALLOWED_ORIGINS = [
  "https://jobraker-tau.vercel.app",
  "https://jobraker.vercel.app",
  "https://jobraker.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

export function getCorsHeaders(origin?: string | null): Record<string, string> {
  const matched =
    origin && ALLOWED_ORIGINS.includes(origin.trim())
      ? origin.trim()
      : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": matched,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-skyvern-api-key, x-api-key, accept, accept-language, content-language",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

export const corsHeaders = getCorsHeaders();
