// _shared/cors.ts
export function getCorsHeaders(origin?: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin?.trim() || "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-skyvern-api-key, x-api-key, accept, accept-language, content-language",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

export const corsHeaders = getCorsHeaders();
