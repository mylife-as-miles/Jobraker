import { getCorsHeaders } from "../_shared/types.ts";

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower === "::1" ||
    lower.endsWith(".local")
  ) {
    return true;
  }
  if (/^127\./.test(lower) || /^10\./.test(lower) || /^192\.168\./.test(lower)) {
    return true;
  }
  const match172 = lower.match(/^172\.(\d+)\./);
  if (match172) {
    const secondOctet = Number(match172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }
  return false;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin || undefined);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const urlStr = new URL(req.url).searchParams.get("url");
  if (!urlStr) {
    return new Response(JSON.stringify({ error: "Missing url parameter" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const parsedUrl = new URL(urlStr);
    if (!["http:", "https:"].includes(parsedUrl.protocol) || isBlockedHostname(parsedUrl.hostname)) {
      return new Response(JSON.stringify({ error: "Unsupported image URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(urlStr, {
      redirect: "follow",
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Error fetching image: ${response.statusText}`, status: response.status }),
        {
          status: response.status >= 400 && response.status < 600 ? response.status : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const contentType = response.headers.get("Content-Type") || "image/png";
    const buffer = await response.arrayBuffer();

    return new Response(buffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: `Fetch error: ${err.message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
